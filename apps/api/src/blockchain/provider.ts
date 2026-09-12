import { JsonRpcProvider, FetchRequest } from 'ethers';
export type NodeState = {
  name: string;
  url: string;
  online: boolean;
  chainId?: number;
  block?: number;
  peers?: number;
  validators?: number;
  latencyMs: number;
  checkedAt: string;
  lastSuccessAt?: string;
  error?: string;
  genesis?: string;
};
export class BlockchainProviderManager {
  readonly providers: JsonRpcProvider[];
  states: NodeState[] = [];
  constructor(
    readonly urls: string[],
    readonly chainId: number,
    readonly writeUrl: string = urls[0],
    readonly expectedGenesis?: string,
  ) {
    if (!urls.length || !urls.includes(writeUrl))
      throw new Error('Yazma düğümü yapılandırılmış uç noktalardan biri olmalıdır.');
    this.providers = urls.map((url) => {
      const request = new FetchRequest(url);
      request.timeout = 5000;
      return new JsonRpcProvider(request, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
    });
  }
  async health() {
    this.states = await Promise.all(
      this.providers.map(async (provider, i) => {
        const start = Date.now();
        const url = new URL(this.urls[i]);
        const state: NodeState = {
          name: `Düğüm ${i + 1}`,
          url: url.origin,
          online: false,
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
          lastSuccessAt: this.states[i]?.lastSuccessAt,
        };
        try {
          const [id, block, genesis] = await Promise.all([
            provider.send('eth_chainId', []),
            provider.send('eth_blockNumber', []),
            provider.getBlock(0),
          ]);
          state.chainId = Number(id);
          state.block = Number(block);
          state.genesis = genesis?.hash || undefined;
          if (
            state.chainId !== this.chainId ||
            !state.genesis ||
            (this.expectedGenesis && state.genesis !== this.expectedGenesis)
          )
            throw new Error('CHAIN_MISMATCH');
          const [peers, validators] = await Promise.allSettled([
            provider.send('net_peerCount', []),
            provider.send('qbft_getValidatorsByBlockNumber', ['latest']),
          ]);
          if (peers.status === 'fulfilled') state.peers = Number(peers.value);
          if (validators.status === 'fulfilled') state.validators = validators.value.length;
          state.online = true;
          state.lastSuccessAt = state.checkedAt;
        } catch {
          state.error = 'Düğüm kullanılamıyor veya ağ kimliği uyuşmuyor.';
        }
        state.latencyMs = Date.now() - start;
        return state;
      }),
    );
    const genesis = new Set(this.states.filter((s) => s.online).map((s) => s.genesis));
    if (genesis.size > 1)
      this.states = this.states.map((s) => ({
        ...s,
        online: false,
        error: 'Farklı başlangıç blokları algılandı. Ağ bağlantısı durduruldu.',
      }));
    return this.states;
  }
  async read<T>(operation: (provider: JsonRpcProvider) => Promise<T>): Promise<T> {
    await this.health();
    const order = this.providers
      .map((_, i) => i)
      .sort((a, b) => (this.states[b].block || 0) - (this.states[a].block || 0));
    for (const i of order) {
      if (!this.states[i]?.online) continue;
      try {
        return await operation(this.providers[i]);
      } catch {
        /* Try another validated endpoint. */
      }
    }
    throw new Error('Sağlıklı blokzincir düğümüne erişilemiyor.');
  }
  async write() {
    await this.health();
    const index = this.urls.indexOf(this.writeUrl);
    if (!this.states[index]?.online) throw new Error('Yazma düğümü kullanılamıyor. İşlem kuyrukta tutuldu.');
    return this.providers[index];
  }
  destroy() {
    this.providers.forEach((p) => p.destroy());
  }
}
