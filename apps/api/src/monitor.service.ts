import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { statfs } from 'node:fs/promises';
import os from 'node:os';
import { Database } from './db';
import { ChainService } from './blockchain/service';
import { BlockchainProviderManager } from './blockchain/provider';
import { StorageService } from './storage';
import { workspaceRoot } from './config';
import { Telemetry, setting } from './telemetry';

export function comparison(hashes: Array<string | null>) {
  if (new Set(hashes.filter(Boolean)).size > 1) return 'MISMATCH';
  if (hashes.length < 2 || hashes.some((h) => !h)) return 'INSUFFICIENT_DATA';
  return new Set(hashes).size === 1 ? 'MATCH' : 'MISMATCH';
}
@Injectable()
export class MonitorService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private task?: Promise<void>;
  private lastAt?: number;
  private lastIntegrity = 0;
  private cursor?: string;
  private cpu = process.cpuUsage();
  private previous = new Map<
    string,
    { online: boolean; block?: number; unchangedSince: number; offlineSince?: number }
  >();
  readonly interval = setting('TELEMETRY_INTERVAL_MS', 60000, 10000, 3600000);
  readonly manager = new BlockchainProviderManager(
    (process.env.BESU_RPC_URLS || 'http://127.0.0.1:8545').split(','),
    Number(process.env.CHAIN_ID || 1337),
    process.env.BESU_WRITE_RPC_URL,
    process.env.BESU_GENESIS_HASH,
  );
  constructor(
    @Inject(Database) private db: Database,
    @Inject(ChainService) private chain: ChainService,
    @Inject(Telemetry) private telemetry: Telemetry,
    @Inject(StorageService) private storage: StorageService,
  ) {}
  onModuleInit() {
    if (!this.telemetry.enabled) return;
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.interval);
    this.timer.unref();
  }
  tick() {
    if (this.task) return this.task;
    this.task = this.collect()
      .catch(() => {
        this.telemetry.record('collector.error', { phase: 'poll' });
      })
      .finally(async () => {
        await this.telemetry.flush();
        this.task = undefined;
      });
    return this.task;
  }
  private async collect() {
    const now = Date.now();
    const elapsed = this.lastAt ? now - this.lastAt : null;
    this.lastAt = now;
    const states = await this.manager.health();
    const online = states.filter((s) => s.online);
    const height = online.length ? Math.min(...online.map((s) => s.block!)) : null;
    const maxHeight = online.length ? Math.max(...online.map((s) => s.block!)) : null;
    const hashes = await Promise.all(
      states.map(async (s, i) => {
        if (!s.online || height === null) return null;
        try {
          return (await this.manager.providers[i].getBlock(height))?.hash ?? null;
        } catch {
          return null;
        }
      }),
    );
    for (const state of states) {
      const prev = this.previous.get(state.name);
      const offlineSince = state.online ? undefined : (prev?.offlineSince ?? now);
      const unchangedSince =
        prev?.online && state.online && prev.block === state.block ? prev.unchangedSince : now;
      this.telemetry.record('network.node', {
        name: state.name,
        online: state.online,
        block: state.block ?? null,
        peers: state.peers ?? null,
        validators: state.validators ?? null,
        genesis: state.genesis ?? null,
        latencyMs: state.latencyMs,
        lagBlocks: state.online && maxHeight !== null ? maxHeight - state.block! : null,
        unchangedMs: state.online ? now - unchangedSince : null,
        recoveryObservedMs: state.online && prev?.offlineSince ? now - prev.offlineSince : null,
        observationGapMs: elapsed,
        intervalMs: this.interval,
      });
      this.previous.set(state.name, {
        online: state.online,
        block: state.block,
        unchangedSince,
        offlineSince,
      });
    }
    this.telemetry.record('network.consistency', {
      height,
      hashes,
      status: comparison(hashes),
      comparedNodes: hashes.filter(Boolean).length,
      configuredNodes: states.length,
    });
    const usage = process.cpuUsage();
    let diskFreeBytes: number | null = null;
    try {
      const disk = await statfs(workspaceRoot);
      diskFreeBytes = disk.bavail * disk.bsize;
    } catch {
      /* unsupported filesystem */
    }
    this.telemetry.record('resources', {
      elapsedMs: elapsed,
      processCpuMs: (usage.user + usage.system - this.cpu.user - this.cpu.system) / 1000,
      processRssBytes: process.memoryUsage().rss,
      hostFreeMemoryBytes: os.freemem(),
      hostTotalMemoryBytes: os.totalmem(),
      diskFreeBytes,
      cpuScope: 'API process only',
      diskScope: 'application filesystem',
      http: this.telemetry.takeHttp(),
    });
    this.cpu = usage;
    try {
      const counts = await this.db.blockchainOutbox.groupBy({ by: ['status'], _count: { _all: true } });
      const oldest = await this.db.blockchainOutbox.findFirst({
        where: { status: { in: ['PENDING', 'SUBMITTED', 'RETRYING'] } },
        orderBy: { createdAt: 'asc' },
      });
      this.telemetry.record('queue.snapshot', {
        counts,
        oldestPendingAgeMs: oldest ? now - oldest.createdAt.getTime() : null,
      });
    } catch {
      this.telemetry.record('collector.error', { phase: 'queue' });
    }
    if (now - this.lastIntegrity >= setting('TELEMETRY_INTEGRITY_INTERVAL_MS', 3600000, 60000, 86400000)) {
      this.lastIntegrity = now;
      await this.integrity();
    }
  }
  private async integrity() {
    const take = setting('TELEMETRY_INTEGRITY_SAMPLES', 3, 1, 20);
    const where = { anchor: { chainId: this.manager.chainId } };
    let rows = await this.db.recordVersion.findMany({
      where: { ...where, ...(this.cursor ? { id: { gt: this.cursor } } : {}) },
      orderBy: { id: 'asc' },
      take,
      include: { anchor: true, evidence: true },
    });
    if (!rows.length && this.cursor) {
      this.cursor = undefined;
      rows = await this.db.recordVersion.findMany({
        where,
        orderBy: { id: 'asc' },
        take,
        include: { anchor: true, evidence: true },
      });
    }
    for (const row of rows) {
      this.cursor = row.id;
      const started = Date.now();
      const result = await this.chain.integrity(row);
      let documentState = 'NOT_CHECKED';
      if (process.env.TELEMETRY_DOCUMENT_CHECKS === 'true' && row.evidence) {
        try {
          const stream = await this.storage.read(row.evidence.objectKey);
          const timer = setTimeout(() => stream.destroy(new Error('timeout')), 10000);
          try {
            const hash = createHash('sha256');
            for await (const chunk of stream) hash.update(chunk);
            documentState = '0x' + hash.digest('hex') === row.evidence.hash ? 'MATCH' : 'MISMATCH';
          } finally {
            clearTimeout(timer);
            stream.destroy();
          }
        } catch {
          documentState = 'UNAVAILABLE';
        }
      }
      this.telemetry.record('integrity.sample', {
        recordId: row.anchor?.recordId,
        state: result.state,
        documentState,
        durationMs: Date.now() - started,
        sampling: 'rotating id order, capped; not statistical random sample',
      });
    }
    this.telemetry.record('integrity.coverage', { checked: rows.length, limit: take });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.task) await this.task;
    this.manager.destroy();
  }
}
