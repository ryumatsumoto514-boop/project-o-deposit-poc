// Shared limits used by both the client-side amount form and the API route
// that ultimately accepts it, so the server enforces the same ceiling the
// UI advertises instead of relying on client-side validation alone.
export const MAX_DEMO_AMOUNT = 1000;
