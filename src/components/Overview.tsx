"use client";

import { ArrowDownToLine, ArrowRight, BadgeCheck, CalendarDays, CircleDollarSign, FileCheck2, FilePlus2, Files, Layers3, ScanLine } from "lucide-react";
import { formatDate, formatMoney, todayLocal, type Payment } from "@/lib/bills";
import type { Filters, ViewName } from "@/lib/ui";

type Props = {
  records: Payment[];
  loading: boolean;
  onNavigate: (view: ViewName) => void;
  onExport: (filters?: Filters) => void;
};

export function Overview({ records, loading, onNavigate, onExport }: Props) {
  const total = records.reduce((sum, record) => sum + Number(record.paymentAmount), 0);
  const today = todayLocal();
  const scannedToday = records.filter(
    (record) => record.source === "scan" && new Date(record.createdAt).toLocaleDateString("en-CA") === today
  ).length;

  const stats = [
    { label: "Total Bills Recorded", value: String(records.length), icon: FileCheck2, color: "mint" },
    { label: "Total Amount Paid", value: `PKR ${formatMoney(total)}`, icon: CircleDollarSign, color: "blue" },
    { label: "Bills Scanned Today", value: String(scannedToday), icon: ScanLine, color: "lilac" },
  ];

  const quick = [
    { title: "Scan Single Bill", icon: ScanLine, color: "mint", view: "single" as const },
    { title: "Batch Scan Bills", icon: Layers3, color: "blue", view: "batch" as const },
    { title: "Manual Entry", icon: FilePlus2, color: "peach", view: "manual" as const },
  ];

  return (
    <div className="overview-container">
      <div className="page-heading">
        <h1>Dashboard Overview</h1>
        <div className="date-chip">
          <CalendarDays size={16} />
          <span>{formatDate(today, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`icon-tile ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong>{loading ? "—" : value}</strong>
          </article>
        ))}
      </div>

      <div className="dashboard-lower">
        <section className="card recent-card">
          <div className="card-heading">
            <div>
              <h2>Recent Payments</h2>
            </div>
            <button className="text-link" onClick={() => onNavigate("records")}>
              View All <ArrowRight size={15} />
            </button>
          </div>

          <div className="recent-table-head">
            <span>REFERENCE NUMBER</span>
            <span>PAYMENT DATE</span>
            <span>AMOUNT</span>
            <span />
          </div>

          {loading ? (
            <div className="empty-state compact">
              <span className="spinner" />
              <p>Loading records…</p>
            </div>
          ) : records.length ? (
            <div className="recent-list">
              {records.slice(0, 5).map((record) => (
                <div className="recent-row" key={record.id}>
                  <div className="reference-cell">
                    <span className="file-mini">
                      <FileCheck2 size={16} />
                    </span>
                    <span>
                      <b>{record.reference}</b>
                      <small>
                        {record.source === "scan"
                          ? "Scanned"
                          : record.source === "imported"
                            ? "Imported"
                            : "Manual"}
                      </small>
                    </span>
                  </div>
                  <span>{formatDate(record.paymentDate)}</span>
                  <strong>PKR {formatMoney(record.paymentAmount)}</strong>
                  <BadgeCheck size={16} className="row-check" />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <div className="empty-illustration">
                <Files size={24} />
              </div>
              <h3>No payments recorded yet</h3>
              <button className="text-link" onClick={() => onNavigate("single")}>
                Scan your first bill <ArrowRight size={15} />
              </button>
            </div>
          )}
        </section>

        <section className="card quick-card">
          <div className="card-heading">
            <div>
              <h2>Quick Actions</h2>
            </div>
          </div>

          <div className="quick-list">
            {quick.map(({ title, icon: Icon, color, view }) => (
              <button className="quick-action" key={title} onClick={() => onNavigate(view)}>
                <span className={`icon-tile ${color}`}>
                  <Icon size={19} />
                </span>
                <span className="quick-copy">
                  <b>{title}</b>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>

          <button className="export-inline" onClick={() => onExport()}>
            <span className="export-inline-icon">
              <ArrowDownToLine size={17} />
            </span>
            <span>Export all records to Excel (.xlsx)</span>
          </button>
        </section>
      </div>
    </div>
  );
}
