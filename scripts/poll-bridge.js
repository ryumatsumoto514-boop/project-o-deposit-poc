// Poll for the L2 (Arbitrum Sepolia) side of a previously-submitted bridge deposit.
const { ethers } = require('ethers');
const { ParentTransactionReceipt } = require('@arbitrum/sdk');

async function main() {
  const l1TxHash = process.argv[2];
  if (!l1TxHash) throw new Error('Usage: node poll-bridge.js <l1TxHash>');

  const l1Provider = new ethers.providers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const l2Provider = new ethers.providers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');

  const l1Receipt = await l1Provider.getTransactionReceipt(l1TxHash);
  if (!l1Receipt) throw new Error('L1 tx not found/confirmed yet');

  const l1TxReceipt = new ParentTransactionReceipt(l1Receipt);
  console.log('Fetching parent->child messages for', l1TxHash, '...');
  const messages = await l1TxReceipt.getParentToChildMessages(l2Provider);
  console.log('Found', messages.length, 'message(s)');
  if (messages.length === 0) {
    console.log('No messages found yet, try again shortly.');
    return;
  }
  const message = messages[0];
  console.log('Waiting for status (this can take several minutes)...');
  const status = await message.waitForStatus();
  console.log('Status:', status.status, '(2 = FUNDS_DEPOSITED_ON_CHILD success for ETH deposits)');

  const l2Balance = await l2Provider.getBalance(l1Receipt.from);
  console.log('Relayer L2 (Arbitrum Sepolia) balance now:', ethers.utils.formatEther(l2Balance), 'ETH');
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
