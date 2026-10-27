import { date, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull(),
    paymentAmount: numeric("payment_amount", { precision: 14, scale: 2 }).notNull(),
    paymentDate: date("payment_date", { mode: "string" }).notNull(),
    source: text("source").notNull().default("manual"),
    rawBarcode: text("raw_barcode"),
    billingMonth: text("billing_month"),
    dueDate: date("due_date", { mode: "string" }),
    originalAmount: numeric("original_amount", { precision: 14, scale: 2 }),
    lateAmount: numeric("late_amount", { precision: 14, scale: 2 }),
    requestKey: text("request_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payments_reference_unique").on(table.reference),
    uniqueIndex("payments_request_key_unique").on(table.requestKey),
  ],
);

export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
