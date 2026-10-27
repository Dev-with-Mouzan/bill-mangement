import "server-only";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appState, payments } from "@/db/schema";
import { isValidDate, validAmount } from "@/lib/bills";

type Transaction = any;
type PaymentRow = any;

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultDirectory = isServerless
  ? path.join(os.tmpdir(), "billflow")
  : path.join(process.cwd(), "data");

const workbookPath = process.env.EXCEL_FILE_PATH || path.join(defaultDirectory, "electricity_bill_records.xlsx");
const headers = ["Reference Number", "Payment Amount (PKR)", "Payment Date"];
const workbookError = "The existing workbook is invalid or unavailable. No changes were saved; check the server workbook configuration.";

async function readWorkbook(): Promise<{ workbook: ExcelJS.Workbook; exists: boolean; imported: Array<{ reference: string; paymentAmount: string; paymentDate: string }> }> {
  const workbook = new ExcelJS.Workbook();
  let exists = false;
  try {
    await fs.access(workbookPath);
    exists = true;
  } catch {
    return { workbook, exists: false, imported: [] };
  }
  try {
    await workbook.xlsx.readFile(workbookPath);
    const sheet = workbook.getWorksheet("Payments");
    if (!sheet || sheet.rowCount === 0) return { workbook, exists, imported: [] };
    if (headers.some((header, index) => sheet.getRow(1).getCell(index + 1).text.trim() !== header)) throw new Error("Invalid headers");
    const imported: Array<{ reference: string; paymentAmount: string; paymentDate: string }> = [];
    const seen = new Set<string>();
    for (let index = 2; index <= sheet.rowCount; index++) {
      const row = sheet.getRow(index);
      const ref = row.getCell(1).value;
      const amount = row.getCell(2).value;
      const date = row.getCell(3).value;
      if (ref == null && amount == null && date == null) continue;
      // Numeric references are deliberately rejected: their leading zeroes may already be lost.
      if (typeof ref !== "string" || !ref.trim() || ref.trim().length > 128 || typeof amount !== "number" || !validAmount(amount) || !(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error("Invalid payment row");
      const paymentDate = date.toISOString().slice(0, 10);
      if (!isValidDate(paymentDate) || seen.has(ref.trim())) throw new Error("Invalid or duplicate payment row");
      seen.add(ref.trim());
      imported.push({ reference: ref.trim(), paymentAmount: amount.toFixed(2), paymentDate });
    }
    return { workbook, exists, imported };
  } catch (error) {
    console.error("Workbook validation failed", error instanceof Error ? error.message : "unknown error");
    throw new Error(workbookError);
  }
}

function populateWorkbook(workbook: ExcelJS.Workbook, rows: PaymentRow[]) {
  // ExcelJS can retain styled rows after spliceRows; recreate only this sheet so
  // repeated snapshots cannot append ghost rows. Any other worksheets remain intact.
  const previous = workbook.getWorksheet("Payments");
  if (previous) workbook.removeWorksheet(previous.id);
  const sheet = workbook.addWorksheet("Payments");
  const header = sheet.getRow(1);
  header.values = headers;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF183344" } };
  header.height = 24;
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 25;
  sheet.getColumn(3).width = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const record of rows) {
    const row = sheet.addRow([record.reference, Number(record.paymentAmount), new Date(`${record.paymentDate}T00:00:00.000Z`)]);
    row.getCell(1).numFmt = "@";
    row.getCell(2).numFmt = '"PKR" #,##0.00';
    row.getCell(3).numFmt = "yyyy-mm-dd";
  }
  return workbook;
}

async function persistWorkbook(tx: Transaction, loaded?: Awaited<ReturnType<typeof readWorkbook>>) {
  const current = loaded ?? await readWorkbook();
  const rows = await tx.select().from(payments).orderBy(asc(payments.createdAt));
  populateWorkbook(current.workbook, rows);
  const directory = path.dirname(workbookPath);
  const temporary = path.join(directory, `.electricity-bill-${randomUUID()}.tmp`);
  try {
    await fs.mkdir(directory, { recursive: true });
    if (current.exists) {
      const backupDir = path.join(directory, "backups");
      await fs.mkdir(backupDir, { recursive: true });
      await fs.copyFile(workbookPath, path.join(backupDir, `electricity_bill_records-${Date.now()}-${randomUUID()}.xlsx`));
      const backups = (await fs.readdir(backupDir)).filter((name) => name.startsWith("electricity_bill_records-") && name.endsWith(".xlsx")).sort().reverse();
      await Promise.all(backups.slice(20).map((name) => fs.unlink(path.join(backupDir, name)).catch(() => undefined)));
    }
    const buffer = await current.workbook.xlsx.writeBuffer();
    await fs.writeFile(temporary, Buffer.from(buffer));
    await fs.rename(temporary, workbookPath);
  } catch (error) {
    await fs.unlink(temporary).catch(() => undefined);
    console.error("Workbook write warning:", error instanceof Error ? error.message : "unknown error");
    if (!isServerless) {
      throw new Error(workbookError);
    }
  }
}

async function initialize(tx: Transaction) {
  const state = await tx.select().from(appState).where(eq(appState.key, "workbook_initialized")).limit(1);
  if (state.length) {
    // The database remains authoritative if a disposable filesystem is replaced.
    // Recreate the workbook automatically from the saved records when needed.
    try {
      await fs.access(workbookPath);
    } catch {
      try {
        await persistWorkbook(tx);
      } catch (err) {
        console.warn("Could not re-create local workbook file in serverless storage:", err);
      }
    }
    return;
  }
  const current = await readWorkbook();
  for (const item of current.imported) {
    const existing = await tx.select({ paymentAmount: payments.paymentAmount, paymentDate: payments.paymentDate }).from(payments).where(eq(payments.reference, item.reference)).limit(1);
    if (existing.length) {
      if (existing[0].paymentAmount !== item.paymentAmount || existing[0].paymentDate !== item.paymentDate) {
        throw new Error("The existing workbook contains a payment that conflicts with stored records. No changes were saved; resolve the conflict before proceeding.");
      }
      continue;
    }
    await tx.insert(payments).values({ ...item, source: "imported" });
  }
  await tx.insert(appState).values({ key: "workbook_initialized", value: "1" }).onConflictDoNothing();
  try {
    await persistWorkbook(tx, current);
  } catch (err) {
    console.warn("Could not persist initial workbook file in serverless storage:", err);
  }
}

/** A PostgreSQL advisory transaction lock serializes workbook initialization and mutations across processes. */
export async function withStore<T>(callback: (tx: Transaction, markChanged: () => void) => Promise<T>): Promise<T> {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(741392018)`);
    await initialize(tx);
    let changed = false;
    const result = await callback(tx, () => { changed = true; });
    if (changed) await persistWorkbook(tx);
    return result;
  });
}

export async function getAllPayments(): Promise<PaymentRow[]> {
  return withStore(async (tx) => tx.select().from(payments).orderBy(asc(payments.createdAt)));
}

export async function makeExcelBuffer(rows: PaymentRow[]): Promise<Uint8Array> {
  const workbook = populateWorkbook(new ExcelJS.Workbook(), rows);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
