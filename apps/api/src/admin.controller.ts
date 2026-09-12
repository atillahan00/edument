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
  ConflictException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { Database } from './db';
import { AuthRequest, Roles } from './security';
import { ChainService } from './blockchain/service';
import {
  privacySchema,
  privateDefaults,
  roleSchema,
  weightsSchema,
  defaultWeights,
} from '../../../packages/shared/src';
import { pageArgs } from './common';
@ApiTags('Gizlilik ve kurum yönetimi')
@Controller()
export class AdminController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(ChainService) private chain: ChainService,
  ) {}
  @Get('institutions')
  @ApiOperation({ summary: 'Üyesi olunan kurumları listele' })
  institutions(@Req() req: AuthRequest) {
    return this.db.institution.findMany({
      where: req.user.role === 'ADMIN' ? {} : { members: { some: { userId: req.user.id } } },
      take: 100,
    });
  }
  @Post('institutions')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Kurum oluştur' })
  institution(@Body() body: unknown) {
    return this.db.institution.create({
      data: z
        .object({ name: z.string().trim().min(3).max(200) })
        .strict()
        .parse(body),
    });
  }
  @Get('users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Hesap başvuruları ve kullanıcı yönetimi' })
  users(@Query('page') page: string) {
    return this.db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        minor: true,
        memberships: { include: { institution: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(page),
    });
  }
  @Put('users/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rol, etkinlik ve kurum üyeliği değiştir' })
  async user(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = z
      .object({ role: roleSchema, active: z.boolean(), institutionId: z.string().uuid().optional() })
      .strict()
      .parse(body);
    if (id === req.user.id && (input.role !== 'ADMIN' || !input.active))
      throw new ConflictException('Kendi yönetici yetkinizi kaldıramazsınız.');
    return this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: z.string().uuid().parse(id) },
        data: { role: input.role, active: input.active },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      if (input.institutionId)
        await tx.userInstitution.upsert({
          where: { userId_institutionId: { userId: id, institutionId: input.institutionId } },
          create: { userId: id, institutionId: input.institutionId },
          update: {},
        });
      await tx.applicationAuditLog.create({
        data: {
          actorId: req.user.id,
          action: 'USER_AUTHORIZATION_CHANGED',
          objectId: id,
          metadata: { role: input.role, active: input.active },
        },
      });
      return { message: 'Kullanıcı yetkileri güncellendi.' };
    });
  }
  @Get('verifier/mentors')
  @Roles('ADMIN', 'VERIFIER')
  @ApiOperation({ summary: 'Yetki kapsamındaki mentor doğrulamaları' })
  mentorQueue(@Req() req: AuthRequest) {
    return this.db.mentorProfile.findMany({
      where:
        req.user.role === 'ADMIN'
          ? {}
          : {
              user: {
                memberships: {
                  some: { institutionId: { in: req.user.memberships.map((m) => m.institutionId) } },
                },
              },
            },
      include: { user: { select: { id: true, name: true } } },
      take: 100,
    });
  }
  @Post('verifier/mentors/:id')
  @Roles('ADMIN', 'VERIFIER')
  @ApiOperation({ summary: 'Kurum yetkisiyle mentor durumunu doğrula' })
  async verifyMentor(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const { verified } = z.object({ verified: z.boolean() }).strict().parse(body);
    if (!(await this.mentorQueue(req)).some((m) => m.userId === id))
      throw new NotFoundException('Mentor bulunamadı.');
    return this.db.$transaction(async (tx) => {
      const m = await tx.mentorProfile.update({
        where: { userId: id },
        data: { verified, verifiedBy: req.user.id, verifiedAt: new Date() },
      });
      await tx.applicationAuditLog.create({
        data: { actorId: req.user.id, action: 'MENTOR_VERIFICATION', objectId: id, metadata: { verified } },
      });
      return m;
    });
  }
  @Get('privacy')
  @ApiOperation({ summary: 'Gizlilik ayarları ve izin geçmişi' })
  async privacy(@Req() req: AuthRequest) {
    const value = await this.db.privacyPreference.findUnique({ where: { userId: req.user.id } });
    return {
      settings: value?.settings || privateDefaults,
      consents: await this.db.consentRecord.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    };
  }
  @Put('privacy')
  @ApiOperation({ summary: 'Alan bazında görünürlük ayarlarını kaydet' })
  async savePrivacy(@Req() req: AuthRequest, @Body() body: unknown) {
    const settings = privacySchema.parse(body);
    return this.db.$transaction(async (tx) => {
      const p = await tx.privacyPreference.upsert({
        where: { userId: req.user.id },
        create: { userId: req.user.id, settings },
        update: { settings },
      });
      await tx.applicationAuditLog.create({
        data: { actorId: req.user.id, action: 'PRIVACY_CHANGED', metadata: {} },
      });
      return p;
    });
  }
  @Post('privacy/consent')
  @ApiOperation({ summary: 'İzin ver veya geri çek' })
  async consent(@Req() req: AuthRequest, @Body() body: unknown) {
    const input = z
      .object({ type: z.enum(['MATCHING', 'PUBLIC_SHARE']), granted: z.boolean() })
      .strict()
      .parse(body);
    return this.db.$transaction(async (tx) => {
      const c = await tx.consentRecord.create({
        data: { userId: req.user.id, actorId: req.user.id, policyVersion: '1.0', ...input },
      });
      if (input.type === 'MATCHING' && !input.granted)
        await tx.mentorRecommendation.deleteMany({ where: { studentId: req.user.id } });
      await tx.applicationAuditLog.create({
        data: {
          actorId: req.user.id,
          action: input.granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
          metadata: { type: input.type },
        },
      });
      return c;
    });
  }
  @Get('network')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Gerçek RPC düğüm sağlık ölçümleri' })
  async network() {
    const nodes = await this.chain.manager.health();
    for (const node of nodes)
      await this.db.blockchainNodeHealth.upsert({
        where: { url: node.name },
        create: { url: node.name, state: node },
        update: { state: node },
      });
    const validators = Math.max(0, ...nodes.map((n) => n.validators || 0));
    return {
      mode: process.env.CHAIN_MODE || 'single',
      chainId: this.chain.manager.chainId,
      nodes,
      validators,
      warning:
        validators < 2
          ? 'Geliştirme ağı — 1 doğrulayıcı — Bizans hata toleransı sağlanmaz.'
          : nodes.filter((n) => n.online).length < 4
            ? 'Dört sağlıklı doğrulayıcı uç noktası doğrulanamadı. Ağ dayanıklılığı garanti edilemez.'
            : null,
    };
  }
  @Get('blockchain/jobs')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Blokzincir iş kuyruğu' })
  jobs(@Query('page') page: string) {
    return this.db.blockchainOutbox.findMany({
      include: { transactions: { select: { hash: true, blockNumber: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(page),
    });
  }
  @Post('blockchain/jobs/:id/retry')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Başarısız işi aynı imzalı işlemle güvenle yeniden dene' })
  async retry(@Req() req: AuthRequest, @Param('id') id: string) {
    const job = await this.db.blockchainOutbox.findUnique({ where: { id } });
    if (!job || job.status !== 'FAILED')
      throw new ConflictException('Yalnızca başarısız işler yeniden denenebilir.');
    await this.db.blockchainOutbox.update({
      where: { id },
      data: { status: 'RETRYING', attempts: 0, nextAttemptAt: new Date() },
    });
    await this.db.applicationAuditLog.create({
      data: { actorId: req.user.id, action: 'OUTBOX_MANUAL_RETRY', objectId: id, metadata: {} },
    });
    return { message: 'İş yeniden kuyruğa alındı.' };
  }
  @Get('audit')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Uygulama denetim geçmişi' })
  audit(@Query('page') page: string) {
    return this.db.applicationAuditLog.findMany({ orderBy: { createdAt: 'desc' }, ...pageArgs(page) });
  }
  @Get('reports')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Güvenlik bildirimleri' })
  reports() {
    return this.db.conversationReport.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
  @Get('settings/weights')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Öneri ağırlıkları' })
  async weights() {
    return (
      (await this.db.applicationSetting.findUnique({ where: { key: 'MATCHER_WEIGHTS' } }))?.value ||
      defaultWeights
    );
  }
  @Put('settings/weights')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Toplamı bir olan öneri ağırlıklarını ayarla' })
  saveWeights(@Body() body: unknown) {
    const value = weightsSchema.parse(body);
    return this.db.applicationSetting.upsert({
      where: { key: 'MATCHER_WEIGHTS' },
      create: { key: 'MATCHER_WEIGHTS', value },
      update: { value },
    });
  }
}
