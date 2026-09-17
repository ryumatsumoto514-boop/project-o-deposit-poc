/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // We only use wagmi's `injected` connector, but importing from the
    // `wagmi/connectors` barrel also pulls in the Coinbase Smart Wallet
    // connector, which has a broken transitive dependency (@x402/evm) in
    // some installed versions. Alias it out rather than pull in the
    // unrelated Coinbase/Solana SDKs just to satisfy that unused path.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
    };
    return config;
  },
};

export default nextConfig;
