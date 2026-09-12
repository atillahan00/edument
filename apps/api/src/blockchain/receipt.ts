import type { JsonRpcProvider } from 'ethers';
export async function pollReceipt(provider: JsonRpcProvider, hash: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  do {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, 500));
  } while (Date.now() < deadline);
  return null;
}
