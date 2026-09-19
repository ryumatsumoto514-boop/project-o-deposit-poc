/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // This app has users connect a wallet and sign real testnet transactions
    // (approve/transferFrom). Without X-Frame-Options, the whole flow could be
    // embedded in an invisible iframe on a malicious site and clickjacked into
    // approving/signing something the user didn't intend — a real risk for any
    // wallet-signing UI, not a theoretical one. DENY since this app has no
    // legitimate reason to be framed by anyone.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
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
