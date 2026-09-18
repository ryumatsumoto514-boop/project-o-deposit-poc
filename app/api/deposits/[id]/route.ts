import { NextRequest, NextResponse } from "next/server";
import { depositStore } from "@/lib/store";
import type { DepositStatus } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = depositStore.get(params.id);
  if (!deposit) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ deposit });
}

// Client-observed failures only — e.g. the user's own approve() tx reverted
// or was dropped. Servers can't see wallet-side errors, so the client
// reports them here to keep the record honest instead of leaving it stuck.
const ALLOWED_CLIENT_STATUSES: DepositStatus[] = ["STALLED_NO_GAS", "STALLED_TIMEOUT"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = depositStore.get(params.id);
  if (!deposit) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  let body: { status?: DepositStatus; failureReason?: string };
  try {
    body = (await req.json()) as {
      status?: DepositStatus;
      failureReason?: string;
    };
  } catch {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  if (!body.status || !ALLOWED_CLIENT_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  const updated = depositStore.update(deposit.id, {
    status: body.status,
    failureReason: body.failureReason ?? null,
  });
  return NextResponse.json({ deposit: updated });
}
