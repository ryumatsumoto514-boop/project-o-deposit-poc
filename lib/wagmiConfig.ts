import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAIN } from "./chain";

// Injected connector only (MetaMask etc.) — no Privy/WalletConnect needed
// for this PoC. The "login" step is mocked separately; this is the real
// wallet used to sign the real testnet transaction.
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected()],
  transports: {
    [CHAIN.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
