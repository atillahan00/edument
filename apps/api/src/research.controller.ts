import { Controller, Get, Post, Param, Query, Body, Res, Inject, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { Roles } from './security';
import { ResearchService } from './research.service';
import { Database } from './db';
@ApiTags('Araştırma laboratuvarı')
@Roles('ADMIN')
@Controller('research')
export class ResearchController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(ResearchService) private research: ResearchService,
  ) {}
  @Get()
  @ApiOperation({ summary: 'Ölçülmüş deney sonuçlarını listele' })
  list() {
    return this.db.experiment.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
  @Post()
  @ApiOperation({ summary: 'Gerçek yerel ölçümlerle deney çalıştır' })
  run(@Body() body: unknown) {
    const input = z
      .object({
        kind: z.enum(['INTEGRITY', 'DOCUMENT', 'VERSIONS', 'OVERHEAD', 'MULTI', 'MATCHING']),
        samples: z.number().int().min(1).max(10).default(5),
        seed: z.number().int().min(0).max(2147483647).default(2204),
      })
      .strict()
      .parse(body);
    return this.research.run(input.kind, input.samples, input.seed);
  }
  @Get(':id/export')
  @ApiOperation({ summary: 'Deney yapılandırmasını ve ölçümlerini JSON veya CSV indir' })
  async export(@Param('id') id: string, @Query('format') format: string, @Res() res: Response) {
    const row = await this.db.experiment.findUnique({ where: { id: z.string().uuid().parse(id) } });
    if (!row) throw new NotFoundException('Deney bulunamadı.');
    res.setHeader('Content-Disposition', `attachment; filename="deney.${format === 'csv' ? 'csv' : 'json'}"`);
    if (format === 'csv') {
      const quote = (v: unknown) => '"' + String(v).replace(/"/g, '""') + '"';
      res
        .type('text/csv; charset=utf-8')
        .send(
          '\uFEFFad,tarih,tur,yapilandirma,sonuc\n' +
            [
              row.name,
              row.createdAt.toISOString(),
              row.kind,
              JSON.stringify(row.config),
              JSON.stringify(row.result),
            ]
              .map(quote)
              .join(','),
        );
    } else res.json(row);
  }
}
