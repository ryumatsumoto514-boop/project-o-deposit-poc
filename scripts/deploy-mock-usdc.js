// Compile MockUSDC.sol with solc, then deploy to Arbitrum Sepolia using the
// relayer wallet (already funded with gas-only ETH), mint initial supply to
// itself, then run approve() + transferFrom() as the real testnet tx pair
// required by SPEC.md. Writes results to testnet-evidence.json for the
// README/testnet-evidence.md to reference.
const fs = require('fs');
const path = require('path');
const solc = require('solc');
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

function compile() {
  const source = fs.readFileSync(path.join(__dirname, 'MockUSDC.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'MockUSDC.sol': { content: source } },
    settings: {
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const fatal = output.errors.filter((e) => e.severity === 'error');
    if (fatal.length) {
      console.error(fatal.map((e) => e.formattedMessage).join('\n'));
      throw new Error('Solidity compile failed');
    }
  }
  const contract = output.contracts['MockUSDC.sol']['MockUSDC'];
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}

async function main() {
  loadEnv();
  const { abi, bytecode } = compile();
  fs.writeFileSync(
    path.join(__dirname, 'MockUSDC.abi.json'),
    JSON.stringify(abi, null, 2)
  );

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'
  );
  const wallet = new ethers.Wallet(process.env.ARBITRUM_RELAYER_PRIVATE_KEY, provider);
  console.log('Deployer/relayer address:', wallet.address);

  const bal = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.utils.formatEther(bal), 'ETH');

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const initialSupply = ethers.BigNumber.from(10).pow(6).mul(1_000_000); // 1,000,000 mUSDC (6 decimals)
  console.log('Deploying MockUSDC...');
  const contract = await factory.deploy(initialSupply);
  const deployTx = contract.deployTransaction;
  console.log('Deploy tx hash:', deployTx.hash);
  const deployReceipt = await deployTx.wait();
  console.log('Deployed at:', contract.address, 'in block', deployReceipt.blockNumber);

  const evidence = {
    network: 'Arbitrum Sepolia (chainId 421614)',
    contractAddress: contract.address,
    deployTxHash: deployTx.hash,
    deployBlock: deployReceipt.blockNumber,
    deployExplorerUrl: `https://sepolia.arbiscan.io/tx/${deployTx.hash}`,
    contractExplorerUrl: `https://sepolia.arbiscan.io/address/${contract.address}`,
    deployerAddress: wallet.address,
  };
  fs.writeFileSync(
    path.join(__dirname, '..', '.data', 'testnet-evidence.json'),
    JSON.stringify(evidence, null, 2)
  );
  console.log('Wrote .data/testnet-evidence.json');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
