// Generates a fresh throwaway "test user" wallet (the original one referenced
// in OVERNIGHT_BRIEF.md had no recoverable private key in this environment,
// so this is documented as freshly generated instead). Funds it with a small
// amount of Arbitrum Sepolia ETH (gas only) from the relayer, then mints it
// some MockUSDC so it can act as the depositing "user" in the real
// approve()+transferFrom() proof.
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

  // Fresh test user wallet
  const testUser = ethers.Wallet.createRandom().connect(provider);
  console.log('New test user address:', testUser.address);
  console.log('New test user private key (testnet-only, no real value):', testUser.privateKey);

  // Fund with gas-only ETH
  const gasAmount = ethers.utils.parseEther('0.003');
  console.log('Sending', ethers.utils.formatEther(gasAmount), 'ETH to test user for gas...');
  const fundTx = await relayer.sendTransaction({ to: testUser.address, value: gasAmount });
  console.log('Fund tx hash:', fundTx.hash);
  await fundTx.wait();
  console.log('Funded.');

  const evidencePath = path.join(__dirname, '..', '.data', 'testnet-evidence.json');
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));

  const abi = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'MockUSDC.abi.json'), 'utf8')
  );
  const mockUsdc = new ethers.Contract(evidence.contractAddress, abi, relayer);

  const mintAmount = ethers.BigNumber.from(10).pow(6).mul(100); // 100 mUSDC
  console.log('Transferring 100 mUSDC from relayer (initial holder) to test user...');
  const mintTx = await mockUsdc.transfer(testUser.address, mintAmount);
  console.log('Mint/transfer tx hash:', mintTx.hash);
  const mintReceipt = await mintTx.wait();
  console.log('Confirmed in block', mintReceipt.blockNumber);

  evidence.testUserAddress = testUser.address;
  evidence.testUserPrivateKey = testUser.privateKey; // testnet-only, no real value — safe to store locally
  evidence.fundTestUserTxHash = fundTx.hash;
  evidence.mintToTestUserTxHash = mintTx.hash;
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  console.log('Updated .data/testnet-evidence.json');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
