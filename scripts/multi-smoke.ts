import '../apps/api/src/config';
import fs from 'node:fs';
import { ContractFactory, Wallet, Contract, ZeroHash, id } from 'ethers';
import { randomBytes } from 'node:crypto';
import { BlockchainProviderManager } from '../apps/api/src/blockchain/provider';
import { registryAbi } from '../apps/api/src/blockchain/service';
import { pollReceipt } from '../apps/api/src/blockchain/receipt';
import { hashRecord } from '../apps/api/src/hash';
import assert from 'node:assert/strict';
const urls = [8551, 8552, 8553, 8554].map((p) => `http://127.0.0.1:${p}`);
const manager = new BlockchainProviderManager(urls, 1338);
async function main() {
  const first = await manager.health();
  assert.ok(
    first.every((n) => n.online && n.validators === 4),
    'Dört gerçek doğrulayıcı yanıt vermeli.',
  );
  const provider = await manager.write();
  const wallet = new Wallet(process.env.BLOCKCHAIN_SIGNER_PRIVATE_KEY!, provider);
  const artifact = JSON.parse(
    fs.readFileSync(
      'packages/contracts/artifacts/contracts/EduMentRegistry.sol/EduMentRegistry.json',
      'utf8',
    ),
  );
  const deployed = await new ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy(
    wallet.address,
    wallet.address,
    { gasPrice: 0, gasLimit: 5000000 },
  );
  const deployment = await pollReceipt(provider, deployed.deploymentTransaction()!.hash, 60000);
  assert.equal(deployment?.status, 1);
  const address = await deployed.getAddress();
  const registry = new Contract(address, registryAbi, wallet);
  const recordId = '0x' + randomBytes(32).toString('hex');
  const contentHash = hashRecord({ kind: 'multi-validator-smoke', seed: 2204 });
  const tx = await registry.anchor(
    recordId,
    '0x' + randomBytes(32).toString('hex'),
    id('RESEARCH'),
    contentHash,
    ZeroHash,
    ZeroHash,
    1,
    { gasPrice: 0, gasLimit: 800000 },
  );
  const receipt = await pollReceipt(provider, tx.hash, 60000);
  assert.equal(receipt?.status, 1);
  for (const p of manager.providers) {
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        if ((await new Contract(address, registryAbi, p).getRecord(recordId)).contentHash === contentHash)
          break;
      } catch {
        /* Node may be one block behind. */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal((await new Contract(address, registryAbi, p).getRecord(recordId)).contentHash, contentHash);
  }
  const latest = await manager.health();
  assert.ok(latest.every((n, i) => n.block! > first[i].block!));
  const result = {
    at: new Date().toISOString(),
    validated: true,
    chainId: 1338,
    contractAddress: address,
    transactionHash: tx.hash,
    blockNumber: receipt!.blockNumber,
    nodes: latest,
  };
  fs.mkdirSync('docs/evidence', { recursive: true });
  fs.writeFileSync('docs/evidence/multi-node.json', JSON.stringify(result, null, 2));
  fs.mkdirSync('deployments', { recursive: true });
  fs.writeFileSync('deployments/1338.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => manager.destroy());
