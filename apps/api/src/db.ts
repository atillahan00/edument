import './config';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
@Injectable()
export class Database extends PrismaClient implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
