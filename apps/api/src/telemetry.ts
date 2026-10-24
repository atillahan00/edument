import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from './db';

export function setting(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}
export function stats(values: number[]) {
  if (!values.length) return { count: 0, mean: null, median: null, p95: null };
  const a = [...values].sort((x, y) => x - y);
  return {
    count: a.length,
    mean: a.reduce((x, y) => x + y, 0) / a.length,
    median: a.length % 2 ? a[Math.floor(a.length / 2)] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2,
    p95: a[Math.ceil(a.length * 0.95) - 1],
  };
}
type Observation = {
  id: string;
  observedAt: Date;
  environment: string;
  runId: string;
  chainId: number;
  kind: string;
  data: any;
};
@Injectable()
export class Telemetry implements OnModuleInit, OnModuleDestroy {
  readonly enabled = process.env.TELEMETRY_ENABLED !== 'false';
  readonly runId = randomUUID();
  readonly environment = process.env.TELEMETRY_ENVIRONMENT || 'local';
  private buffer: Observation[] = [];
  private dropped = 0;
  private flushing?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private http: number[] = [];
  private requests = 0;
  private errors = 0;
  constructor(@Inject(Database) private db: Database) {}
  onModuleInit() {
    if (!this.enabled) return;
    this.record('collector.started', {
      node: process.version,
      codeVersion: process.env.APP_VERSION || 'unspecified',
      intervalMs: setting('TELEMETRY_INTERVAL_MS', 60000, 10000, 3600000),
      integrityIntervalMs: setting('TELEMETRY_INTEGRITY_INTERVAL_MS', 3600000, 60000, 86400000),
      note: 'Observer times, not consensus timestamps. Missing observations are unknown, not uptime.',
    });
    this.timer = setInterval(() => {
      void this.flush();
    }, 5000);
    this.timer.unref();
  }
  record(kind: string, data: Record<string, unknown>) {
    if (!this.enabled) return;
    if (this.buffer.length >= 5000) {
      this.dropped++;
      return;
    }
    this.buffer.push({
      id: randomUUID(),
      observedAt: new Date(),
      environment: this.environment,
      runId: this.runId,
      chainId: Number(process.env.CHAIN_ID || 1337),
      kind,
      data,
    });
  }
  request(ms: number, status: number) {
    if (!this.enabled) return;
    this.requests++;
    if (status >= 500) this.errors++;
    if (this.http.length < 10000) this.http.push(ms);
  }
  takeHttp() {
    const result = {
      requests: this.requests,
      serverErrors: this.errors,
      latencyMs: stats(this.http),
      latencySampleTruncated: this.requests > this.http.length,
    };
    this.requests = 0;
    this.errors = 0;
    this.http = [];
    return result;
  }
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.write().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }
  private async write() {
    const batch = this.buffer.splice(0, 500);
    if (this.dropped) {
      const count = this.dropped;
      this.dropped = 0;
      this.record('collector.dropped', { count });
    }
    if (!batch.length) return;
    try {
      await this.db.telemetryEvent.createMany({ data: batch, skipDuplicates: true });
    } catch {
      const combined = [...batch, ...this.buffer];
      this.dropped += Math.max(0, combined.length - 5000);
      this.buffer = combined.slice(0, 5000);
      console.error(JSON.stringify({ event: 'telemetry.persistence_failed', buffered: this.buffer.length }));
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.record('collector.stopped', {});
    await this.flush();
  }
  async beforeApplicationShutdown() {
    // Monitor destruction has completed. Drain without looping forever on database failure.
    for (let i = 0; i < 12 && this.buffer.length; i++) {
      const before = this.buffer.length;
      await this.flush();
      if (this.buffer.length >= before) break;
    }
  }
}
