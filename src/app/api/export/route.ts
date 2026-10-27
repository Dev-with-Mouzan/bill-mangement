import { getAllPayments, makeExcelBuffer } from "@/lib/storage";
import { isValidDate } from "@/lib/bills";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") ?? "").trim().toLowerCase();
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if ((from && !isValidDate(from)) || (to && !isValidDate(to)) || (from && to && from > to)) return Response.json({ error: "Please select a valid date range." }, { status: 400 });
    const records = (await getAllPayments()).filter((record) => (!search || record.reference.toLowerCase().includes(search)) && (!from || record.paymentDate >= from) && (!to || record.paymentDate <= to));
    const buffer = await makeExcelBuffer(records);
    const output = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(output).set(buffer);
    return new Response(output, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="electricity_bill_records.xlsx"', "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Export failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Could not export the workbook. Please try again." }, { status: 500 });
  }
}
