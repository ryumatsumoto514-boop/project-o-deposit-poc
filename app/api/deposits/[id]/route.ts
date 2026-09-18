import { NextRequest, NextResponse } from "next/server";
import { depositStore } from "@/lib/store";
import { canTransition } from "@/lib/stateMachine";
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
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  if (!body.status || !ALLOWED_CLIENT_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  if (!canTransition(deposit.status, body.status)) {
    return NextResponse.json(
      {
        error: "INVALID_TRANSITION",
        message: `Cannot move a deposit from ${deposit.status} to ${body.status}.`,
      },
      { status: 409 }
    );
  }
  if (
    body.failureReason !== undefined &&
    body.failureReason !== null &&
    typeof body.failureReason !== "string"
  ) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "failureReason must be a string." },
      { status: 400 }
    );
  }
  const updated = depositStore.update(deposit.id, {
    status: body.status,
    failureReason: body.failureReason ?? null,
  });
  return NextResponse.json({ deposit: updated });
}
