// Poll for the L2 (Arbitrum Sepolia) side of a previously-submitted bridge deposit.
const { ethers } = require('ethers');
const { L1TransactionReceipt } = require('@arbitrum/sdk');

async function main() {
  const l1TxHash = process.argv[2];
  if (!l1TxHash) throw new Error('Usage: node poll-bridge.js <l1TxHash>');

  const l1Provider = new ethers.providers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const l2Provider = new ethers.providers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');

  const l1Receipt = await l1Provider.getTransactionReceipt(l1TxHash);
  if (!l1Receipt) throw new Error('L1 tx not found/confirmed yet');

  const l1TxReceipt = new L1TransactionReceipt(l1Receipt);
  console.log('Checking L2 status for L1 tx', l1TxHash, '...');
  const result = await l1TxReceipt.waitForChildTransactionReceipt(l2Provider, undefined, 1000 * 60 * 8);
  console.log('Complete:', result.complete);
  if (result.complete) {
    console.log('L2 tx hash:', result.childTxReceipt.transactionHash);
    console.log('Arbiscan Sepolia:', `https://sepolia.arbiscan.io/tx/${result.childTxReceipt.transactionHash}`);
  } else {
    console.log('Not complete yet. Message status:', result.message ? await result.message.status() : 'n/a');
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
