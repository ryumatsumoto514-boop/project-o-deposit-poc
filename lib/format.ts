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
