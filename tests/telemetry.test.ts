import { describe, it, expect, vi, afterEach } from 'vitest';
import { Telemetry, stats } from '../apps/api/src/telemetry';
import { comparison, MonitorService } from '../apps/api/src/monitor.service';
import { csvCell } from '../apps/api/src/telemetry.controller';

afterEach(() => vi.unstubAllEnvs());
describe('passive research telemetry', () => {
  it('keeps missing comparisons distinct from agreement', () => {
    expect(comparison(['0xa', '0xa', null])).toBe('INSUFFICIENT_DATA');
    expect(comparison(['0xa'])).toBe('INSUFFICIENT_DATA');
    expect(comparison(['0xa', '0xb'])).toBe('MISMATCH');
    expect(comparison(['0xa', '0xb', null])).toBe('MISMATCH');
    expect(comparison(['0xa', '0xa'])).toBe('MATCH');
    expect(stats([]).mean).toBeNull();
    expect(stats([1, 2, 3, 100])).toMatchObject({ median: 2.5, p95: 100 });
  });
  it('isolates persistence failures and retries observations with the same ids', async () => {
    const createMany = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue({ count: 1 });
    const t = new Telemetry({ telemetryEvent: { createMany } } as any);
    t.record('test', { value: 1 });
    await expect(t.flush()).resolves.toBeUndefined();
    await t.flush();
    expect(createMany.mock.calls[0][0].data[0].id).toBe(createMany.mock.calls[1][0].data[0].id);
    expect(createMany.mock.calls[1][0].skipDuplicates).toBe(true);
  });
  it('can disable collection entirely', async () => {
    vi.stubEnv('TELEMETRY_ENABLED', 'false');
    const createMany = vi.fn();
    const t = new Telemetry({ telemetryEvent: { createMany } } as any);
    t.record('test', {});
    t.request(5, 500);
    await t.flush();
    expect(createMany).not.toHaveBeenCalled();
    expect(t.takeHttp().requests).toBe(0);
  });
  it('bounds buffering and reports lost observations', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 500 });
    const t = new Telemetry({ telemetryEvent: { createMany } } as any);
    for (let i = 0; i < 5010; i++) t.record('test', {});
    for (let i = 0; i < 12; i++) await t.flush();
    const rows = createMany.mock.calls.flatMap((c) => c[0].data);
    expect(rows.some((r: any) => r.kind === 'collector.dropped')).toBe(true);
  });
  it('compares the same height, detects recovery, and does not overlap polls', async () => {
    const events: any[] = [];
    const telemetry = {
      enabled: true,
      record: (kind: string, data: any) => events.push({ kind, data }),
      flush: vi.fn().mockResolvedValue(undefined),
      takeHttp: () => ({ requests: 0 }),
    };
    const db = {
      blockchainOutbox: {
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      recordVersion: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const m = new MonitorService(db as any, {} as any, telemetry as any, {} as any);
    m.manager.providers.forEach((p) => p.destroy());
    const getBlock = vi.fn().mockResolvedValue({ hash: '0xa' });
    (m.manager as any).providers = [
      { getBlock, destroy() {} },
      { getBlock, destroy() {} },
    ];
    const healthy = [
      { name: 'one', online: true, block: 10 },
      { name: 'two', online: true, block: 12 },
    ];
    m.manager.health = vi
      .fn()
      .mockResolvedValueOnce(healthy)
      .mockResolvedValueOnce([healthy[0], { name: 'two', online: false }])
      .mockResolvedValue(healthy);
    const a = m.tick(),
      b = m.tick();
    expect(a).toBe(b);
    await a;
    expect(getBlock).toHaveBeenCalledWith(10);
    expect(getBlock).not.toHaveBeenCalledWith(12);
    await m.tick();
    await m.tick();
    expect(events.some((e) => e.kind === 'network.node' && e.data.recoveryObservedMs !== null)).toBe(true);
    expect(
      events.some((e) => e.kind === 'network.consistency' && e.data.status === 'INSUFFICIENT_DATA'),
    ).toBe(true);
    await m.onModuleDestroy();
  });
  it('escapes spreadsheet formulas in exports', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
