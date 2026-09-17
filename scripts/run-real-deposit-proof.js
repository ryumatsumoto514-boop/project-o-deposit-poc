// The core real-transaction proof required by SPEC.md / OVERNIGHT_BRIEF.md:
// the "user" (test wallet) signs an EXACT-amount approve() to the "deposit
// contract" (relayer address), then the relayer signs transferFrom() to pull
// it — the same two-transaction pattern the live app's /deposit/approve flow
// and lib/relayer.ts + lib/pull.ts perform for a real MetaMask user. Captures
// both tx hashes, before/after balance + allowance state, for
// testnet-evidence.md.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    if (line.includes('=') && !line.startsWith('#')) {
      const idx = line.indexOf('=');
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k) process.env[k] = v;
    }
  }
}

async function main() {
  loadEnv();
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'
  );
  const relayer = new ethers.Wallet(process.env.ARBITRUM_RELAYER_PRIVATE_KEY, provider);

  const evidencePath = path.join(__dirname, '..', '.data', 'testnet-evidence.json');
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const testUser = new ethers.Wallet(evidence.testUserPrivateKey, provider);

  const abi = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'MockUSDC.abi.json'), 'utf8')
  );
  const asUser = new ethers.Contract(evidence.contractAddress, abi, testUser);
  const asRelayer = new ethers.Contract(evidence.contractAddress, abi, relayer);

  const depositAmount = ethers.BigNumber.from(10).pow(6).mul(25); // 25.0 mUSDC — the "deposit"

  console.log('=== BEFORE ===');
  const userBalBefore = await asUser.balanceOf(testUser.address);
  const relayerBalBefore = await asUser.balanceOf(relayer.address);
  const allowanceBefore = await asUser.allowance(testUser.address, relayer.address);
  console.log('User (depositor) mUSDC balance:', ethers.utils.formatUnits(userBalBefore, 6));
  console.log('Relayer (deposit address) mUSDC balance:', ethers.utils.formatUnits(relayerBalBefore, 6));
  console.log('Allowance (user -> relayer):', ethers.utils.formatUnits(allowanceBefore, 6));

  console.log('\n=== STEP 1: user signs approve(exact amount) ===');
  const approveTx = await asUser.approve(relayer.address, depositAmount);
  console.log('Approve tx hash:', approveTx.hash);
  const approveReceipt = await approveTx.wait();
  console.log('Confirmed in block', approveReceipt.blockNumber, 'status:', approveReceipt.status === 1 ? 'success' : 'FAILED');

  const allowanceAfterApprove = await asUser.allowance(testUser.address, relayer.address);
  console.log('Allowance after approve:', ethers.utils.formatUnits(allowanceAfterApprove, 6));

  console.log('\n=== STEP 2: relayer signs transferFrom() to pull the deposit ===');
  const pullTx = await asRelayer.transferFrom(testUser.address, relayer.address, depositAmount);
  console.log('TransferFrom tx hash:', pullTx.hash);
  const pullReceipt = await pullTx.wait();
  console.log('Confirmed in block', pullReceipt.blockNumber, 'status:', pullReceipt.status === 1 ? 'success' : 'FAILED');

  console.log('\n=== AFTER ===');
  const userBalAfter = await asUser.balanceOf(testUser.address);
  const relayerBalAfter = await asUser.balanceOf(relayer.address);
  const allowanceAfter = await asUser.allowance(testUser.address, relayer.address);
  console.log('User (depositor) mUSDC balance:', ethers.utils.formatUnits(userBalAfter, 6));
  console.log('Relayer (deposit address) mUSDC balance:', ethers.utils.formatUnits(relayerBalAfter, 6));
  console.log('Allowance (user -> relayer, should be 0 - fully consumed):', ethers.utils.formatUnits(allowanceAfter, 6));

  evidence.depositProof = {
    userWallet: testUser.address,
    depositAddress: relayer.address,
    depositAmount: '25.0',
    depositAmountRaw: depositAmount.toString(),
    approveTxHash: approveTx.hash,
    approveExplorerUrl: `https://sepolia.arbiscan.io/tx/${approveTx.hash}`,
    approveBlock: approveReceipt.blockNumber,
    transferFromTxHash: pullTx.hash,
    transferFromExplorerUrl: `https://sepolia.arbiscan.io/tx/${pullTx.hash}`,
    transferFromBlock: pullReceipt.blockNumber,
    before: {
      userBalance: ethers.utils.formatUnits(userBalBefore, 6),
      relayerBalance: ethers.utils.formatUnits(relayerBalBefore, 6),
      allowance: ethers.utils.formatUnits(allowanceBefore, 6),
    },
    afterApprove: {
      allowance: ethers.utils.formatUnits(allowanceAfterApprove, 6),
    },
    after: {
      userBalance: ethers.utils.formatUnits(userBalAfter, 6),
      relayerBalance: ethers.utils.formatUnits(relayerBalAfter, 6),
      allowance: ethers.utils.formatUnits(allowanceAfter, 6),
    },
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  console.log('\nWrote deposit proof to .data/testnet-evidence.json');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
