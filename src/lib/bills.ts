export type Payment = {
  id: string;
  reference: string;
  paymentAmount: string;
  paymentDate: string;
  source: string;
  rawBarcode: string | null;
  billingMonth: string | null;
  dueDate: string | null;
  originalAmount: string | null;
  lateAmount: string | null;
  requestKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParserConfig = {
  separator: string;
  monthPosition: number;
  referencePosition: number;
  amountPosition: number;
  duePosition: number;
  latePosition: number;
  dateFormat: "YYYYMMDD" | "DDMMYYYY" | "YYYY-MM-DD" | "DD/MM/YYYY";
  amountEncoding: "rupees" | "paisa" | "decimal";
};

export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  separator: "-",
  monthPosition: 1,
  referencePosition: 2,
  amountPosition: 3,
  duePosition: 4,
  latePosition: 5,
  dateFormat: "YYYYMMDD",
  amountEncoding: "rupees",
};

export type BillDraft = {
  clientId: string;
  rawBarcode: string;
  billingMonth: string;
  reference: string;
  originalAmount: string;
  dueDate: string;
  lateAmount: string;
  paymentDate: string;
  parseErrors: string[];
  saveError?: string;
};

export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return !!match && Number(match[1]) >= 1900 && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

export function validAmount(value: string | number): boolean {
  const text = String(value).trim();
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(text)) return false;
  const amount = Number(text);
  return Number.isFinite(amount) && amount > 0 && amount <= 999999999999.99;
}

function parseEncodedAmount(raw: string, encoding: ParserConfig["amountEncoding"]): string {
  const value = raw.trim();
  const pattern = encoding === "decimal" ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/;
  if (!pattern.test(value)) return "";
  const number = Number(value);
  if (!Number.isSafeInteger(number) && encoding !== "decimal") return "";
  const amount = encoding === "paisa" ? number / 100 : number;
  return validAmount(amount) ? String(amount) : "";
}

function parseDueDate(raw: string, format: ParserConfig["dateFormat"]): string {
  const value = raw.trim();
  let result = "";
  if (format === "YYYYMMDD" && /^\d{8}$/.test(value)) result = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (format === "DDMMYYYY" && /^\d{8}$/.test(value)) result = `${value.slice(4, 8)}-${value.slice(2, 4)}-${value.slice(0, 2)}`;
  if (format === "YYYY-MM-DD") result = value;
  if (format === "DD/MM/YYYY" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) result = `${value.slice(6, 10)}-${value.slice(3, 5)}-${value.slice(0, 2)}`;
  return isValidDate(result) ? result : "";
}

export function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Parse only the configured fields. Unknown, incomplete, or invalid values are never guessed. */
export function parseBarcode(raw: string, config: ParserConfig = DEFAULT_PARSER_CONFIG): BillDraft {
  const text = raw.trim();
  const parts = config.separator ? text.split(config.separator) : [];
  const field = (position: number) => parts[position - 1]?.trim() ?? "";
  const monthRaw = field(config.monthPosition);
  const month = /^\d{6}$/.test(monthRaw) ? `${monthRaw.slice(0, 4)}-${monthRaw.slice(4, 6)}` : "";
  const bill: BillDraft = {
    clientId: newClientId(),
    rawBarcode: text,
    billingMonth: isValidMonth(month) ? month : "",
    reference: field(config.referencePosition),
    originalAmount: parseEncodedAmount(field(config.amountPosition), config.amountEncoding),
    dueDate: parseDueDate(field(config.duePosition), config.dateFormat),
    lateAmount: parseEncodedAmount(field(config.latePosition), config.amountEncoding),
    paymentDate: todayLocal(),
    parseErrors: [],
  };
  if (!text) bill.parseErrors.push("Barcode is empty.");
  if (!config.separator || parts.length < Math.max(config.monthPosition, config.referencePosition, config.amountPosition, config.duePosition, config.latePosition)) bill.parseErrors.push("Barcode is incomplete for the configured field positions.");
  if (!bill.billingMonth) bill.parseErrors.push("Billing month must be in YYYYMM format.");
  if (!bill.reference) bill.parseErrors.push("Reference number is missing.");
  if (!bill.originalAmount) bill.parseErrors.push("Original amount is missing or invalid.");
  if (!bill.dueDate) bill.parseErrors.push("Due date is missing or invalid for the selected format.");
  if (!bill.lateAmount) bill.parseErrors.push("Late payment amount is missing or invalid.");
  return bill;
}

export function validateBill(bill: BillDraft): string[] {
  const errors: string[] = [];
  if (!bill.reference.trim()) errors.push("Enter a reference number.");
  if (bill.reference.trim().length > 128) errors.push("Reference number is too long.");
  if (!isValidMonth(bill.billingMonth)) errors.push("Enter a valid billing month.");
  if (!validAmount(bill.originalAmount)) errors.push("Enter a valid original amount.");
  if (!validAmount(bill.lateAmount)) errors.push("Enter a valid late payment amount.");
  if (!isValidDate(bill.dueDate)) errors.push("Enter a valid due date.");
  if (!isValidDate(bill.paymentDate)) errors.push("Enter a valid payment date.");
  if (!bill.rawBarcode.trim()) errors.push("The original barcode is required.");
  return errors;
}

export function selectedAmount(bill: BillDraft): number | null {
  if (!isValidDate(bill.dueDate) || !isValidDate(bill.paymentDate) || !validAmount(bill.originalAmount) || !validAmount(bill.lateAmount)) return null;
  return Number(bill.paymentDate <= bill.dueDate ? bill.originalAmount : bill.lateAmount);
}

export function formatMoney(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  if (!value || !isValidDate(value)) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(year, month - 1, day));
}

export function billPayload(bill: BillDraft) {
  return {
    clientId: bill.clientId,
    reference: bill.reference.trim(),
    paymentAmount: selectedAmount(bill),
    paymentDate: bill.paymentDate,
    source: "scan",
    rawBarcode: bill.rawBarcode,
    billingMonth: bill.billingMonth,
    dueDate: bill.dueDate,
    originalAmount: bill.originalAmount,
    lateAmount: bill.lateAmount,
  };
}
