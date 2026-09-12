import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Req,
  Param,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { Database } from './db';
import { AuthRequest, Roles, Actor } from './security';
import { mentorSchema, defaultWeights } from '../../../packages/shared/src';
import { pageArgs } from './common';
import { visibleStudentFields } from './privacy-policy';
@ApiTags('Mentorluk ve güvenli iletişim')
@Controller()
export class MentoringController {
  constructor(@Inject(Database) private db: Database) {}
  @Get('students/:id/shared')
  @Roles('MENTOR', 'VERIFIER')
  @ApiOperation({ summary: 'İzin verilen güncel öğrenci alanlarını göster' })
  async sharedStudent(@Req() req: AuthRequest, @Param('id') id: string) {
    z.string().uuid().parse(id);
    if (req.user.role === 'MENTOR') {
      const connection = await this.db.mentorConnectionRequest.findFirst({
        where: { studentId: id, mentorId: req.user.id, state: 'APPROVED' },
      });
      if (!connection) throw new NotFoundException('Onaylı mentorluk bulunamadı.');
    } else if (!(await this.institutionCanApprove(req.user, id)))
      throw new NotFoundException('Öğrenci bulunamadı.');
    const privacy = await this.db.privacyPreference.findUnique({ where: { userId: id } });
    const settings = (privacy?.settings || {}) as Record<string, unknown>;
    if (req.user.role === 'MENTOR' && !settings.mentorSearch)
      return { fields: {}, message: 'Öğrenci gelişim bilgilerini paylaşmıyor.' };
    const version = await this.db.recordVersion.findFirst({
      where: { ownerId: id, type: 'PROFILE' },
      orderBy: { version: 'desc' },
    });
    return {
      fields: version
        ? visibleStudentFields(
            version.snapshot as Record<string, unknown>,
            settings,
            req.user.role === 'MENTOR' ? 'MENTOR' : 'INSTITUTION',
          )
        : {},
      message: 'Yalnızca izinli alanlar gösterilir. Beceriler öz değerlendirmedir.',
    };
  }
  @Get('mentors')
  @ApiOperation({ summary: 'Doğrulanmış mentorları listele' })
  async mentors(@Query('page') page: string) {
    const mentors = await this.db.mentorProfile.findMany({
      where: { verified: true, user: { active: true } },
      include: { user: { select: { name: true } } },
      ...pageArgs(page),
    });
    return mentors.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      data: m.data,
      verified: m.verified,
      verifiedAt: m.verifiedAt,
    }));
  }
  @Get('mentors/profile')
  @Roles('MENTOR')
  @ApiOperation({ summary: 'Kendi mentor profilini getir' })
  profile(@Req() req: AuthRequest) {
    return this.db.mentorProfile.findUnique({ where: { userId: req.user.id } });
  }
  @Put('mentors/profile')
  @Roles('MENTOR')
  @ApiOperation({ summary: 'Mentor profilini ve uygunluk saatlerini kaydet' })
  async save(@Req() req: AuthRequest, @Body() body: unknown) {
    const data = mentorSchema.parse(body);
    const previous = await this.db.mentorProfile.findUnique({ where: { userId: req.user.id } });
    const old = previous?.data as any;
    const material =
      !old ||
      JSON.stringify(old.expertise) !== JSON.stringify(data.expertise) ||
      old.experience !== data.experience;
    return this.db.mentorProfile.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, data },
      update: { data, ...(material ? { verified: false, verifiedBy: null, verifiedAt: null } : {}) },
    });
  }
  @Get('recommendations')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Gerçek özelliklerden açıklanabilir mentor sıralaması hesapla' })
  async recommendations(@Req() req: AuthRequest) {
    const profile = await this.db.recordVersion.findFirst({
      where: { ownerId: req.user.id, type: 'PROFILE' },
      orderBy: { version: 'desc' },
    });
    if (!profile)
      return { results: [], model: 'weighted-v1', message: 'Öneri almak için önce profilinizi tamamlayın.' };
    const consent = await this.db.consentRecord.findFirst({
      where: { userId: req.user.id, type: 'MATCHING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!consent?.granted)
      throw new ForbiddenException('Öneriler için gizlilik sayfasından eşleştirme izni verin.');
    const mentors = await this.db.mentorProfile.findMany({
      where: { verified: true, user: { active: true } },
      include: { user: { select: { name: true } } },
      take: 500,
    });
    const weights = await this.db.applicationSetting.findUnique({ where: { key: 'MATCHER_WEIGHTS' } });
    const candidates = await Promise.all(
      mentors.map(async (m) => ({
        id: m.userId,
        ...(m.data as object),
        usedCapacity: await this.db.mentorConnectionRequest.count({
          where: { mentorId: m.userId, state: { in: ['APPROVED', 'MENTOR_ACCEPTED'] } },
        }),
      })),
    );
    try {
      const response = await fetch(`${process.env.MATCHER_SERVICE_URL || 'http://127.0.0.1:8000'}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student: profile.snapshot,
          mentors: candidates,
          weights: weights?.value || defaultWeights,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('MATCHER');
      const result = (await response.json()) as any;
      for (const row of result.results) {
        row.name = mentors.find((m) => m.userId === row.id)?.user.name;
        await this.db.mentorRecommendation.create({
          data: { studentId: req.user.id, mentorId: row.id, result: row },
        });
      }
      return result;
    } catch {
      throw new ServiceUnavailableException('Mentor öneri hizmetine şu anda ulaşılamıyor.');
    }
  }
  private async institutionCanApprove(actor: Actor, studentId: string) {
    return (
      actor.role === 'ADMIN' ||
      (actor.role === 'VERIFIER' &&
        Boolean(
          await this.db.userInstitution.findFirst({
            where: {
              userId: studentId,
              institutionId: { in: actor.memberships.map((m) => m.institutionId) },
            },
          }),
        ))
    );
  }
  @Get('connections')
  @ApiOperation({ summary: 'Bağlantı isteklerini ve onaylı ilişkileri listele' })
  async connections(@Req() req: AuthRequest, @Query('page') page: string) {
    let students: string[] = [];
    if (req.user.role === 'VERIFIER')
      students = (
        await this.db.userInstitution.findMany({
          where: { institutionId: { in: req.user.memberships.map((m) => m.institutionId) } },
        })
      ).map((m) => m.userId);
    const rows = await this.db.mentorConnectionRequest.findMany({
      where:
        req.user.role === 'ADMIN'
          ? {}
          : req.user.role === 'VERIFIER'
            ? { studentId: { in: students } }
            : { OR: [{ studentId: req.user.id }, { mentorId: req.user.id }] },
      include: { conversation: true, feedback: true },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(page),
    });
    const users = await this.db.user.findMany({
      where: { id: { in: rows.flatMap((r) => [r.studentId, r.mentorId]) } },
      select: { id: true, name: true },
    });
    return rows.map((r) => ({
      ...r,
      studentName: users.find((u) => u.id === r.studentId)?.name,
      mentorName: users.find((u) => u.id === r.mentorId)?.name,
    }));
  }
  @Post('connections')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Mentorluk talebi gönder' })
  async request(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = z
      .object({ mentorId: z.string().uuid(), note: z.string().trim().min(5).max(1000) })
      .strict()
      .parse(body);
    const mentor = await this.db.mentorProfile.findUnique({
      where: { userId: input.mentorId },
      include: { user: true },
    });
    if (!mentor?.verified || !mentor.user.active)
      throw new NotFoundException('Doğrulanmış mentor bulunamadı.');
    return this.db.mentorConnectionRequest.create({ data: { studentId: req.user.id, ...input } });
  }
  @Post('connections/:id/action')
  @ApiOperation({ summary: 'Mentor kararı, kurum onayı veya ilişki kapatma' })
  async action(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const { action } = z
      .object({ action: z.enum(['ACCEPT', 'APPROVE', 'REJECT', 'CANCEL', 'CLOSE']) })
      .strict()
      .parse(body);
    const institutionAllowed = await this.institutionCanApprove(
      req.user,
      (await this.db.mentorConnectionRequest.findUnique({ where: { id } }))?.studentId ||
        '00000000-0000-0000-0000-000000000000',
    );
    return this.db.$transaction(
      async (tx) => {
        const c = await tx.mentorConnectionRequest.findUnique({ where: { id: z.string().uuid().parse(id) } });
        if (!c) throw new NotFoundException('Bağlantı bulunamadı.');
        let state = c.state;
        if (action === 'ACCEPT' && req.user.id === c.mentorId && state === 'PENDING') {
          const student = await tx.user.findUniqueOrThrow({ where: { id: c.studentId } });
          state = student.minor ? 'MENTOR_ACCEPTED' : 'APPROVED';
        } else if (action === 'APPROVE' && institutionAllowed && state === 'MENTOR_ACCEPTED')
          state = 'APPROVED';
        else if (
          action === 'REJECT' &&
          (req.user.id === c.mentorId || institutionAllowed) &&
          ['PENDING', 'MENTOR_ACCEPTED'].includes(state)
        )
          state = 'REJECTED';
        else if (
          action === 'CANCEL' &&
          req.user.id === c.studentId &&
          ['PENDING', 'MENTOR_ACCEPTED'].includes(state)
        )
          state = 'CANCELLED';
        else if (
          action === 'CLOSE' &&
          ([c.mentorId, c.studentId].includes(req.user.id) || institutionAllowed) &&
          state === 'APPROVED'
        )
          state = 'CLOSED';
        else throw new ForbiddenException('Bu durum değişikliği için yetkiniz bulunmuyor.');
        if (['APPROVED', 'MENTOR_ACCEPTED'].includes(state) && state !== c.state) {
          const mentor = await tx.mentorProfile.findUniqueOrThrow({
            where: { userId: c.mentorId },
            include: { user: true },
          });
          if (!mentor.verified || !mentor.user.active)
            throw new ConflictException('Mentor şu anda uygun değil.');
          const used = await tx.mentorConnectionRequest.count({
            where: {
              mentorId: c.mentorId,
              id: { not: c.id },
              state: { in: ['APPROVED', 'MENTOR_ACCEPTED'] },
            },
          });
          if (used >= (mentor.data as any).capacity) throw new ConflictException('Mentor kapasitesi dolu.');
        }
        await tx.mentorConnectionRequest.update({
          where: { id },
          data: { state, ...(action === 'APPROVE' ? { institutionApprovedBy: req.user.id } : {}) },
        });
        if (state === 'APPROVED')
          await tx.conversation.upsert({
            where: { connectionId: id },
            create: { connectionId: id },
            update: {},
          });
        if (state === 'CLOSED')
          await tx.conversation.updateMany({ where: { connectionId: id }, data: { closed: true } });
        await tx.applicationAuditLog.create({
          data: { actorId: req.user.id, action: 'CONNECTION_' + state, objectId: id, metadata: {} },
        });
        return { state };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  private async conversation(actor: Actor, id: string) {
    const c = await this.db.conversation.findUnique({
      where: { id: z.string().uuid().parse(id) },
      include: { connection: true },
    });
    if (!c || ![c.connection.studentId, c.connection.mentorId].includes(actor.id))
      throw new NotFoundException('Görüşme bulunamadı.');
    return c;
  }
  @Get('messages/:id')
  @ApiOperation({ summary: 'Yalnızca katılımcıların görüşme mesajlarını getir' })
  async messages(@Req() req: AuthRequest, @Param('id') id: string, @Query('page') page: string) {
    await this.conversation(req.user, id);
    await this.db.message.updateMany({
      where: { conversationId: id, senderId: { not: req.user.id }, readAt: null },
      data: { readAt: new Date() },
    });
    return this.db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(page),
    });
  }
  @Post('messages/:id')
  @ApiOperation({ summary: 'Onaylı açık görüşmeye mesaj gönder' })
  async message(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const { body: message } = z
      .object({ body: z.string().trim().min(1).max(4000) })
      .strict()
      .parse(body);
    const c = await this.conversation(req.user, id);
    if (c.closed || c.connection.state !== 'APPROVED')
      throw new ForbiddenException('Görüşme kapalı veya kurum onayı bekliyor.');
    return this.db.message.create({ data: { conversationId: id, senderId: req.user.id, body: message } });
  }
  @Post('messages/:id/report')
  @ApiOperation({ summary: 'Görüşmeyi bildir ve koruyucu olarak kapat' })
  async report(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    await this.conversation(req.user, id);
    const { reason } = z
      .object({ reason: z.string().trim().min(5).max(2000) })
      .strict()
      .parse(body);
    await this.db.$transaction([
      this.db.conversationReport.create({ data: { conversationId: id, actorId: req.user.id, reason } }),
      this.db.conversation.update({ where: { id }, data: { closed: true } }),
    ]);
    return { message: 'Bildirim kaydedildi ve görüşme kapatıldı.' };
  }
  @Post('connections/:id/feedback')
  @ApiOperation({ summary: 'Etkin veya tamamlanmış mentorluk için geri bildirim ver' })
  async feedback(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const data = z
      .object({ rating: z.number().int().min(1).max(5), progress: z.number().int().min(0).max(100) })
      .strict()
      .parse(body);
    const c = await this.db.mentorConnectionRequest.findUnique({ where: { id } });
    if (!c || ![c.studentId, c.mentorId].includes(req.user.id) || !['APPROVED', 'CLOSED'].includes(c.state))
      throw new NotFoundException('Uygun mentorluk bulunamadı.');
    return this.db.mentoringFeedback.upsert({
      where: { connectionId_actorId: { connectionId: id, actorId: req.user.id } },
      create: { connectionId: id, actorId: req.user.id, ...data },
      update: data,
    });
  }
}
