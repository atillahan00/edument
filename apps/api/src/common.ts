import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { ZodError } from 'zod';
import type { Response, Request } from 'express';
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = error instanceof ZodError ? 400 : error instanceof HttpException ? error.getStatus() : 500;
    const message =
      error instanceof ZodError
        ? 'Bilgileri kontrol edin. Geçersiz veya eksik alan bulunuyor.'
        : error instanceof HttpException && typeof error.getResponse() === 'string'
          ? error.message
          : status === 413
            ? 'Dosya boyutu sınırı aşıldı.'
            : status === 404
              ? 'Kayıt bulunamadı.'
              : 'İşlem tamamlanamadı. Lütfen yeniden deneyin.';
    if (status >= 500)
      console.error(
        JSON.stringify({
          level: 'error',
          requestId: response.getHeader('X-Request-Id'),
          path: request.path,
          error: error instanceof Error ? error.name : 'Unknown',
          frames: error instanceof Error ? error.stack?.split('\n').slice(1, 5) : [],
        }),
      );
    response.status(status).json({ error: { message, requestId: response.getHeader('X-Request-Id') } });
  }
}
export const pageArgs = (page?: string) => ({
  take: 50,
  skip: Math.max(0, Math.min(10000, Number(page) || 0)) * 50,
});
