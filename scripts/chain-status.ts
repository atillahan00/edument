import '../apps/api/src/config';
import { BlockchainProviderManager } from '../apps/api/src/blockchain/provider';
const manager = new BlockchainProviderManager(
  (process.env.BESU_RPC_URLS || 'http://127.0.0.1:8545').split(','),
  Number(process.env.CHAIN_ID || 1337),
  process.env.BESU_WRITE_RPC_URL,
);
manager
  .health()
  .then((states) => {
    console.log(JSON.stringify(states, null, 2));
    if (states.some((s) => !s.online)) process.exitCode = 1;
  })
  .finally(() => manager.destroy());
