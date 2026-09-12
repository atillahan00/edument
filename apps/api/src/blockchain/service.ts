import { Injectable, Inject } from '@nestjs/common';
import { Contract, Interface, Wallet, ZeroHash, keccak256, id } from 'ethers';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { Database } from '../db';
import { required, contractAddress } from '../config';
import { hashRecord, subjectReference } from '../hash';
import { BlockchainProviderManager } from './provider';
import { pollReceipt } from './receipt';
export const registryAbi = [
  'function anchor(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint32)',
  'function revoke(bytes32)',
  'function getRecord(bytes32) view returns(tuple(bytes32 subjectRef,bytes32 recordType,bytes32 contentHash,bytes32 documentHash,bytes32 previousRecordId,bytes32 nextRecordId,uint32 version,address issuer,uint64 timestamp,uint8 status))',
  'event RecordAnchored(bytes32 indexed recordId,bytes32 indexed subjectRef,bytes32 contentHash,uint32 version)',
];
@Injectable()
export class ChainService {
  readonly manager = new BlockchainProviderManager(
    (process.env.BESU_RPC_URLS || 'http://127.0.0.1:8545').split(','),
    Number(process.env.CHAIN_ID || 1337),
    process.env.BESU_WRITE_RPC_URL,
    process.env.BESU_GENESIS_HASH,
  );
  constructor(@Inject(Database) readonly db: Database) {}
  async enqueue(tx: Prisma.TransactionClient, version: any, previous: any = null) {
    return tx.blockchainAnchor.create({
      data: {
        versionId: version.id,
        recordId: '0x' + randomBytes(32).toString('hex'),
        subjectRef: subjectReference(version.ownerId, required('BILSEM_PSEUDONYM_SECRET')),
        previousRecordId: previous?.recordId || ZeroHash,
        chainVersion: (previous?.chainVersion || 0) + 1,
        chainId: Number(process.env.CHAIN_ID || 1337),
        contractAddress: contractAddress(),
        publicToken: randomBytes(32).toString('base64url'),
        jobs: { create: {} },
      },
    });
  }
  async getRecord(anchor: { recordId: string; chainId: number; contractAddress: string }) {
    if (anchor.chainId !== this.manager.chainId) throw new Error('Kayıt farklı bir ağa ait.');
    return this.manager.read((p) =>
      new Contract(anchor.contractAddress, registryAbi, p).getRecord(anchor.recordId),
    );
  }
  async integrity(version: any) {
    if (!version.anchor) return { state: 'UNANCHORED' };
    if (version.anchor.status !== 'CONFIRMED')
      return { state: version.anchor.status === 'FAILED' ? 'ERROR' : 'PENDING' };
    try {
      const record = await this.getRecord(version.anchor);
      if (Number(record.status) === 0) return { state: 'MISMATCH' };
      if (Number(record.status) === 3) return { state: 'REVOKED' };
      return {
        state:
          hashRecord(version.snapshot) === record.contentHash &&
          (!version.evidence || version.evidence.hash === record.documentHash)
            ? 'VALID'
            : 'MISMATCH',
        contentHash: record.contentHash,
        documentHash: record.documentHash,
        chainStatus: Number(record.status) === 2 ? 'SUPERSEDED' : 'ACTIVE',
      };
    } catch {
      return { state: 'ERROR' };
    }
  }
  async processOne() {
    // A database advisory lock serializes this signer across API/worker processes.
    // Signed bytes are committed BEFORE broadcast; every retry rebroadcasts the same transaction.
    await this.db.$transaction(
      async (lock) => {
        const acquired = await lock.$queryRaw<
          { locked: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(2204, 1) AS locked`;
        if (!acquired[0].locked) return;
        const unresolved = await this.db.blockchainTransaction.findFirst({
          where: { blockNumber: null },
          orderBy: { createdAt: 'asc' },
          include: { job: true },
        });
        if (unresolved?.job.status === 'FAILED') return;
        const job = await this.db.blockchainOutbox.findFirst({
          where: {
            ...(unresolved ? { id: unresolved.jobId } : {}),
            status: { in: ['PENDING', 'RETRYING', 'SUBMITTED'] },
            nextAttemptAt: { lte: new Date() },
          },
          orderBy: { createdAt: 'asc' },
          include: {
            transactions: { orderBy: { createdAt: 'desc' } },
            anchor: { include: { version: { include: { evidence: true } } } },
          },
        });
        if (!job) return;
        try {
          const a = job.anchor;
          if (
            a.chainId !== this.manager.chainId ||
            a.contractAddress.toLowerCase() !== contractAddress().toLowerCase()
          )
            throw new Error('CHAIN_MISMATCH');
          if (a.previousRecordId !== ZeroHash && job.operation === 'ANCHOR') {
            const previous = await this.db.blockchainAnchor.findUnique({
              where: { recordId: a.previousRecordId },
            });
            if (previous?.status !== 'CONFIRMED') {
              await this.db.blockchainOutbox.update({
                where: { id: job.id },
                data: { nextAttemptAt: new Date(Date.now() + 5000) },
              });
              return;
            }
          }
          const provider = await this.manager.write();
          let transaction = job.transactions[0];
          if (!transaction) {
            const wallet = new Wallet(required('BLOCKCHAIN_SIGNER_PRIVATE_KEY'), provider);
            const data = new Interface(registryAbi).encodeFunctionData(
              job.operation === 'REVOKE' ? 'revoke' : 'anchor',
              job.operation === 'REVOKE'
                ? [a.recordId]
                : [
                    a.recordId,
                    a.subjectRef,
                    id(a.version.type),
                    a.version.contentHash,
                    a.version.evidence?.hash || ZeroHash,
                    a.previousRecordId,
                    a.chainVersion,
                  ],
            );
            const nonce = await provider.getTransactionCount(wallet.address, 'pending');
            const raw = await wallet.signTransaction({
              to: a.contractAddress,
              data,
              nonce,
              chainId: a.chainId,
              gasLimit: 800000,
              gasPrice: 0,
              type: 0,
            });
            transaction = await this.db.blockchainTransaction.create({
              data: { anchorId: a.id, jobId: job.id, rawTransaction: raw, hash: keccak256(raw), nonce },
            });
          }
          let receipt = await provider.getTransactionReceipt(transaction.hash);
          if (!receipt) {
            try {
              await provider.broadcastTransaction(transaction.rawTransaction);
            } catch (error) {
              if (!(await provider.getTransaction(transaction.hash))) throw error;
            }
            await this.db.blockchainOutbox.update({ where: { id: job.id }, data: { status: 'SUBMITTED' } });
            if (job.operation === 'ANCHOR')
              await this.db.blockchainAnchor.update({ where: { id: a.id }, data: { status: 'SUBMITTED' } });
            receipt = await pollReceipt(provider, transaction.hash, 12000);
          }
          if (!receipt) {
            await this.db.blockchainOutbox.update({
              where: { id: job.id },
              data: { nextAttemptAt: new Date(Date.now() + 3000) },
            });
            return;
          }
          if (receipt.status !== 1) {
            await this.db.blockchainTransaction.update({
              where: { id: transaction.id },
              data: {
                blockNumber: receipt.blockNumber,
                receipt: JSON.parse(JSON.stringify(receipt.toJSON())),
              },
            });
            throw new Error('TRANSACTION_REVERTED');
          }
          await this.db.$transaction([
            this.db.blockchainTransaction.update({
              where: { id: transaction.id },
              data: {
                blockNumber: receipt.blockNumber,
                receipt: JSON.parse(JSON.stringify(receipt.toJSON())),
              },
            }),
            this.db.blockchainOutbox.update({
              where: { id: job.id },
              data: { status: 'CONFIRMED', error: null },
            }),
            this.db.blockchainAnchor.update({
              where: { id: a.id },
              data: job.operation === 'REVOKE' ? { revoked: true } : { status: 'CONFIRMED' },
            }),
          ]);
          console.log(
            JSON.stringify({
              level: 'info',
              event: 'chain.confirmed',
              tx: transaction.hash,
              block: receipt.blockNumber,
            }),
          );
        } catch (error) {
          const terminal =
            job.attempts >= 7 || (error instanceof Error && error.message === 'TRANSACTION_REVERTED');
          await this.db.blockchainOutbox.update({
            where: { id: job.id },
            data: {
              status: terminal ? 'FAILED' : 'RETRYING',
              attempts: { increment: 1 },
              error:
                'Blokzincir işlemi tamamlanamadı. Ağ, sözleşme ve imzalayıcı yapılandırmasını kontrol edin.',
              nextAttemptAt: new Date(Date.now() + Math.min(60000, 1000 * 2 ** job.attempts)),
            },
          });
          if (terminal && job.operation === 'ANCHOR')
            await this.db.blockchainAnchor.update({
              where: { id: job.anchorId },
              data: { status: 'FAILED' },
            });
          await this.db.applicationAuditLog.create({
            data: { action: 'BLOCKCHAIN_JOB_RETRY', objectId: job.id, metadata: { terminal } },
          });
        }
      },
      { timeout: 30000, maxWait: 5000 },
    );
  }
}
