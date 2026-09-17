// One-off script: bridge the relayer's Ethereum Sepolia ETH to Arbitrum Sepolia
// using Arbitrum's official L1->L2 ETH deposit (standard bridge, no UI needed).
const fs = require('fs');
const { ethers } = require('ethers');
const { EthBridger, getArbitrumNetwork } = require('@arbitrum/sdk');

async function main() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('ARBITRUM_RELAYER_PRIVATE_KEY'));
  const privateKey = line.split('=')[1].trim();

  // Public RPCs
  const l1Provider = new ethers.providers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const l2Provider = new ethers.providers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');

  const l1Signer = new ethers.Wallet(privateKey, l1Provider);
  console.log('Relayer address:', l1Signer.address);

  const l1Balance = await l1Provider.getBalance(l1Signer.address);
  console.log('L1 (Ethereum Sepolia) balance:', ethers.utils.formatEther(l1Balance), 'ETH');

  const l2Network = await getArbitrumNetwork(l2Provider);
  const ethBridger = new EthBridger(l2Network);

  // Bridge most of the balance, keeping some for L1 gas
  const amountToBridge = l1Balance.sub(ethers.utils.parseEther('0.005'));
  if (amountToBridge.lte(0)) {
    throw new Error('Not enough L1 ETH to cover gas + bridge amount');
  }
  console.log('Bridging:', ethers.utils.formatEther(amountToBridge), 'ETH to Arbitrum Sepolia...');

  const depositTx = await ethBridger.deposit({
    amount: amountToBridge,
    parentSigner: l1Signer,
  });
  console.log('L1 deposit tx submitted:', depositTx.hash);
  console.log('Arbiscan Sepolia (L1 side, Etherscan Sepolia):', `https://sepolia.etherscan.io/tx/${depositTx.hash}`);

  const depositReceipt = await depositTx.wait();
  console.log('L1 tx confirmed in block:', depositReceipt.blockNumber);

  console.log('Waiting for L2 (Arbitrum Sepolia) side to complete (this can take a few minutes)...');
  const l2Result = await depositReceipt.waitForChildTransactionReceipt(l2Provider);
  console.log('L2 status:', l2Result.complete ? 'COMPLETE' : 'INCOMPLETE');
  if (l2Result.complete) {
    console.log('L2 tx hash:', l2Result.childTxReceipt.transactionHash);
    console.log('Arbiscan Sepolia:', `https://sepolia.arbiscan.io/tx/${l2Result.childTxReceipt.transactionHash}`);
  }

  const l2Balance = await l2Provider.getBalance(l1Signer.address);
  console.log('Relayer L2 (Arbitrum Sepolia) balance now:', ethers.utils.formatEther(l2Balance), 'ETH');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
