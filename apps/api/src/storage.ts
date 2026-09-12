import { Injectable, BadRequestException } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import { required } from './config';
import { sha256 } from './hash';
export function validateFile(file: Express.Multer.File) {
  if (!file || !file.buffer || file.size > 10 * 1024 * 1024 || file.size === 0)
    throw new BadRequestException('En fazla 10 MB boyutunda PDF, PNG veya JPEG yükleyin.');
  const bytes = file.buffer;
  const mime =
    bytes.subarray(0, 5).toString() === '%PDF-'
      ? 'application/pdf'
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'image/png'
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? 'image/jpeg'
          : null;
  if (!mime || mime !== file.mimetype) throw new BadRequestException('Dosyanın içeriği ve türü uyuşmuyor.');
  return mime;
}
@Injectable()
export class StorageService {
  private client?: Client;
  private get s3() {
    return (this.client ??= new Client({
      endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_TLS === 'true',
      accessKey: required('MINIO_ACCESS_KEY'),
      secretKey: required('MINIO_SECRET_KEY'),
    }));
  }
  get bucket() {
    return process.env.MINIO_BUCKET || 'evidence';
  }
  async put(file: Express.Multer.File) {
    const mime = validateFile(file);
    if (!(await this.s3.bucketExists(this.bucket))) await this.s3.makeBucket(this.bucket);
    const objectKey = randomUUID();
    await this.s3.putObject(this.bucket, objectKey, file.buffer, file.size, { 'Content-Type': mime });
    return { objectKey, mime, size: file.size, hash: sha256(file.buffer) };
  }
  async read(key: string) {
    return this.s3.getObject(this.bucket, key);
  }
  async remove(key: string) {
    await this.s3.removeObject(this.bucket, key);
  }
}
