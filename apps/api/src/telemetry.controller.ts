import { Controller, Get, Query, Res, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Response } from 'express';
import { Database } from './db';
import { Roles } from './security';
import { Telemetry } from './telemetry';

export function csvCell(value: unknown) {
  let s = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
@ApiTags('Otomatik ölçümler')
@Roles('ADMIN')
@Controller('telemetry')
export class TelemetryController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(Telemetry) private telemetry: Telemetry,
  ) {}
  @Get('status')
  async status() {
    return {
      enabled: this.telemetry.enabled,
      environment: this.telemetry.environment,
      latest: await this.db.telemetryEvent.findFirst({
        where: { environment: this.telemetry.environment },
        orderBy: { observedAt: 'desc' },
      }),
      warning: 'Ölçüm boşlukları bilinmeyendir. Bu sunucunun kapanmasını dış izleyiciyle ölçün.',
    };
  }
  @Get('daily')
  async daily(@Query() query: unknown) {
    const input = z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        environment: z.string().max(100).optional(),
      })
      .parse(query);
    const from = new Date(input.from),
      to = new Date(input.to);
    if (to <= from || +to - +from > 93 * 86400000) z.literal(true).parse(false);
    const environment = input.environment || this.telemetry.environment;
    const days = await this.db.$queryRaw`
      SELECT to_char("observedAt", 'YYYY-MM-DD') AS "dayUTC",
        count(*)::int AS "observations",
        count(*) FILTER (WHERE kind = 'transaction.confirmed')::int AS "confirmationEvents",
        count(*) FILTER (WHERE kind = 'transaction.failed')::int AS "failureEvents",
        count(*) FILTER (WHERE kind = 'transaction.retry')::int AS "retryEvents",
        count(*) FILTER (WHERE kind = 'network.node')::int AS "nodeObservations",
        count(*) FILTER (WHERE kind = 'network.node' AND data->>'online' = 'false')::int AS "unreachableObservations",
        count(*) FILTER (WHERE kind = 'integrity.sample' AND data->>'state' = 'VALID')::int AS "validChecks",
        count(*) FILTER (WHERE kind = 'integrity.sample' AND data->>'state' = 'MISMATCH')::int AS "mismatchChecks",
        count(*) FILTER (WHERE kind = 'integrity.sample' AND data->>'state' = 'ERROR')::int AS "unavailableChecks",
        count(*) FILTER (WHERE kind = 'collector.error' OR kind = 'collector.dropped')::int AS "collectionWarnings",
        avg((data->>'totalMs')::double precision) FILTER (WHERE kind = 'transaction.confirmed') AS "meanTotalMs",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY (data->>'totalMs')::double precision)
          FILTER (WHERE kind = 'transaction.confirmed') AS "medianTotalMs",
        percentile_cont(0.95) WITHIN GROUP (ORDER BY (data->>'totalMs')::double precision)
          FILTER (WHERE kind = 'transaction.confirmed') AS "p95TotalMs"
      FROM "TelemetryEvent"
      WHERE environment = ${environment}
        AND "observedAt" >= ${from.toISOString()}::timestamp
        AND "observedAt" < ${to.toISOString()}::timestamp
      GROUP BY to_char("observedAt", 'YYYY-MM-DD') ORDER BY "dayUTC"`;
    return {
      environment,
      from,
      to,
      days,
      notes: [
        'UTC, half-open date range; days without observations are unknown, not healthy.',
        'Event counts are not an arrival-cohort success rate. Pending jobs and observation gaps must be analyzed separately.',
        'Confirmation times are when the API observes receipts; resource CPU is API process only.',
      ],
    };
  }
  @Get('export')
  async export(@Query() query: unknown, @Res() res: Response) {
    const input = z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        environment: z.string().min(1).max(100).optional(),
        format: z.enum(['csv', 'json']).default('csv'),
      })
      .parse(query);
    const from = new Date(input.from),
      to = new Date(input.to);
    if (to <= from || +to - +from > 93 * 86400000) z.literal(true).parse(false);
    res.setHeader('Content-Disposition', `attachment; filename="telemetry.${input.format}"`);
    res.type(input.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json');
    const columns = ['id', 'observedAt', 'environment', 'runId', 'chainId', 'kind', 'metric', 'value'];
    res.write(input.format === 'csv' ? '\uFEFF' + columns.join(',') + '\n' : '[');
    let cursor: string | undefined,
      first = true;
    try {
      for (;;) {
        const rows = await this.db.telemetryEvent.findMany({
          where: {
            environment: input.environment || this.telemetry.environment,
            observedAt: { gte: from, lt: to },
          },
          orderBy: [{ observedAt: 'asc' }, { id: 'asc' }],
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!rows.length) break;
        for (const row of rows) {
          if (res.destroyed) return;
          let text: string;
          if (input.format === 'json') {
            text = (first ? '' : ',') + JSON.stringify(row);
            first = false;
          } else
            text =
              Object.entries(row.data as Record<string, unknown>)
                .map(([metric, value]) =>
                  [
                    row.id,
                    row.observedAt.toISOString(),
                    row.environment,
                    row.runId,
                    row.chainId,
                    row.kind,
                    metric,
                    value,
                  ]
                    .map(csvCell)
                    .join(','),
                )
                .join('\n') + '\n';
          if (!res.write(text))
            await new Promise<void>((resolve) => {
              const done = () => {
                res.off('drain', done);
                res.off('close', done);
                resolve();
              };
              res.once('drain', done);
              res.once('close', done);
            });
        }
        cursor = rows[rows.length - 1].id;
      }
      res.end(input.format === 'json' ? ']' : '');
    } catch {
      res.destroy();
    }
  }
}
