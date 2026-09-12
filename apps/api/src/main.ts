import 'reflect-metadata';
import './config';
import { Module } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { Database } from './db';
import { SessionGuard } from './security';
import { ErrorFilter } from './common';
import { AuthController } from './auth.controller';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { ChainService } from './blockchain/service';
import { StorageService } from './storage';
import { MentoringController } from './mentoring.controller';
import { AdminController } from './admin.controller';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';
@Module({
  controllers: [AuthController, RecordsController, MentoringController, AdminController, ResearchController],
  providers: [
    Database,
    RecordsService,
    ChainService,
    StorageService,
    ResearchService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
export async function start() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new ErrorFilter());
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Request-Id', randomUUID());
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== (process.env.APP_BASE_URL || 'http://localhost:3000'))
        return res.status(403).json({ error: { message: 'İstek kaynağına izin verilmiyor.' } });
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return res.status(403).json({ error: { message: 'Siteler arası isteğe izin verilmiyor.' } });
    }
    next();
  });
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { message: 'Çok fazla istek. Bir dakika sonra yeniden deneyin.' } },
    }),
  );
  app.use(
    ['/api/v1/auth/login', '/api/v1/auth/register'],
    rateLimit({
      windowMs: 15 * 60000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { message: 'Çok fazla giriş denemesi. Lütfen daha sonra deneyin.' } },
    }),
  );
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('BILSEM-Chain API')
        .setDescription('Kurum yetkileri, özel belgeler ve blokzincir bütünlük hizmetleri.')
        .setVersion('1.0')
        .addCookieAuth('bilsem_session')
        .build(),
    ),
  );
  const chain = app.get(ChainService);
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await chain.processOne();
    } catch {
      console.error(JSON.stringify({ level: 'error', event: 'worker.unavailable' }));
    } finally {
      busy = false;
    }
  }, 2500);
  timer.unref();
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT || 3001), '127.0.0.1');
  console.log(JSON.stringify({ level: 'info', event: 'api.started', port: process.env.API_PORT || 3001 }));
  return app;
}
if (require.main === module)
  start().catch(() => {
    console.error('API başlatılamadı. Yapılandırmayı kontrol edin.');
    process.exitCode = 1;
  });
