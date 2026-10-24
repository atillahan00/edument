import '../apps/api/src/config';
import fs from 'node:fs';
import path from 'node:path';
import { ContractFactory, Wallet } from 'ethers';
import { required, workspaceRoot } from '../apps/api/src/config';
import { BlockchainProviderManager } from '../apps/api/src/blockchain/provider';
import { pollReceipt } from '../apps/api/src/blockchain/receipt';
async function main() {
  const chainId = Number(process.env.CHAIN_ID || 1337);
  const manager = new BlockchainProviderManager(
    required('BESU_RPC_URLS').split(','),
    chainId,
    process.env.BESU_WRITE_RPC_URL,
  );
  try {
    const provider = await manager.write();
    const wallet = new Wallet(required('BLOCKCHAIN_SIGNER_PRIVATE_KEY'), provider);
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(
          workspaceRoot,
          'packages/contracts/artifacts/contracts/EduMentRegistry.sol/EduMentRegistry.json',
        ),
        'utf8',
      ),
    );
    const contract = await new ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy(
      wallet.address,
      wallet.address,
      { gasPrice: 0, gasLimit: 5000000 },
    );
    const receipt = await pollReceipt(provider, contract.deploymentTransaction()!.hash, 60000);
    if (!receipt || receipt.status !== 1) throw new Error('Dağıtım onaylanmadı.');
    const deployment = {
      chainId,
      contractAddress: await contract.getAddress(),
      deployer: wallet.address,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.hash,
      timestamp: new Date().toISOString(),
      abiReference: 'packages/contracts/artifacts/contracts/EduMentRegistry.sol/EduMentRegistry.json',
    };
    fs.mkdirSync(path.join(workspaceRoot, 'deployments'), { recursive: true });
    const file = path.join(workspaceRoot, 'deployments', `${chainId}.json`);
    if (fs.existsSync(file)) fs.copyFileSync(file, file + `.${Date.now()}.bak`);
    fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
    console.log(JSON.stringify(deployment, null, 2));
  } finally {
    manager.destroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
