import { and, eq, ne } from "drizzle-orm";
import { payments } from "@/db/schema";
import { isValidDate, isValidMonth, validAmount } from "@/lib/bills";
import { getAllPayments, withStore } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Input = Record<string, unknown>;
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function cleanInput(input: Input) {
  const reference = text(input.reference);
  const paymentDate = text(input.paymentDate);
  const paymentAmount = String(input.paymentAmount ?? "").trim();
  const source = input.source === "scan" ? "scan" : "manual";
  const clientId = text(input.clientId);
  if (!clientId || clientId.length > 128) return { error: "A valid request ID is required." } as const;
  if (!reference || reference.length > 128) return { error: "Enter a reference number (up to 128 characters)." } as const;
  if (!isValidDate(paymentDate)) return { error: "Enter a valid payment date." } as const;
  if (!validAmount(paymentAmount)) return { error: "Enter a positive payment amount with at most two decimals." } as const;
  const rawBarcode = text(input.rawBarcode);
  const billingMonth = text(input.billingMonth);
  const dueDate = text(input.dueDate);
  const originalAmount = String(input.originalAmount ?? "").trim();
  const lateAmount = String(input.lateAmount ?? "").trim();
  if (source === "scan") {
    if (!rawBarcode || rawBarcode.length > 5000 || !isValidMonth(billingMonth) || !isValidDate(dueDate) || !validAmount(originalAmount) || !validAmount(lateAmount)) return { error: "Scanned bill information is incomplete. Please verify each field." } as const;
    const expected = Number(paymentDate <= dueDate ? originalAmount : lateAmount);
    if (Math.round(expected * 100) !== Math.round(Number(paymentAmount) * 100)) return { error: "The selected amount does not match the payment date and due date." } as const;
  }
  return { value: { reference, paymentDate, paymentAmount: Number(paymentAmount).toFixed(2), source, requestKey: clientId, rawBarcode: source === "scan" ? rawBarcode : null, billingMonth: source === "scan" ? billingMonth : null, dueDate: source === "scan" ? dueDate : null, originalAmount: source === "scan" ? Number(originalAmount).toFixed(2) : null, lateAmount: source === "scan" ? Number(lateAmount).toFixed(2) : null } } as const;
}

function errorResponse(error: unknown) {
  console.error("Payment request failed", error instanceof Error ? error.message : "unknown error");
  const message = error instanceof Error && error.message.startsWith("The existing workbook") ? error.message : "Could not complete the request. Your unsaved changes are still available; please try again.";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const records = await getAllPayments();
    return Response.json({ records: records.reverse() });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entries: Input[] = Array.isArray(body.records) ? body.records : [body];
    if (!entries.length || entries.length > 1000 || entries.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) return Response.json({ error: "Provide between 1 and 1000 payment records." }, { status: 400 });
    const result = await withStore(async (tx, markChanged) => {
      const saved: Array<{ clientId: string; reference: string; id: string; alreadySaved?: boolean }> = [];
      const failed: Array<{ clientId: string; reference: string; error: string }> = [];
      for (const entry of entries) {
        const clientId = text(entry.clientId);
        const reference = text(entry.reference);
        const parsed = cleanInput(entry);
        if ("error" in parsed) { failed.push({ clientId, reference, error: parsed.error ?? "Invalid payment record." }); continue; }
        const existingRequest = await tx.select().from(payments).where(eq(payments.requestKey, parsed.value.requestKey)).limit(1);
        if (existingRequest.length) {
          const existing = existingRequest[0];
          if (existing.reference === parsed.value.reference && existing.paymentDate === parsed.value.paymentDate && existing.paymentAmount === parsed.value.paymentAmount) saved.push({ clientId, reference, id: existing.id, alreadySaved: true });
          else failed.push({ clientId, reference, error: "This request ID was already used for a different payment." });
          continue;
        }
        const inserted = await tx.insert(payments).values(parsed.value).onConflictDoNothing().returning({ id: payments.id });
        if (!inserted.length) { failed.push({ clientId, reference, error: "This reference number is already in your records." }); continue; }
        markChanged();
        saved.push({ clientId, reference, id: inserted[0].id });
      }
      return { saved, failed };
    });
    return Response.json(result);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = text(body.id);
    const reference = text(body.reference);
    const paymentDate = text(body.paymentDate);
    const paymentAmount = String(body.paymentAmount ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id) || !reference || reference.length > 128 || !isValidDate(paymentDate) || !validAmount(paymentAmount)) return Response.json({ error: "Please enter a valid reference, payment date, and positive amount." }, { status: 400 });
    const result = await withStore(async (tx, markChanged) => {
      const duplicate = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.reference, reference), ne(payments.id, id))).limit(1);
      if (duplicate.length) return { error: "This reference number is already in your records.", status: 409 };
      const updated = await tx.update(payments).set({ reference, paymentDate, paymentAmount: Number(paymentAmount).toFixed(2), updatedAt: new Date() }).where(eq(payments.id, id)).returning();
      if (!updated.length) return { error: "Record not found.", status: 404 };
      markChanged();
      return { record: updated[0], status: 200 };
    });
    return Response.json(result, { status: result.status });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid record ID." }, { status: 400 });
    const result = await withStore(async (tx, markChanged) => {
      const deleted = await tx.delete(payments).where(eq(payments.id, id)).returning({ id: payments.id });
      if (deleted.length) markChanged();
      return deleted.length > 0;
    });
    return result ? Response.json({ ok: true }) : Response.json({ error: "Record not found." }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}
