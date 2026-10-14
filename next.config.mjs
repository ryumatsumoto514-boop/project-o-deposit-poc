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
          // Scoped from an actual audit of this app's resources: fonts are
          // self-hosted by next/font (no fonts.gstatic.com fetch at runtime),
          // the OG image route and all images are same-origin, and there is
          // no client-side RPC/API call to any third-party origin (gas
          // polling goes through our own /api/gas route). 'unsafe-inline' is
          // kept for script/style because Next's App Router streams RSC
          // payloads via inline <script> tags and several components use
          // inline style={{}} — a nonce-based CSP would remove the need for
          // it but requires middleware.ts; this is the safe-by-default
          // policy that still blocks any injected third-party script/image/
          // fetch target, which is the realistic XSS/clickjack exfil path.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
          // This app never uses camera/mic/geolocation/payment/USB — the
          // wallet connector talks to window.ethereum, not these browser
          // APIs, and the confirm screen's copy-address button only uses
          // clipboard-write (left out of this list, so it stays allowed).
          // Denying the rest closes off any embedding site from invoking
          // them through this origin's context.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
          },
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
