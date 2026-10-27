"use client";

import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, ArrowDownToLine, ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, FileCheck2, FilePlus2, FileSpreadsheet, LoaderCircle, Pencil, Search, Trash2, X } from "lucide-react";
import { formatDate, formatMoney, isValidDate, newClientId, todayLocal, validAmount, type Payment } from "@/lib/bills";
import type { ConfirmOptions, Filters, NoticeType, SavePayments, ViewName } from "@/lib/ui";

type SharedProps = {
  records: Payment[];
  onMessage: (message: string, type?: NoticeType) => void;
  onSave: SavePayments;
  saving: boolean;
};

export function ManualEntry({ records, onMessage, onSave, saving, onNavigate }: SharedProps & { onNavigate: (view: ViewName) => void }) {
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayLocal);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef(newClientId());

  const duplicate = !!reference.trim() && records.some(record => record.reference === reference.trim() && record.requestKey !== requestId.current);
  const valid = !!reference.trim() && reference.trim().length <= 128 && isValidDate(paymentDate) && validAmount(amount) && !duplicate;

  const changed = () => {
    requestId.current = newClientId();
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setError(duplicate ? "This reference number is already in your records." : "Enter a reference number, a valid payment date, and a positive amount.");
      return;
    }
    try {
      const result = await onSave([{ clientId: requestId.current, reference: reference.trim(), paymentDate, paymentAmount: amount, source: "manual" }]);
      if (result.failed.length) {
        setError(result.failed[0].error);
        return;
      }
      setReference("");
      setPaymentDate(todayLocal());
      setAmount("");
      requestId.current = newClientId();
      setError("");
      onMessage("Payment saved successfully.", "success");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save this payment.");
    }
  };

  return (
    <div className="manual-page">
      <div className="page-heading">
        <div>
          <h1>Manual Payment Entry</h1>
          <p>Add bill payment details directly without a barcode.</p>
        </div>
      </div>

      <div className="manual-layout-clean">
        <section className="card manual-card-clean">
          <form onSubmit={save} className="manual-form">
            {(error || duplicate) && (
              <div className="inline-alert warning">
                <AlertCircle size={17} />
                <span>{error || "This reference number is already in your records."}</span>
              </div>
            )}

            <div className="form-grid two">
              <label className="full">
                <span>Bill Reference Number <i>*</i></span>
                <input
                  value={reference}
                  onChange={event => { setReference(event.target.value); changed(); }}
                  placeholder="e.g. 0012345678901"
                  autoComplete="off"
                />
              </label>

              <label>
                <span>Payment Date <i>*</i></span>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={event => { setPaymentDate(event.target.value); changed(); }}
                />
              </label>

              <label>
                <span>Payment Amount (PKR) <i>*</i></span>
                <div className="amount-input">
                  <span>PKR</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={event => { setAmount(event.target.value); changed(); }}
                    placeholder="0.00"
                  />
                </div>
              </label>
            </div>

            <div className="manual-form-actions">
              <button className="button button-primary" disabled={saving} type="submit">
                {saving ? <LoaderCircle size={17} className="spin" /> : <CheckCircle2 size={17} />}
                {saving ? "Saving…" : "Save Payment"}
              </button>
              <button className="button button-outline" type="button" onClick={() => onNavigate("single")}>
                Scan Barcode Instead
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export function RecordsView({
  records,
  loading,
  search,
  setSearch,
  onExport,
  onMessage,
  askConfirm,
  refresh,
  exporting
}: {
  records: Payment[];
  loading: boolean;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  onExport: (filters?: Filters) => void;
  onMessage: (message: string, type?: NoticeType) => void;
  askConfirm: (options: ConfirmOptions) => void;
  refresh: () => Promise<void>;
  exporting: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editError, setEditError] = useState("");
  const [busy, setBusy] = useState(false);

  const invalidRange = !!from && !!to && from > to;
  const filtered = records.filter(record =>
    (!search.trim() || record.reference.toLowerCase().includes(search.trim().toLowerCase())) &&
    (!from || record.paymentDate >= from) &&
    (!to || record.paymentDate <= to)
  );
  const total = filtered.reduce((sum, record) => sum + Number(record.paymentAmount), 0);
  const hasFilters = !!search || !!from || !!to;

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!editing.reference.trim() || !isValidDate(editing.paymentDate) || !validAmount(editing.paymentAmount)) {
      setEditError("Please enter a valid reference, date, and positive amount.");
      return;
    }
    setBusy(true);
    setEditError("");
    try {
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          reference: editing.reference,
          paymentDate: editing.paymentDate,
          paymentAmount: editing.paymentAmount
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the record.");
      await refresh();
      setEditing(null);
      onMessage("Payment record updated.", "success");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not update the record.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (record: Payment) =>
    askConfirm({
      title: "Delete payment record?",
      description: `Payment ${record.reference} will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/payments?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Could not delete record.");
          await refresh();
          onMessage("Payment record deleted.", "success");
        } catch (error) {
          onMessage(error instanceof Error ? error.message : "Could not delete record.", "error");
        }
      }
    });

  return (
    <div className="records-page">
      <div className="page-heading">
        <h1>Payment Records</h1>
      </div>

      <div className="stats-grid two-cards">
        <article className="stat-card">
          <div className="stat-top">
            <span>RECORDS</span>
            <span className="icon-tile mint"><FileCheck2 size={19} /></span>
          </div>
          <strong>{filtered.length} of {records.length}</strong>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>TOTAL AMOUNT</span>
            <span className="icon-tile blue"><CircleDollarSign size={19} /></span>
          </div>
          <strong>PKR {formatMoney(total)}</strong>
        </article>
      </div>

      <section className="card records-card">
        <div className="filter-row">
          <label className="filter-search">
            <Search size={17} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search reference number..."
              aria-label="Search reference number"
            />
          </label>
          <div className="filter-dates">
            <label className="filter-date">
              <span>From</span>
              <input type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="From date" />
            </label>
            <label className="filter-date">
              <span>To</span>
              <input type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="To date" />
            </label>
          </div>
          {hasFilters && (
            <button className="clear-filter" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>
              Clear
            </button>
          )}
          <button
            className="button button-primary filter-export-btn"
            onClick={() => onExport({ search, from, to })}
            disabled={exporting || invalidRange}
          >
            <ArrowDownToLine size={15} /> Export to Excel
          </button>
        </div>

        {invalidRange && (
          <div className="inline-alert warning filter-alert">
            <AlertCircle size={16} /> The start date must be on or before the end date.
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table records-table">
            <thead>
              <tr>
                <th>REFERENCE NUMBER</th>
                <th>PAYMENT DATE</th>
                <th>AMOUNT</th>
                <th>SOURCE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {!invalidRange &&
                filtered.map(record => (
                  <tr key={record.id}>
                    <td>
                      <b>{record.reference}</b>
                    </td>
                    <td>
                      <span className="date-cell">
                        <CalendarDays size={15} />
                        {formatDate(record.paymentDate)}
                      </span>
                    </td>
                    <td>
                      <strong>PKR {formatMoney(record.paymentAmount)}</strong>
                    </td>
                    <td>
                      <span className="entry-type">
                        {record.source === "scan" ? "Scanned" : record.source === "imported" ? "Imported" : "Manual"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => { setEditing({ ...record }); setEditError(""); }} aria-label="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => remove(record)} aria-label="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading records…</p>
          </div>
        ) : (!filtered.length || invalidRange) && (
          <div className="empty-state">
            <h3>{hasFilters ? "No matching payments found" : "No payment records yet"}</h3>
          </div>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditing(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit payment record">
            <button className="modal-close" onClick={() => setEditing(null)} aria-label="Close" disabled={busy}>
              <X size={19} />
            </button>
            <div className="modal-icon"><Pencil size={20} /></div>
            <h2>Edit Record</h2>
            <form className="edit-form" onSubmit={saveEdit}>
              {editError && <div className="inline-alert warning"><AlertCircle size={16} />{editError}</div>}
              <label>
                <span>Reference number</span>
                <input value={editing.reference} onChange={event => setEditing({ ...editing, reference: event.target.value })} />
              </label>
              <label>
                <span>Payment date</span>
                <input type="date" value={editing.paymentDate} onChange={event => setEditing({ ...editing, paymentDate: event.target.value })} />
              </label>
              <label>
                <span>Amount (PKR)</span>
                <input type="number" min="0.01" step="0.01" value={editing.paymentAmount} onChange={event => setEditing({ ...editing, paymentAmount: event.target.value })} />
              </label>
              <div className="modal-actions">
                <button className="button button-outline" type="button" onClick={() => setEditing(null)} disabled={busy}>
                  Cancel
                </button>
                <button className="button button-primary" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
