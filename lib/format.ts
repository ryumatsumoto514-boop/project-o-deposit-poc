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
// unfinished developer output next to considered copy like "demo@exchangeo.test".
// A wallet-address identity (from "Continue with connected wallet") also
// needs truncating here, same as every other address shown in the app —
// otherwise the login page's own "Signing in as" line prints the full
// 42-character address right under the truncated version shown in the
// button that produced it.
export function displayIdentity(identity: string): string {
  if (identity.startsWith("google:")) {
    return `Google (${identity.slice("google:".length)})`;
  }
  if (identity.startsWith("0x")) {
    return truncateAddress(identity);
  }
  return identity;
}
