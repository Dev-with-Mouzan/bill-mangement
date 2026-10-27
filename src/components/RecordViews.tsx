"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, ArrowDownToLine, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, FilePlus2, FileSpreadsheet, LoaderCircle, Pencil, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { formatDate, formatMoney, isValidDate, newClientId, todayLocal, validAmount, type Payment } from "@/lib/bills";
import type { ConfirmOptions, Filters, NoticeType, SavePayments, ViewName } from "@/lib/ui";

type SharedProps = { records: Payment[]; onMessage: (message: string, type?: NoticeType) => void; onSave: SavePayments; saving: boolean };

export function ManualEntry({ records, onMessage, onSave, saving, onNavigate }: SharedProps & { onNavigate: (view: ViewName) => void }) {
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayLocal);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef(newClientId());
  const duplicate = !!reference.trim() && records.some(record => record.reference === reference.trim() && record.requestKey !== requestId.current);
  const valid = !!reference.trim() && reference.trim().length <= 128 && isValidDate(paymentDate) && validAmount(amount) && !duplicate;
  const changed = () => { requestId.current = newClientId(); setError(""); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) { setError(duplicate ? "This reference number is already in your records." : "Enter a reference number, a valid payment date, and a positive amount."); return; }
    try {
      const result = await onSave([{ clientId: requestId.current, reference: reference.trim(), paymentDate, paymentAmount: amount, source: "manual" }]);
      if (result.failed.length) { setError(result.failed[0].error); return; }
      setReference(""); setPaymentDate(todayLocal()); setAmount(""); requestId.current = newClientId(); setError("");
      onMessage("Payment saved and added to your Excel workbook.", "success");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save this payment. Please try again."); }
  };
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> ADD A PAYMENT</div><h1>Manual entry</h1><p>No barcode? Add your payment details by hand.</p></div><div className="subtle-pill"><ShieldCheck size={15}/> Your data stays yours</div></div>
    <div className="manual-layout"><section className="card manual-card"><div className="card-heading"><div><h2>Payment details</h2><p>Fill in the details from your electricity bill</p></div><span className="icon-tile mint"><FilePlus2 size={20}/></span></div>
      <form onSubmit={save} className="manual-form">
        {(error || duplicate) && <div className="inline-alert warning"><AlertCircle size={17}/><span>{error || "This reference number is already in your records."}</span></div>}
        <label><span>Bill reference number <i>*</i></span><input value={reference} onChange={event => { setReference(event.target.value); changed(); }} placeholder="e.g. 0012345678901" autoComplete="off"/><small>We’ll keep the number exactly as entered, including any leading zeros.</small></label>
        <label><span>Payment date <i>*</i></span><input type="date" value={paymentDate} onChange={event => { setPaymentDate(event.target.value); changed(); }}/><small>The actual date you are recording the bill as paid.</small></label>
        <label><span>Payment amount <i>*</i></span><div className="amount-input"><span>PKR</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => { setAmount(event.target.value); changed(); }} placeholder="0.00"/></div><small>Enter the amount paid in Pakistani rupees.</small></label>
        <div className="manual-divider"/><button className="button button-primary full-button" disabled={saving} type="submit">{saving ? <LoaderCircle size={17} className="spin"/> : <CheckCircle2 size={17}/>} {saving ? "Saving payment…" : "Save payment"} <ArrowRight size={16}/></button>
      </form>
    </section><aside><div className="card manual-guide"><span className="icon-tile blue"><FileCheck2 size={20}/></span><span className="tiny-label">GOOD TO KNOW</span><h2>Every payment,<br/>in its place.</h2><p>Manual entries live alongside scanned bills, so you always have a complete picture.</p><div className="guide-item"><span><CheckCircle2 size={17}/></span><div><b>Easy to find</b><small>Search by reference or payment date.</small></div></div><div className="guide-item"><span><CheckCircle2 size={17}/></span><div><b>Always Excel-ready</b><small>Your workbook is updated when you save.</small></div></div><div className="guide-item"><span><CheckCircle2 size={17}/></span><div><b>No duplicates</b><small>We’ll warn you if a reference already exists.</small></div></div></div><button className="manual-scan-link" onClick={() => onNavigate("single")}><span>Have a barcode instead?<small>Scan your bill in a few seconds</small></span><ChevronRight size={18}/></button></aside></div>
  </>;
}

export function RecordsView({ records, loading, search, setSearch, onExport, onMessage, askConfirm, refresh, exporting }: { records: Payment[]; loading: boolean; search: string; setSearch: Dispatch<SetStateAction<string>>; onExport: (filters?: Filters) => void; onMessage: (message: string, type?: NoticeType) => void; askConfirm: (options: ConfirmOptions) => void; refresh: () => Promise<void>; exporting: boolean }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editError, setEditError] = useState("");
  const [busy, setBusy] = useState(false);
  const invalidRange = !!from && !!to && from > to;
  const filtered = records.filter(record => (!search.trim() || record.reference.toLowerCase().includes(search.trim().toLowerCase())) && (!from || record.paymentDate >= from) && (!to || record.paymentDate <= to));
  const total = filtered.reduce((sum, record) => sum + Number(record.paymentAmount), 0);
  const hasFilters = !!search || !!from || !!to;
  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editing) return;
    if (!editing.reference.trim() || !isValidDate(editing.paymentDate) || !validAmount(editing.paymentAmount)) { setEditError("Please enter a valid reference, date, and positive amount."); return; }
    setBusy(true); setEditError("");
    try {
      const response = await fetch("/api/payments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, reference: editing.reference, paymentDate: editing.paymentDate, paymentAmount: editing.paymentAmount }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not update the record.");
      await refresh(); setEditing(null); onMessage("Payment record updated.", "success");
    } catch (error) { setEditError(error instanceof Error ? error.message : "Could not update the record."); } finally { setBusy(false); }
  };
  const remove = (record: Payment) => askConfirm({ title: "Delete payment record?", description: `The payment for reference ${record.reference} will be removed from your records and workbook. This cannot be undone.`, confirmLabel: "Delete record", danger: true, onConfirm: async () => {
    try {
      const response = await fetch(`/api/payments?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not delete the record.");
      await refresh(); onMessage("Payment record deleted.", "success");
    } catch (error) { onMessage(error instanceof Error ? error.message : "Could not delete the record.", "error"); }
  }});
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR PAYMENT HISTORY</div><h1>Payment records</h1><p>All your electricity payments, right where you need them.</p></div><button className="button button-outline" onClick={() => onExport()} disabled={exporting}><ArrowDownToLine size={16}/> Export all</button></div>
    <div className="record-summary"><div><span className="icon-tile mint"><FileCheck2 size={19}/></span><span><small>SHOWING RECORDS</small><b>{filtered.length} <em>of {records.length}</em></b></span></div><i/><div><span className="icon-tile blue"><CircleDollarSign size={19}/></span><span><small>SELECTED TOTAL</small><b>PKR {formatMoney(total)}</b></span></div><div className="record-summary-note"><ShieldCheck size={15}/> Your records are safely organized</div></div>
    <section className="card records-card"><div className="card-heading"><div><h2>All payments <span className="count-badge">{filtered.length}</span></h2><p>Search, filter, or make changes to your records</p></div><button className="button button-soft" onClick={() => onExport({ search, from, to })} disabled={exporting || invalidRange}><FileSpreadsheet size={16}/> Export {hasFilters ? "filtered" : "records"}</button></div>
      <div className="filter-row"><label className="filter-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by reference number" aria-label="Search by reference number"/></label><label className="filter-date"><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="From date"/></label><label className="filter-date"><span>To</span><input type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="To date"/></label>{hasFilters && <button className="clear-filter" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>Clear</button>}</div>
      {invalidRange && <div className="inline-alert warning filter-alert"><AlertCircle size={16}/> The start date must be on or before the end date.</div>}
      <div className="table-scroll"><table className="data-table records-table"><thead><tr><th>REFERENCE NUMBER</th><th>PAYMENT DATE</th><th>PAYMENT AMOUNT</th><th>ENTRY TYPE</th><th>STATUS</th><th/></tr></thead><tbody>{!invalidRange && filtered.map(record => <tr key={record.id}><td><div className="reference-cell"><span className="file-mini"><FileCheck2 size={16}/></span><span><b>{record.reference}</b><small>Electricity bill</small></span></div></td><td><span className="date-cell"><CalendarDays size={15}/>{formatDate(record.paymentDate)}</span></td><td><strong>PKR {formatMoney(record.paymentAmount)}</strong></td><td><span className="entry-type">{record.source === "scan" ? "Scanned" : record.source === "imported" ? "Imported" : "Manual"}</span></td><td><span className="status-pill success"><span className="status-dot"/> Recorded</span></td><td><div className="row-actions"><button onClick={() => { setEditing({ ...record }); setEditError(""); }} aria-label={`Edit ${record.reference}`}><Pencil size={15}/></button><button onClick={() => remove(record)} aria-label={`Delete ${record.reference}`}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
      {loading ? <div className="empty-state"><span className="spinner"/><p>Loading your records…</p></div> : (!filtered.length || invalidRange) && <div className="empty-state"><div className="empty-illustration"><FileCheck2 size={24}/><span><Search size={12}/></span></div><h3>{hasFilters ? "No matching payments" : "No payments recorded yet"}</h3><p>{hasFilters ? "Try a different reference or date range." : "Your scanned and manually added bills will appear here."}</p></div>}
      <div className="records-footer"><span>Showing {invalidRange ? 0 : filtered.length} of {records.length} records</span><span>All amounts in PKR</span></div>
    </section>
    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditing(null); }}><div className="modal" role="dialog" aria-modal="true" aria-label="Edit payment record"><button className="modal-close" onClick={() => setEditing(null)} aria-label="Close" disabled={busy}><X size={19}/></button><div className="modal-icon"><Pencil size={20}/></div><h2>Edit payment record</h2><p>Update the recorded payment details below.</p><form className="edit-form" onSubmit={saveEdit}>{editError && <div className="inline-alert warning"><AlertCircle size={16}/>{editError}</div>}<label><span>Reference number</span><input value={editing.reference} onChange={event => setEditing({ ...editing, reference: event.target.value })}/></label><label><span>Payment date</span><input type="date" value={editing.paymentDate} onChange={event => setEditing({ ...editing, paymentDate: event.target.value })}/></label><label><span>Payment amount (PKR)</span><input type="number" min="0.01" step="0.01" value={editing.paymentAmount} onChange={event => setEditing({ ...editing, paymentAmount: event.target.value })}/></label><div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setEditing(null)} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div></form></div></div>}
  </>;
}
