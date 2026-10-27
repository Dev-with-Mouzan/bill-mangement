"use client";

import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, ArrowRight, Barcode, Camera, Check, CheckCircle2, ChevronDown, CircleHelp, FileScan, Keyboard, Layers3, LoaderCircle, Pencil, ScanLine, Settings2, ShieldCheck, Trash2, X, Zap } from "lucide-react";
import { billPayload, formatDate, formatMoney, parseBarcode, selectedAmount, validateBill, type BillDraft, type ParserConfig, type Payment } from "@/lib/bills";
import type { ConfirmOptions, NoticeType, SavePayments } from "@/lib/ui";

type CommonProps = { records: Payment[]; config: ParserConfig; setConfig: Dispatch<SetStateAction<ParserConfig>>; onSave: SavePayments; onMessage: (message: string, type?: NoticeType) => void; saving: boolean; askConfirm: (options: ConfirmOptions) => void };
const EXAMPLE = "202610-0012345678901-000000005000-20261020-000000005250";

function ScannerCapture({ onRead, batch = false }: { onRead: (raw: string) => void; batch?: boolean }) {
  const reactId = useId();
  const readerId = `reader-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const scanner = useRef<Html5Qrcode | null>(null);
  const mounted = useRef(true);
  const readRef = useRef(onRead);
  const lastScan = useRef({ value: "", time: 0 });
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { readRef.current = onRead; }, [onRead]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; const current = scanner.current; if (current?.isScanning) void current.stop().catch(() => undefined); }; }, []);
  const stop = async () => {
    const current = scanner.current;
    if (current?.isScanning) { try { await current.stop(); } catch { /* Camera may already be stopped. */ } }
    if (mounted.current) setActive(false);
  };
  const start = async () => {
    setError(""); setStarting(true);
    try {
      const { Html5Qrcode: Reader } = await import("html5-qrcode");
      const current = new Reader(readerId, { verbose: false });
      scanner.current = current;
      await current.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, (decodedText) => {
        const now = Date.now();
        if (lastScan.current.value === decodedText && now - lastScan.current.time < 4000) return;
        lastScan.current = { value: decodedText, time: now };
        readRef.current(decodedText);
        if (!batch) void stop();
      }, () => undefined);
      if (!mounted.current) { await current.stop(); return; }
      setActive(true);
    } catch {
      setError("Camera could not start. Allow camera access on a secure connection, or use the barcode input below.");
    } finally { if (mounted.current) setStarting(false); }
  };
  const submit = () => {
    if (!input.trim()) { setError("Scan or enter a barcode first."); return; }
    setError(""); readRef.current(input.trim()); setInput("");
  };
  return <section className={`card capture-card ${batch ? "capture-batch" : ""}`}>
    <div className="card-heading"><div><h2>{batch ? "Scan your bills" : "Capture barcode"}</h2><p>{batch ? "Keep scanning to build your queue" : "Use your camera or a barcode scanner"}</p></div><span className="icon-tile mint"><ScanLine size={19}/></span></div>
    <div className={`camera-surface ${active ? "camera-active" : ""}`}>
      <div id={readerId} className="camera-reader"/>
      {!active && <div className="camera-placeholder"><div className="scan-frame"><span/><span/><span/><span/><Barcode size={44} strokeWidth={1.3}/><i/></div><strong>Ready when you are</strong><small>Position the barcode inside the frame</small></div>}
      {active && <div className="camera-live"><i/> CAMERA LIVE</div>}
    </div>
    <button className={`button ${active ? "button-outline" : "button-primary"} camera-button`} onClick={() => active ? void stop() : void start()} disabled={starting}>{starting ? <LoaderCircle size={17} className="spin"/> : <Camera size={17}/>} {starting ? "Starting camera…" : active ? "Stop camera" : "Start camera"}</button>
    {error && <div className="inline-alert error"><AlertCircle size={16}/><span>{error}</span></div>}
    <div className="or-divider"><span/>OR USE A SCANNER<span/></div>
    <label className="field-label" htmlFor={`${readerId}-input`}>Barcode input <span>USB / Bluetooth supported</span></label>
    <div className="barcode-input"><Keyboard size={18}/><input id={`${readerId}-input`} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} placeholder="Scan or paste barcode here" autoComplete="off"/><button onClick={submit} aria-label="Read barcode"><ArrowRight size={18}/></button></div>
    <p className="helper-text">Click the field above, then scan with your device or press Enter.</p>
    <div className="example-line"><CircleHelp size={15}/><span>Just exploring? <button onClick={() => readRef.current(EXAMPLE)}>Try an example barcode</button></span></div>
  </section>;
}

export function ParserSettings({ config, setConfig, expanded = false }: { config: ParserConfig; setConfig: Dispatch<SetStateAction<ParserConfig>>; expanded?: boolean }) {
  const positionFields: Array<[keyof ParserConfig, string]> = [["monthPosition", "Billing month"], ["referencePosition", "Reference"], ["amountPosition", "Original amount"], ["duePosition", "Due date"], ["latePosition", "Late amount"]];
  return <details className="card parser-settings" open={expanded || undefined}>
    <summary><span className="parser-summary-icon"><Settings2 size={17}/></span><span><b>Barcode format settings</b><small>Configure fields for your bill provider</small></span><ChevronDown size={17}/></summary>
    <div className="parser-body"><p>Formats vary by provider. Set the separator, field positions, date format, and amount encoding to match your actual barcode. Positions start at 1.</p>
      <div className="form-grid two"><label><span>Separator</span><input value={config.separator} maxLength={5} onChange={event => setConfig(prev => ({ ...prev, separator: event.target.value }))} placeholder="e.g. - or |"/></label><label><span>Due date format</span><select value={config.dateFormat} onChange={event => setConfig(prev => ({ ...prev, dateFormat: event.target.value as ParserConfig["dateFormat"] }))}><option>YYYYMMDD</option><option>DDMMYYYY</option><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option></select></label></div>
      <div className="form-grid two"><label><span>Amount encoding</span><select value={config.amountEncoding} onChange={event => setConfig(prev => ({ ...prev, amountEncoding: event.target.value as ParserConfig["amountEncoding"] }))}><option value="rupees">Whole rupees</option><option value="paisa">Paisa (÷ 100)</option><option value="decimal">Decimal rupees</option></select></label>{positionFields.map(([key, label]) => <label key={key}><span>{label} position</span><input type="number" min="1" max="30" value={config[key] as number} onChange={event => setConfig(prev => ({ ...prev, [key]: Math.max(1, Math.min(30, Number(event.target.value) || 1)) }))}/></label>)}</div>
      <div className="format-example"><b>Default example</b><code>{EXAMPLE}</code><small>Billing month is YYYYMM. Adjust these settings before scanning a different format.</small></div>
    </div>
  </details>;
}

function isDuplicate(bill: BillDraft, records: Payment[], queue: BillDraft[] = []) {
  const ref = bill.reference.trim();
  return !!ref && (records.some(record => record.reference === ref && record.requestKey !== bill.clientId) || queue.filter(item => item.reference.trim() === ref).length > 1);
}

function BillEditor({ bill, update, duplicate, saving, onSubmit, submitLabel = "Save payment", allowInvalid = false }: { bill: BillDraft; update: (bill: BillDraft) => void; duplicate: boolean; saving?: boolean; onSubmit: () => void; submitLabel?: string; allowInvalid?: boolean }) {
  const errors = validateBill(bill);
  const amount = selectedAmount(bill);
  const change = (key: keyof BillDraft, value: string) => update({ ...bill, [key]: value, saveError: undefined });
  return <div className="bill-editor">
    <div className="card-heading editor-heading"><div><h2>Review bill details</h2><p>Check the extracted information before saving</p></div><span className={`status-pill ${errors.length || duplicate ? "warning" : "success"}`}>{errors.length || duplicate ? "Needs review" : "Ready to save"}</span></div>
    {(errors.length > 0 || duplicate || bill.saveError) && <div className="inline-alert warning"><AlertCircle size={17}/><div><b>{duplicate ? "Duplicate reference number" : bill.saveError ? "Could not save this bill" : "This bill needs a little attention"}</b><span>{duplicate ? "This reference is already saved or appears more than once in the queue." : bill.saveError || errors.join(" ")}</span></div></div>}
    <div className="form-grid two bill-fields">
      <label className="full"><span>Reference number <i>*</i></span><input value={bill.reference} onChange={event => change("reference", event.target.value)} placeholder="Enter bill reference number" autoComplete="off"/><small>Leading zeros are preserved.</small></label>
      <label><span>Billing month <i>*</i></span><input type="month" value={bill.billingMonth} onChange={event => change("billingMonth", event.target.value)}/></label>
      <label><span>Due date <i>*</i></span><input type="date" value={bill.dueDate} onChange={event => change("dueDate", event.target.value)}/></label>
      <label><span>Original amount (PKR) <i>*</i></span><input type="number" min="0.01" step="0.01" value={bill.originalAmount} onChange={event => change("originalAmount", event.target.value)} placeholder="0.00"/></label>
      <label><span>Late amount (PKR) <i>*</i></span><input type="number" min="0.01" step="0.01" value={bill.lateAmount} onChange={event => change("lateAmount", event.target.value)} placeholder="0.00"/></label>
      <label className="full"><span>Payment date <i>*</i></span><input type="date" value={bill.paymentDate} onChange={event => change("paymentDate", event.target.value)}/><small>Use the actual date the bill is being recorded as paid.</small></label>
    </div>
    <div className="selected-amount"><div><span>SELECTED PAYMENT AMOUNT</span><strong>{amount === null ? "Needs verification" : `PKR ${formatMoney(amount)}`}</strong><small>{amount === null ? "Enter valid dates and amounts to calculate." : bill.paymentDate <= bill.dueDate ? "Original amount · paid on or before due date" : "Late amount · paid after due date"}</small></div><span className="selected-icon"><Zap size={19} fill="currentColor"/></span></div>
    <details className="raw-details"><summary>View original barcode <ChevronDown size={15}/></summary><code>{bill.rawBarcode}</code></details>
    <button className="button button-primary full-button" disabled={saving || (!allowInvalid && (errors.length > 0 || duplicate))} onClick={onSubmit}>{saving ? <LoaderCircle size={17} className="spin"/> : <CheckCircle2 size={17}/>} {saving ? "Saving payment…" : submitLabel}</button>
  </div>;
}

export function SingleScan({ records, config, setConfig, onSave, onMessage, saving, askConfirm, bill, setBill }: CommonProps & { bill: BillDraft | null; setBill: Dispatch<SetStateAction<BillDraft | null>> }) {
  const read = (raw: string) => {
    const replace = () => setBill(parseBarcode(raw, config));
    if (bill) askConfirm({ title: "Replace current scan?", description: "The bill you are reviewing has not been saved yet. Replace it with the new scan?", confirmLabel: "Replace scan", onConfirm: replace });
    else replace();
  };
  const save = async () => {
    if (!bill) return;
    try {
      const result = await onSave([billPayload(bill)]);
      if (result.failed.length) { setBill({ ...bill, saveError: result.failed[0].error }); onMessage(result.failed[0].error, "error"); return; }
      setBill(null); onMessage("Payment saved and added to your Excel workbook.", "success");
    } catch (error) { onMessage(error instanceof Error ? error.message : "Could not save your payment.", "error"); }
  };
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SCAN & SAVE</div><h1>Single bill scan</h1><p>Scan a barcode, review the details, and you’re all set.</p></div><div className="subtle-pill"><ShieldCheck size={15}/> Secure & simple</div></div>
    <div className="workflow-grid"><div className="workflow-side"><ScannerCapture onRead={read}/><ParserSettings config={config} setConfig={setConfig}/></div><section className="card review-card">{bill ? <BillEditor bill={bill} update={setBill} duplicate={isDuplicate(bill, records)} saving={saving} onSubmit={() => void save()}/> : <div className="review-empty"><div className="review-graphic"><FileScan size={33}/><span><Zap size={15} fill="currentColor"/></span></div><h2>Your bill details will appear here</h2><p>Scan a barcode using your camera, or enter it with a USB or Bluetooth scanner to get started.</p><div className="review-steps"><span><b>1</b> Scan barcode</span><i/><span><b>2</b> Review details</span><i/><span><b>3</b> Save payment</span></div></div>}</section></div>
  </>;
}

export function BatchScan({ records, config, setConfig, onSave, onMessage, saving, askConfirm, batch, setBatch }: CommonProps & { batch: BillDraft[]; setBatch: Dispatch<SetStateAction<BillDraft[]>> }) {
  const [editId, setEditId] = useState<string | null>(null);
  const editing = batch.find(item => item.clientId === editId);
  const valid = batch.filter(item => validateBill(item).length === 0 && !isDuplicate(item, records, batch));
  const total = valid.reduce((sum, item) => sum + (selectedAmount(item) ?? 0), 0);
  const read = (raw: string) => {
    if (batch.length >= 1000) { onMessage("The queue can hold up to 1,000 bills at a time.", "error"); return; }
    setBatch(previous => [...previous, parseBarcode(raw, config)]);
  };
  const save = () => {
    if (!valid.length) return;
    const invalidCount = batch.length - valid.length;
    askConfirm({ title: `Save ${valid.length} ${valid.length === 1 ? "payment" : "payments"}?`, description: `The valid bills will be saved to your records and Excel workbook.${invalidCount ? ` ${invalidCount} bill${invalidCount === 1 ? "" : "s"} needing attention will stay in your queue.` : ""}`, confirmLabel: "Save payments", onConfirm: async () => {
      try {
        const result = await onSave(valid.map(billPayload));
        const savedIds = new Set(result.saved.map(item => item.clientId));
        const failures = new Map(result.failed.map(item => [item.clientId, item.error]));
        setBatch(previous => previous.filter(item => !savedIds.has(item.clientId)).map(item => failures.has(item.clientId) ? { ...item, saveError: failures.get(item.clientId) } : item));
        if (result.failed.length) onMessage(`${result.saved.length} saved; ${result.failed.length} could not be saved and remain in the queue.`, "error");
        else onMessage(`${result.saved.length} ${result.saved.length === 1 ? "payment" : "payments"} saved to your workbook.`, "success");
      } catch (error) { onMessage(error instanceof Error ? error.message : "Saving failed. Your queue has been kept.", "error"); }
    }});
  };
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SCAN & SAVE</div><h1>Batch bill scanning</h1><p>Scan one after another. We’ll keep them together for you.</p></div><div className="subtle-pill"><Layers3 size={15}/> {batch.length} in queue</div></div>
    <div className="batch-top"><div><ScannerCapture onRead={read} batch/><ParserSettings config={config} setConfig={setConfig}/></div><div className="batch-aside"><div className="card batch-intro"><div className="batch-intro-icon"><Layers3 size={22}/></div><span className="tiny-label">MADE FOR BUSY DAYS</span><h2>More bills.<br/>Less busywork.</h2><p>Leave the camera open and scan your bills one by one. Review everything in your queue before saving.</p><div className="mini-step"><span>01</span> Scan or enter a barcode <Check size={15}/></div><div className="mini-step"><span>02</span> Review the payment details <Check size={15}/></div><div className="mini-step"><span>03</span> Save your valid bills together <Check size={15}/></div></div><div className="batch-safe"><ShieldCheck size={19}/><span><b>Your queue stays put</b><small>Unsaved bills are kept on this device, even if you leave this page.</small></span></div></div></div>
    <section className="card batch-queue"><div className="card-heading"><div><h2>Scanning queue <span className="count-badge">{batch.length}</span></h2><p>Review, edit, or remove bills before saving</p></div><div className="queue-total"><small>VALID TOTAL</small><strong>PKR {formatMoney(total)}</strong></div></div>
      <div className="table-scroll"><table className="data-table batch-table"><thead><tr><th>REFERENCE NUMBER</th><th>DUE DATE</th><th>ORIGINAL</th><th>LATE AMOUNT</th><th>PAYABLE</th><th>PAYMENT DATE</th><th>STATUS</th><th/></tr></thead><tbody>{batch.map(item => {
        const duplicate = isDuplicate(item, records, batch); const errors = validateBill(item); const amount = selectedAmount(item); const issue = duplicate || errors.length > 0 || !!item.saveError;
        return <tr key={item.clientId} className={issue ? "row-warning" : ""}><td><b>{item.reference || "Missing reference"}</b><small>{item.billingMonth || "Missing month"}</small></td><td>{formatDate(item.dueDate)}</td><td>{item.originalAmount ? `PKR ${formatMoney(item.originalAmount)}` : "—"}</td><td>{item.lateAmount ? `PKR ${formatMoney(item.lateAmount)}` : "—"}</td><td><b>{amount === null ? "—" : `PKR ${formatMoney(amount)}`}</b></td><td>{formatDate(item.paymentDate)}</td><td><span className={`status-pill ${issue ? "warning" : "success"}`}>{duplicate ? "Duplicate" : issue ? "Needs review" : "Ready"}</span>{item.saveError && <small className="row-error">{item.saveError}</small>}</td><td><div className="row-actions"><button onClick={() => setEditId(item.clientId)} aria-label={`Edit ${item.reference || "bill"}`}><Pencil size={15}/></button><button onClick={() => setBatch(previous => previous.filter(entry => entry.clientId !== item.clientId))} aria-label={`Remove ${item.reference || "bill"}`}><Trash2 size={15}/></button></div></td></tr>;
      })}</tbody></table></div>
      {!batch.length && <div className="empty-state queue-empty"><div className="empty-illustration"><Layers3 size={24}/><span><Zap size={12} fill="currentColor"/></span></div><h3>Your queue is empty</h3><p>Scanned bills will appear here, ready for your review.</p></div>}
      <div className="queue-footer"><span><b>{valid.length}</b> ready to save {batch.length - valid.length > 0 && <em>· {batch.length - valid.length} need review</em>}</span><button className="button button-primary" onClick={save} disabled={!valid.length || saving}>{saving ? <LoaderCircle size={17} className="spin"/> : <CheckCircle2 size={17}/>} {saving ? "Saving…" : "Save all to Excel"}</button></div>
    </section>
    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditId(null); }}><div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Edit queued bill"><button className="modal-close" onClick={() => setEditId(null)} aria-label="Close"><X size={19}/></button><BillEditor bill={editing} update={updated => setBatch(previous => previous.map(item => item.clientId === updated.clientId ? updated : item))} duplicate={isDuplicate(editing, records, batch)} allowInvalid submitLabel="Done editing" onSubmit={() => setEditId(null)}/></div></div>}
  </>;
}

export function SettingsView({ config, setConfig }: { config: ParserConfig; setConfig: Dispatch<SetStateAction<ParserConfig>> }) {
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> MAKE IT YOURS</div><h1>Barcode settings</h1><p>Make scanning work with the format on your electricity bills.</p></div></div><div className="settings-layout"><ParserSettings config={config} setConfig={setConfig} expanded/><div className="card settings-note"><span className="icon-tile mint"><CircleHelp size={20}/></span><h2>Not sure about the format?</h2><p>Electricity providers use different barcode layouts. The default format is an example, not a universal standard.</p><p>Check the field order and encoding against a real bill before saving. If anything is missing, you can correct it during review.</p><div className="settings-safe"><ShieldCheck size={17}/> Settings are saved on this device.</div></div></div></>;
}
