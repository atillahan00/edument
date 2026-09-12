import { describe, it, expect, vi } from 'vitest';
import { BlockchainProviderManager } from '../apps/api/src/blockchain/provider';
const provider = (chain = 1337, genesis = '0xabc', offline = false) => ({
  send: vi.fn(async (method: string) => {
    if (offline) throw new Error('offline');
    return method === 'eth_chainId'
      ? '0x' + chain.toString(16)
      : method === 'qbft_getValidatorsByBlockNumber'
        ? ['one']
        : method === 'eth_blockNumber'
          ? '0x2'
          : '0x0';
  }),
  getBlock: vi.fn(async () => ({ hash: genesis })),
  destroy: vi.fn(),
});
describe('RPC chain boundaries', () => {
  it('fails over reads to a validated healthy node', async () => {
    const m = new BlockchainProviderManager(['http://localhost:1', 'http://localhost:2'], 1337);
    m.providers.forEach((p) => p.destroy());
    (m as any).providers = [provider(1337, '0xabc', true), provider()];
    expect(await m.read(async () => 42)).toBe(42);
    expect(m.states[0].online).toBe(false);
    m.destroy();
  });
  it('rejects differing chain ids', async () => {
    const m = new BlockchainProviderManager(['http://localhost:1'], 1337);
    m.providers.forEach((p) => p.destroy());
    (m as any).providers = [provider(1338)];
    await expect(m.read(async () => 42)).rejects.toThrow();
    m.destroy();
  });
  it('stops all endpoints with same chain id but different genesis', async () => {
    const m = new BlockchainProviderManager(['http://localhost:1', 'http://localhost:2'], 1337);
    m.providers.forEach((p) => p.destroy());
    (m as any).providers = [provider(), provider(1337, '0xdef')];
    await m.health();
    expect(m.states.every((n) => !n.online)).toBe(true);
    m.destroy();
  });
  it('does not silently move the signer to another RPC', async () => {
    const m = new BlockchainProviderManager(['http://localhost:1', 'http://localhost:2'], 1337);
    m.providers.forEach((p) => p.destroy());
    (m as any).providers = [provider(1337, '0xabc', true), provider()];
    await expect(m.write()).rejects.toThrow();
    m.destroy();
  });
});
