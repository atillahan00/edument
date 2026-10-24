import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  Res,
  Inject,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { Database } from './db';
import { Public, AuthRequest } from './security';
import { sha256 } from './hash';
import { loginSchema, registrationSchema, privateDefaults } from '../../../packages/shared/src';
@ApiTags('Kimlik doğrulama')
@Controller('auth')
export class AuthController {
  constructor(@Inject(Database) private db: Database) {}
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Öğrenci veya mentor hesabı başvurusu oluştur' })
  async register(@Body() body: unknown) {
    const input = registrationSchema.parse(body);
    if (await this.db.user.findUnique({ where: { email: input.email } }))
      throw new ConflictException('Bu bilgilerle başvuru yapılamadı.');
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });
    const userId = randomUUID();
    await this.db.user.create({
      data: {
        id: userId,
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        minor: input.minor,
        privacy: { create: { settings: privateDefaults } },
        consent: {
          create: {
            actorId: userId,
            type: 'TERMS',
            policyVersion: '1.0',
            granted: true,
          },
        },
      },
    });
    return { message: 'Başvurunuz alındı. Kurum yöneticisinin hesabınızı etkinleştirmesi gerekiyor.' };
  }
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Güvenli oturum aç' })
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = loginSchema.parse(body);
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password)) || !user.active)
      throw new UnauthorizedException('E-posta veya parola hatalı ya da hesabınız henüz etkinleştirilmedi.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.db.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt } });
    response.cookie('edument_session', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
    });
    return { id: user.id, name: user.name, role: user.role };
  }
  @Get('me')
  @ApiOperation({ summary: 'Oturum ve rol bilgilerini getir' })
  me(@Req() request: AuthRequest) {
    return request.user;
  }
  @Post('logout')
  @ApiOperation({ summary: 'Oturumu geçersiz kıl' })
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    await this.db.session.deleteMany({ where: { tokenHash: sha256(request.cookies.edument_session) } });
    response.clearCookie('edument_session', { path: '/' });
    return { message: 'Oturum kapatıldı.' };
  }
}
