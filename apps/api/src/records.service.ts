import { Inject, Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Database } from './db';
import { ChainService } from './blockchain/service';
import { hashRecord } from './hash';
import { Actor, canReview, ownsOrAdmin } from './security';
export const versionInclude = {
  evidence: true,
  anchor: {
    include: {
      transactions: { select: { hash: true, blockNumber: true, createdAt: true } },
      jobs: { select: { operation: true, status: true } },
    },
  },
  decisions: true,
} as const;
@Injectable()
export class RecordsService {
  constructor(
    @Inject(Database) readonly db: Database,
    @Inject(ChainService) readonly chain: ChainService,
  ) {}
  async audit(tx: Prisma.TransactionClient, actorId: string, action: string, objectId: string) {
    await tx.applicationAuditLog.create({ data: { actorId, action, objectId, metadata: {} } });
  }
  async profile(userId: string, snapshot: Prisma.InputJsonValue) {
    return this.db.$transaction(
      async (tx) => {
        const profile = await tx.studentProfile.upsert({ where: { userId }, create: { userId }, update: {} });
        const previous = await tx.recordVersion.findFirst({
          where: { profileId: profile.id },
          orderBy: { version: 'desc' },
          include: { anchor: true },
        });
        const contentHash = hashRecord(snapshot);
        if (previous?.contentHash === contentHash) return previous;
        const version = await tx.recordVersion.create({
          data: {
            ownerId: userId,
            profileId: profile.id,
            type: 'PROFILE',
            version: (previous?.version || 0) + 1,
            previousId: previous?.id,
            snapshot,
            contentHash,
          },
        });
        await this.chain.enqueue(tx, version, previous?.anchor);
        await this.audit(tx, userId, 'PROFILE_VERSION_CREATED', version.id);
        return version;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async achievement(
    actor: Actor,
    input: any,
    evidence: { objectKey: string; mime: string; size: number; hash: string },
    achievementId?: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const membership = await tx.userInstitution.findUnique({
          where: { userId_institutionId: { userId: actor.id, institutionId: input.institutionId } },
        });
        if (!membership) throw new ForbiddenException('Bu kuruma bağlı değilsiniz.');
        let achievement = achievementId
          ? await tx.achievement.findUnique({ where: { id: achievementId } })
          : null;
        if (achievementId && (!achievement || achievement.userId !== actor.id))
          throw new NotFoundException('Başarı bulunamadı.');
        if (achievement?.status === 'REVOKED')
          throw new ConflictException('Geçersiz kılınmış başarı değiştirilemez.');
        if (achievement && achievement.institutionId !== input.institutionId)
          throw new ConflictException('Sürümde kurum değiştirilemez.');
        if (!achievement)
          achievement = await tx.achievement.create({
            data: { userId: actor.id, institutionId: input.institutionId },
          });
        const previous = await tx.recordVersion.findFirst({
          where: { achievementId: achievement.id },
          orderBy: { version: 'desc' },
        });
        const snapshot = { ...input, documentHash: evidence.hash };
        const version = await tx.recordVersion.create({
          data: {
            ownerId: actor.id,
            achievementId: achievement.id,
            type: 'ACHIEVEMENT',
            version: (previous?.version || 0) + 1,
            previousId: previous?.id,
            snapshot,
            contentHash: hashRecord(snapshot),
            evidence: { create: evidence },
          },
        });
        await tx.achievement.update({ where: { id: achievement.id }, data: { status: 'PENDING' } });
        await this.audit(tx, actor.id, 'ACHIEVEMENT_SUBMITTED', version.id);
        return { id: achievement.id, version };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async authorizedVersion(actor: Actor, id: string) {
    const version = await this.db.recordVersion.findUnique({
      where: { id },
      include: { ...versionInclude, achievement: true },
    });
    if (
      !version ||
      !(
        ownsOrAdmin(actor, version.ownerId) ||
        (version.achievement && canReview(actor, version.achievement.institutionId))
      )
    )
      throw new NotFoundException('Kayıt bulunamadı.');
    return version;
  }
  async decision(
    actor: Actor,
    achievementId: string,
    input: { decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED'; note: string; versionId: string },
  ) {
    return this.db.$transaction(
      async (tx) => {
        const achievement = await tx.achievement.findUnique({
          where: { id: achievementId },
          include: { versions: { orderBy: { version: 'desc' }, include: { anchor: true, evidence: true } } },
        });
        if (!achievement || !canReview(actor, achievement.institutionId))
          throw new NotFoundException('Başarı bulunamadı.');
        const version = achievement.versions[0];
        if (achievement.status !== 'PENDING' || version.id !== input.versionId || version.anchor)
          throw new ConflictException('Başarı durumu değişti. Sayfayı yenileyin.');
        await tx.verificationDecision.create({
          data: {
            achievementId,
            versionId: version.id,
            actorId: actor.id,
            decision: input.decision,
            note: input.note,
          },
        });
        if (input.decision === 'APPROVED') {
          if (!version.evidence) throw new ConflictException('Onay için belge gerekiyor.');
          const previous = achievement.versions.find((v) => v.anchor);
          await this.chain.enqueue(tx, version, previous?.anchor);
        }
        await tx.achievement.update({ where: { id: achievementId }, data: { status: input.decision } });
        await this.audit(tx, actor.id, 'VERIFICATION_' + input.decision, version.id);
        return { message: 'Doğrulama kararı kaydedildi.' };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
