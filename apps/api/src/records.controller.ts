import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Param,
  Query,
  Inject,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import type { Response } from 'express';
import { Database } from './db';
import { RecordsService, versionInclude } from './records.service';
import { ChainService } from './blockchain/service';
import { StorageService, validateFile } from './storage';
import { AuthRequest, Roles, canReview, Public } from './security';
import { profileSchema, achievementSchema } from '../../../packages/shared/src';
import { sha256 } from './hash';
import { pageArgs } from './common';
export const uploadOptions = { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } };
@ApiTags('Profil, başarı ve belge doğrulama')
@Controller()
export class RecordsController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(RecordsService) private records: RecordsService,
    @Inject(ChainService) private chain: ChainService,
    @Inject(StorageService) private storage: StorageService,
  ) {}
  @Get('students/profile')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Güncel öğrenci profili' })
  profile(@Req() req: AuthRequest) {
    return this.db.recordVersion.findFirst({
      where: { ownerId: req.user.id, type: 'PROFILE' },
      orderBy: { version: 'desc' },
      include: versionInclude,
    });
  }
  @Get('students/history')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Değiştirilemez profil sürümleri' })
  history(@Req() req: AuthRequest, @Query('page') page: string) {
    return this.db.recordVersion.findMany({
      where: { ownerId: req.user.id, type: 'PROFILE' },
      orderBy: { version: 'desc' },
      include: versionInclude,
      ...pageArgs(page),
    });
  }
  @Post('students/profile')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Yeni profil sürümü oluştur' })
  saveProfile(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.records.profile(req.user.id, profileSchema.parse(body));
  }
  @Get('achievements')
  @ApiOperation({ summary: 'Yetki kapsamındaki başarılar' })
  achievements(@Req() req: AuthRequest, @Query('page') page: string) {
    const user = req.user;
    return this.db.achievement.findMany({
      where:
        user.role === 'ADMIN'
          ? {}
          : user.role === 'VERIFIER'
            ? { institutionId: { in: user.memberships.map((m) => m.institutionId) } }
            : { userId: user.id },
      include: {
        institution: true,
        versions: { orderBy: { version: 'desc' }, take: 1, include: versionInclude },
      },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(page),
    });
  }
  @Get('achievements/:id')
  @ApiOperation({ summary: 'Başarı ve sürüm geçmişi' })
  async achievement(@Req() req: AuthRequest, @Param('id') id: string) {
    z.string().uuid().parse(id);
    const a = await this.db.achievement.findUnique({
      where: { id },
      include: {
        institution: true,
        versions: { orderBy: { version: 'desc' }, include: versionInclude },
        decisions: true,
      },
    });
    if (!a || !(a.userId === req.user.id || canReview(req.user, a.institutionId)))
      throw new NotFoundException('Başarı bulunamadı.');
    return a;
  }
  @Post('achievements')
  @Roles('STUDENT')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiOperation({ summary: 'Belgeyle başarı gönder' })
  async submit(
    @Req() req: AuthRequest,
    @Body('data') data: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const input = achievementSchema.parse(JSON.parse(data));
    const evidence = await this.storage.put(file);
    try {
      return await this.records.achievement(req.user, input, evidence);
    } catch (e) {
      await this.storage.remove(evidence.objectKey);
      throw e;
    }
  }
  @Post('achievements/:id/versions')
  @Roles('STUDENT')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiOperation({ summary: 'Başarı düzeltmesi için yeni sürüm gönder' })
  async correction(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body('data') data: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    z.string().uuid().parse(id);
    const input = achievementSchema.parse(JSON.parse(data));
    const evidence = await this.storage.put(file);
    try {
      return await this.records.achievement(req.user, input, evidence, id);
    } catch (e) {
      await this.storage.remove(evidence.objectKey);
      throw e;
    }
  }
  @Post('verifications/:id')
  @Roles('VERIFIER', 'ADMIN')
  @ApiOperation({ summary: 'Başarı hakkında kurum kararı ver' })
  decision(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.records.decision(
      req.user,
      z.string().uuid().parse(id),
      z
        .object({
          decision: z.enum(['APPROVED', 'REJECTED', 'REVISION_REQUIRED']),
          note: z.string().trim().min(3).max(2000),
          versionId: z.string().uuid(),
        })
        .strict()
        .parse(body),
    );
  }
  @Post('verifications/:id/revoke')
  @Roles('VERIFIER', 'ADMIN')
  @ApiOperation({ summary: 'Başarıyı gerekçesiyle geçersiz kıl' })
  async revoke(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const { note } = z.object({ note: z.string().min(5).max(2000) }).parse(body);
    const a = await this.achievement(req, id);
    if (!canReview(req.user, a.institutionId)) throw new NotFoundException('Başarı bulunamadı.');
    return this.db.$transaction(async (tx) => {
      const versions = a.versions.filter((v) => v.anchor);
      if (!versions.length) throw new ConflictException('Blokzincir kaydı yok.');
      for (const v of versions) {
        if (v.anchor!.status !== 'CONFIRMED')
          throw new ConflictException('Önce blokzincir onayını bekleyin.');
        await tx.blockchainOutbox.upsert({
          where: { anchorId_operation: { anchorId: v.anchor!.id, operation: 'REVOKE' } },
          create: { anchorId: v.anchor!.id, operation: 'REVOKE' },
          update: {},
        });
      }
      await tx.achievement.update({ where: { id }, data: { status: 'REVOKED' } });
      await tx.verificationDecision.create({
        data: {
          achievementId: id,
          versionId: a.versions[0].id,
          actorId: req.user.id,
          decision: 'REVOKED',
          note,
        },
      });
      await this.records.audit(tx, req.user.id, 'ACHIEVEMENT_REVOKED', id);
      return { message: 'Geçersiz kılma işlemi kuyruğa alındı.' };
    });
  }
  @Get('records/:id/integrity')
  @ApiOperation({ summary: 'Uygulama kaydını gerçek blokzincir özetiyle karşılaştır' })
  async integrity(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.chain.integrity(await this.records.authorizedVersion(req.user, z.string().uuid().parse(id)));
  }
  @Get('records/:id/evidence')
  @ApiOperation({ summary: 'Yetkili kullanıcı için özel belgeyi indir' })
  async evidence(@Req() req: AuthRequest, @Param('id') id: string, @Res() res: Response) {
    const version = await this.records.authorizedVersion(req.user, z.string().uuid().parse(id));
    if (!version.evidence) throw new NotFoundException('Belge bulunamadı.');
    res.setHeader('Content-Type', version.evidence.mime);
    res.setHeader('Content-Disposition', 'attachment; filename="belge"');
    res.setHeader('Cache-Control', 'no-store');
    (await this.storage.read(version.evidence.objectKey)).pipe(res);
  }
  @Post('records/:id/verify-document')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiOperation({ summary: 'Seçilen dosyanın baytlarını blokzincirle karşılaştır' })
  async verifyFile(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    validateFile(file);
    const version = await this.records.authorizedVersion(req.user, z.string().uuid().parse(id));
    if (!version.anchor || version.anchor.status !== 'CONFIRMED')
      throw new ConflictException('Belge henüz blokzincire kaydedilmedi.');
    const record = await this.chain.getRecord(version.anchor);
    return {
      state:
        Number(record.status) === 3
          ? 'REVOKED'
          : sha256(file.buffer) === record.documentHash
            ? 'MATCH'
            : 'MISMATCH',
      currentHash: sha256(file.buffer),
      anchoredHash: record.documentHash,
    };
  }
  @Public()
  @Get('public/verify/:token')
  @ApiOperation({ summary: 'Gizlilik izinlerine göre QR doğrulaması' })
  async publicVerify(@Param('token') token: string) {
    z.string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .parse(token);
    const a = await this.db.blockchainAnchor.findUnique({
      where: { publicToken: token },
      include: {
        version: { include: { evidence: true, achievement: true } },
        transactions: { select: { hash: true, blockNumber: true } },
      },
    });
    if (!a || a.version.type !== 'ACHIEVEMENT') throw new NotFoundException('Doğrulama kaydı bulunamadı.');
    const result = await this.chain.integrity({ ...a.version, anchor: a });
    const preference = await this.db.privacyPreference.findUnique({ where: { userId: a.version.ownerId } });
    const settings = preference?.settings as any;
    const consent = await this.db.consentRecord.findFirst({
      where: { userId: a.version.ownerId, type: 'PUBLIC_SHARE' },
      orderBy: { createdAt: 'desc' },
    });
    const revoked = a.version.achievement?.status === 'REVOKED';
    return {
      state: revoked ? 'REVOKED' : result.state,
      message:
        'Bu sonuç, onaylanan dijital kaydın bütünlüğünü gösterir; başarının gerçekliğini tek başına kanıtlamaz.',
      ...(consent?.granted && settings?.publicTitle && settings?.achievements === 'PUBLIC'
        ? { title: (a.version.snapshot as any).title, transactions: a.transactions, verifiedAt: a.createdAt }
        : {}),
    };
  }
}
