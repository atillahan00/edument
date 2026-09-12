import { Injectable, Inject, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Contract, Wallet, ZeroHash, id } from 'ethers';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Database } from './db';
import { ChainService, registryAbi } from './blockchain/service';
import { contractAddress, required } from './config';
import { hashRecord, sha256 } from './hash';
import { pollReceipt } from './blockchain/receipt';
export function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median:
      sorted.length % 2
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)],
  };
}
@Injectable()
export class ResearchService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(ChainService) private chain: ChainService,
  ) {}
  async run(kind: string, samples = 5, seed = 2204) {
    if (kind === 'MATCHING') {
      try {
        const response = await fetch(
          `${process.env.MATCHER_SERVICE_URL || 'http://127.0.0.1:8000'}/research`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seed, samples }),
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!response.ok) throw new Error('MATCHER');
        const result = (await response.json()) as any;
        return this.db.experiment.create({
          data: {
            name: 'Mentor sıralama karşılaştırması',
            kind,
            config: { seed, samples, mode: process.env.CHAIN_MODE || 'single' },
            result,
          },
        });
      } catch {
        throw new ServiceUnavailableException('Araştırma hizmetine ulaşılamadı.');
      }
    }
    const nodes = await this.chain.manager.health();
    if (
      kind === 'MULTI' &&
      (process.env.CHAIN_MODE !== 'multi' || nodes.filter((n) => n.online && n.validators === 4).length < 4)
    )
      throw new ConflictException('Deney kullanılamıyor — dört doğrulayıcılı ağ etkin değil.');
    if (!nodes.some((n) => n.online))
      throw new ServiceUnavailableException('Deney için gerçek blokzincir bağlantısı gerekiyor.');
    const experimentId = randomUUID();
    const dbTimes: number[] = [];
    const chainTimes: number[] = [];
    const proofs: any[] = [];
    // Research uses the same global signer lock as outbox; no nonce races.
    await this.db.$transaction(
      async (tx) => {
        const lock = await tx.$queryRaw<
          { locked: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(2204, 1) AS locked`;
        if (!lock[0].locked) throw new ConflictException('İmzalayıcı meşgul. Deneyi yeniden başlatın.');
        if (await this.db.blockchainTransaction.count({ where: { blockNumber: null } }))
          throw new ConflictException('Bekleyen imzalı işlemler sonuçlanmadan deney başlatılamaz.');
        const provider = await this.chain.manager.write();
        const wallet = new Wallet(required('BLOCKCHAIN_SIGNER_PRIVATE_KEY'), provider);
        const registry = new Contract(contractAddress(), registryAbi, wallet);
        let previous = ZeroHash;
        const subject = '0x' + randomBytes(32).toString('hex');
        for (let i = 0; i < (kind === 'VERSIONS' ? 3 : samples); i++) {
          const snapshot = {
            experiment: experimentId,
            seed,
            index: i,
            value: `Sentetik araştırma ${seed + i}`,
          };
          const hash = hashRecord(snapshot);
          const start = performance.now();
          await this.db.experimentSample.create({ data: { experimentId, content: snapshot } });
          dbTimes.push(performance.now() - start);
          const recordId = '0x' + randomBytes(32).toString('hex');
          const bytes = Buffer.from(`BILSEM araştırma belgesi ${seed} ${i}`);
          const documentHash = kind === 'DOCUMENT' ? sha256(bytes) : ZeroHash;
          const chainStart = performance.now();
          const transaction = await registry.anchor(
            recordId,
            subject,
            id('RESEARCH'),
            hash,
            documentHash,
            kind === 'VERSIONS' ? previous : ZeroHash,
            kind === 'VERSIONS' ? i + 1 : 1,
            { gasPrice: 0, gasLimit: 800000 },
          );
          const receipt = await pollReceipt(provider, transaction.hash, 30000);
          if (!receipt || receipt.status !== 1) throw new Error('Deney işlemi onaylanmadı.');
          chainTimes.push(performance.now() - chainStart);
          const record = await registry.getRecord(recordId);
          const altered = Buffer.from(bytes);
          altered[0] ^= 1;
          proofs.push({
            recordId,
            transactionHash: transaction.hash,
            blockNumber: receipt.blockNumber,
            originalValid: record.contentHash === hashRecord(snapshot),
            modifiedDetected:
              record.contentHash !== hashRecord({ ...snapshot, value: 'Değiştirilmiş kopya' }),
            ...(kind === 'DOCUMENT'
              ? {
                  documentOriginalValid: record.documentHash === sha256(bytes),
                  documentModificationDetected: record.documentHash !== sha256(altered),
                }
              : {}),
          });
          previous = recordId;
        }
        if (kind === 'VERSIONS')
          for (const proof of proofs) {
            const record = await registry.getRecord(proof.recordId);
            proof.chainStatus = Number(record.status);
            proof.version = Number(record.version);
          }
      },
      { timeout: 180000, maxWait: 5000 },
    );
    const result = {
      databaseMs: summarize(dbTimes),
      blockchainMs: summarize(chainTimes),
      combinedMeanMs: summarize(dbTimes).mean + summarize(chainTimes).mean,
      successRate: proofs.length / chainTimes.length,
      transactionsPerSecond: proofs.length / (chainTimes.reduce((a, b) => a + b, 0) / 1000),
      proofs,
      nodes,
      software: { node: process.version },
      warning: 'Küçük, sıralı yerel yük ölçümü; genel performans veya merkeziyetsizlik kanıtı değildir.',
    };
    return this.db.experiment.create({
      data: {
        id: experimentId,
        name: 'Bütünlük ve blokzincir ölçümü',
        kind,
        config: {
          seed,
          samples: proofs.length,
          mode: process.env.CHAIN_MODE || 'single',
          chainId: this.chain.manager.chainId,
        },
        result,
      },
    });
  }
}
