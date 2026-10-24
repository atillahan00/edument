import '../apps/api/src/config';
import fs from 'node:fs';
import path from 'node:path';
import { Wallet, encodeRlp, ZeroHash } from 'ethers';
import { required, workspaceRoot } from '../apps/api/src/config';
export function generate(mode = 'single') {
  if (!['single', 'multi'].includes(mode)) throw new Error('Geçersiz ağ modu.');
  const dir = path.join(workspaceRoot, 'infra/besu/generated', mode);
  if (fs.existsSync(path.join(dir, 'genesis.json'))) {
    console.log('Mevcut ağ anahtarları korunuyor.');
    return;
  }
  const count = mode === 'single' ? 1 : 4;
  const wallets = Array.from({ length: count }, () => Wallet.createRandom());
  const addresses = wallets.map((w) => w.address.toLowerCase()).sort();
  const genesis = {
    config: {
      chainId: mode === 'single' ? 1337 : 1338,
      berlinBlock: 0,
      londonBlock: 0,
      zeroBaseFee: true,
      qbft: { blockperiodseconds: 2, epochlength: 30000, requesttimeoutseconds: 4 },
    },
    nonce: '0x0',
    timestamp: '0x0',
    gasLimit: '0x1c9c380',
    difficulty: '0x1',
    mixHash: '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365',
    coinbase: '0x0000000000000000000000000000000000000000',
    baseFeePerGas: '0x0',
    alloc: {
      [new Wallet(required('BLOCKCHAIN_SIGNER_PRIVATE_KEY')).address.slice(2)]: {
        balance: '0x3635c9adc5dea00000',
      },
    },
    extraData: encodeRlp([ZeroHash, addresses, [], '0x', []]),
  };
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < count; i++) {
    const nodeDir = path.join(dir, `node${i + 1}`);
    fs.mkdirSync(nodeDir, { recursive: true });
    fs.writeFileSync(path.join(nodeDir, 'key'), wallets[i].privateKey.slice(2), { mode: 0o600 });
    const peers = wallets
      .map(
        (w, j) =>
          `enode://${w.signingKey.publicKey.slice(4)}@172.29.${mode === 'single' ? 1 : 2}.${j + 10}:30303`,
      )
      .filter((_, j) => j !== i);
    fs.writeFileSync(path.join(nodeDir, 'static-nodes.json'), JSON.stringify(peers, null, 2));
  }
  fs.writeFileSync(path.join(dir, 'genesis.json'), JSON.stringify(genesis, null, 2));
  console.log(`${count} doğrulayıcılı yalnızca geliştirmeye uygun ağ yapılandırması üretildi.`);
}
if (require.main === module) generate(process.argv[2] || process.env.CHAIN_MODE || 'single');
