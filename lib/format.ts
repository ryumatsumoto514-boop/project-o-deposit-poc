export function truncateAddress(address: string): string {
  if (!address.startsWith("0x") || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// wagmi's injected() connector reports its raw internal name ("Injected") —
// developer jargon that reads as an unfinished label next to considered
// copy like "Continue with Google". Every other connector already ships a
// real product name (e.g. "MetaMask", "Coinbase Wallet"), so this only
// needs to relabel the generic fallback case.
export function connectorLabel(name: string): string {
  return name === "Injected" ? "Browser wallet" : name;
}

// The mock Google sign-in path stores its identity as the raw internal
// string "google:<username>" (see app/login/page.tsx's continueTo call) so
// the rest of the flow has a stable, typed identifier to persist/display.
// That internal format must never reach the UI verbatim — it reads as
// unfinished developer output next to considered copy like "demo@exchangeo.test"
// or a wallet address. Every other mockIdentity shape (email, wallet address)
// is already human-readable as-is.
export function displayIdentity(identity: string): string {
  if (identity.startsWith("google:")) {
    return `Google (${identity.slice("google:".length)})`;
  }
  return identity;
}
