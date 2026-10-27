"use client";

import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, ArrowRight, Barcode, Camera, Check, CheckCircle2, ChevronDown, FileScan, Keyboard, Layers3, LoaderCircle, Pencil, ScanLine, Settings2, Trash2 } from "lucide-react";
import { billPayload, formatDate, formatMoney, parseBarcode, selectedAmount, validateBill, type BillDraft, type ParserConfig, type Payment } from "@/lib/bills";
import type { ConfirmOptions, NoticeType, SavePayments } from "@/lib/ui";

type CommonProps = {
  records: Payment[];
  config: ParserConfig;
  setConfig: Dispatch<SetStateAction<ParserConfig>>;
  onSave: SavePayments;
  onMessage: (message: string, type?: NoticeType) => void;
  saving: boolean;
  askConfirm: (options: ConfirmOptions) => void;
};

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
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = scanner.current;
      if (current?.isScanning) void current.stop().catch(() => undefined);
    };
  }, []);

  const stop = async () => {
    const current = scanner.current;
    if (current?.isScanning) {
      try { await current.stop(); } catch { /* Camera stopped */ }
    }
    if (mounted.current) setActive(false);
  };

  const start = async () => {
    setError("");
    setStarting(true);
    try {
      const { Html5Qrcode: Reader } = await import("html5-qrcode");
      const current = new Reader(readerId, { verbose: false });
      scanner.current = current;
      await current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          const now = Date.now();
          if (lastScan.current.value === decodedText && now - lastScan.current.time < 4000) return;
          lastScan.current = { value: decodedText, time: now };
          readRef.current(decodedText);
          if (!batch) void stop();
        },
        () => undefined
      );
      if (!mounted.current) { await current.stop(); return; }
      setActive(true);
    } catch {
      setError("Camera not available or access denied. You can manually enter/paste barcodes below.");
    } finally {
      if (mounted.current) setStarting(false);
    }
  };

  const submit = () => {
    if (!input.trim()) return;
    setError("");
    readRef.current(input.trim());
    setInput("");
  };

  return (
    <section className={`card capture-card ${batch ? "capture-batch" : ""}`}>
      <div className="card-heading">
        <div>
          <h2>{batch ? "Batch Scanner" : "Barcode Scanner"}</h2>
        </div>
        <span className="icon-tile mint"><ScanLine size={19} /></span>
      </div>

      <div className={`camera-surface ${active ? "camera-active" : ""}`}>
        <div id={readerId} className="camera-reader" />
        {!active && (
          <div className="camera-placeholder">
            <div className="scan-frame">
              <span /><span /><span /><span />
              <Barcode size={44} strokeWidth={1.3} />
              <i />
            </div>
            <strong>Position barcode in frame</strong>
          </div>
        )}
        {active && <div className="camera-live"><i /> LIVE CAMERA</div>}
      </div>

      <button
        className={`button ${active ? "button-outline" : "button-primary"} camera-button`}
        onClick={() => active ? void stop() : void start()}
        disabled={starting}
      >
        {starting ? <LoaderCircle size={17} className="spin" /> : <Camera size={17} />}
        {starting ? "Starting camera…" : active ? "Stop Camera" : "Start Camera"}
      </button>

      {error && <div className="inline-alert error"><AlertCircle size={16} /><span>{error}</span></div>}

      <div className="or-divider"><span />OR ENTER BARCODE<span /></div>

      <div className="barcode-input">
        <Keyboard size={18} />
        <input
          id={`${readerId}-input`}
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); submit(); } }}
          placeholder="Type, paste, or scan with handheld scanner"
          autoComplete="off"
        />
        <button onClick={submit} aria-label="Submit barcode"><ArrowRight size={18} /></button>
      </div>

      <div className="example-line">
        <span>Test Barcode: <button onClick={() => readRef.current(EXAMPLE)}>Load Example</button></span>
      </div>
    </section>
  );
}

export function ParserSettings({ config, setConfig, expanded = false }: { config: ParserConfig; setConfig: Dispatch<SetStateAction<ParserConfig>>; expanded?: boolean }) {
  const positionFields: Array<[keyof ParserConfig, string]> = [
    ["monthPosition", "Billing Month"],
    ["referencePosition", "Reference Number"],
    ["amountPosition", "Original Amount"],
    ["duePosition", "Due Date"],
    ["latePosition", "Late Amount"]
  ];

  return (
    <details className="card parser-settings" open={expanded || undefined}>
      <summary>
        <span className="parser-summary-icon"><Settings2 size={17} /></span>
        <span><b>Barcode Format Configuration</b></span>
        <ChevronDown size={17} />
      </summary>
      <div className="parser-body">
        <div className="form-grid two">
          <label>
            <span>Delimiter Separator</span>
            <input value={config.separator} maxLength={5} onChange={event => setConfig(prev => ({ ...prev, separator: event.target.value }))} placeholder="e.g. -" />
          </label>
          <label>
            <span>Due Date Format</span>
            <select value={config.dateFormat} onChange={event => setConfig(prev => ({ ...prev, dateFormat: event.target.value as ParserConfig["dateFormat"] }))}>
              <option>YYYYMMDD</option>
              <option>DDMMYYYY</option>
              <option>YYYY-MM-DD</option>
              <option>DD/MM/YYYY</option>
            </select>
          </label>
        </div>
        <div className="form-grid two" style={{ marginTop: "12px" }}>
          <label>
            <span>Amount Format</span>
            <select value={config.amountEncoding} onChange={event => setConfig(prev => ({ ...prev, amountEncoding: event.target.value as ParserConfig["amountEncoding"] }))}>
              <option value="rupees">Whole Rupees</option>
              <option value="paisa">Paisa (÷ 100)</option>
              <option value="decimal">Decimal</option>
            </select>
          </label>
          {positionFields.map(([key, label]) => (
            <label key={key}>
              <span>{label} Index</span>
              <input
                type="number"
                min="1"
                max="30"
                value={config[key] as number}
                onChange={event => setConfig(prev => ({ ...prev, [key]: Math.max(1, Math.min(30, Number(event.target.value) || 1)) }))}
              />
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

function isDuplicate(bill: BillDraft, records: Payment[], queue: BillDraft[] = []) {
  const ref = bill.reference.trim();
  return !!ref && (records.some(record => record.reference === ref && record.requestKey !== bill.clientId) || queue.filter(item => item.reference.trim() === ref).length > 1);
}

function BillEditor({ bill, update, duplicate, saving, onSubmit, submitLabel = "Save Payment", allowInvalid = false }: { bill: BillDraft; update: (bill: BillDraft) => void; duplicate: boolean; saving?: boolean; onSubmit: () => void; submitLabel?: string; allowInvalid?: boolean }) {
  const errors = validateBill(bill);
  const amount = selectedAmount(bill);
  const change = (key: keyof BillDraft, value: string) => update({ ...bill, [key]: value, saveError: undefined });

  return (
    <div className="bill-editor">
      <div className="card-heading editor-heading">
        <div>
          <h2>Bill Information</h2>
        </div>
        <span className={`status-pill ${errors.length || duplicate ? "warning" : "success"}`}>
          {errors.length || duplicate ? "Needs Review" : "Valid"}
        </span>
      </div>

      {(errors.length > 0 || duplicate || bill.saveError) && (
        <div className="inline-alert warning">
          <AlertCircle size={17} />
          <div>
            <b>{duplicate ? "Duplicate Reference" : bill.saveError ? "Error" : "Incomplete Details"}</b>
            <span>{duplicate ? "This bill reference is already in records or in the queue." : bill.saveError || errors.join(" ")}</span>
          </div>
        </div>
      )}

      <div className="form-grid two bill-fields">
        <label className="full">
          <span>Reference Number <i>*</i></span>
          <input value={bill.reference} onChange={event => change("reference", event.target.value)} autoComplete="off" />
        </label>
        <label>
          <span>Billing Month <i>*</i></span>
          <input type="month" value={bill.billingMonth} onChange={event => change("billingMonth", event.target.value)} />
        </label>
        <label>
          <span>Due Date <i>*</i></span>
          <input type="date" value={bill.dueDate} onChange={event => change("dueDate", event.target.value)} />
        </label>
        <label>
          <span>Original Amount (PKR) <i>*</i></span>
          <input type="number" min="0.01" step="0.01" value={bill.originalAmount} onChange={event => change("originalAmount", event.target.value)} />
        </label>
        <label>
          <span>Late Amount (PKR) <i>*</i></span>
          <input type="number" min="0.01" step="0.01" value={bill.lateAmount} onChange={event => change("lateAmount", event.target.value)} />
        </label>
        <label className="full">
          <span>Payment Date <i>*</i></span>
          <input type="date" value={bill.paymentDate} onChange={event => change("paymentDate", event.target.value)} />
        </label>
      </div>

      <div className="selected-amount">
        <div>
          <span>CALCULATED AMOUNT</span>
          <strong>{amount === null ? "—" : `PKR ${formatMoney(amount)}`}</strong>
        </div>
        <button
          className="button button-primary"
          onClick={onSubmit}
          disabled={saving || (!allowInvalid && (errors.length > 0 || duplicate))}
        >
          {saving ? <LoaderCircle size={17} className="spin" /> : <CheckCircle2 size={17} />}
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function SingleScan({ records, config, setConfig, onSave, onMessage, saving, askConfirm, bill, setBill }: CommonProps & { bill: BillDraft | null; setBill: Dispatch<SetStateAction<BillDraft | null>> }) {
  const read = (raw: string) => {
    const replace = () => setBill(parseBarcode(raw, config));
    if (bill) askConfirm({ title: "Replace scan?", description: "Replace current unsaved bill with new scan?", confirmLabel: "Replace", onConfirm: replace });
    else replace();
  };

  const save = async () => {
    if (!bill) return;
    try {
      const result = await onSave([billPayload(bill)]);
      if (result.failed.length) { setBill({ ...bill, saveError: result.failed[0].error }); onMessage(result.failed[0].error, "error"); return; }
      setBill(null);
      onMessage("Payment saved successfully.", "success");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not save payment.", "error");
    }
  };

  return (
    <div className="scan-page">
      <div className="page-heading">
        <div>
          <h1>Single Bill Scanner</h1>
        </div>
      </div>

      <div className="workflow-grid">
        <div className="workflow-side">
          <ScannerCapture onRead={read} />
          <ParserSettings config={config} setConfig={setConfig} />
        </div>
        <section className="card review-card">
          {bill ? (
            <BillEditor bill={bill} update={setBill} duplicate={isDuplicate(bill, records)} saving={saving} onSubmit={() => void save()} />
          ) : (
            <div className="review-empty">
              <div className="review-graphic"><FileScan size={33} /></div>
              <h2>Scan a bill to view details</h2>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function BatchScan({ records, config, setConfig, onSave, onMessage, saving, askConfirm, batch, setBatch }: CommonProps & { batch: BillDraft[]; setBatch: Dispatch<SetStateAction<BillDraft[]>> }) {
  const [editId, setEditId] = useState<string | null>(null);
  const editing = batch.find(item => item.clientId === editId);
  const valid = batch.filter(item => validateBill(item).length === 0 && !isDuplicate(item, records, batch));
  const total = valid.reduce((sum, item) => sum + (selectedAmount(item) ?? 0), 0);

  const read = (raw: string) => {
    if (batch.length >= 1000) { onMessage("Queue limit reached.", "error"); return; }
    setBatch(previous => [...previous, parseBarcode(raw, config)]);
  };

  const save = () => {
    if (!valid.length) return;
    askConfirm({
      title: `Save ${valid.length} payments?`,
      description: `Save all valid bills to the database.`,
      confirmLabel: "Save All",
      onConfirm: async () => {
        try {
          const result = await onSave(valid.map(billPayload));
          const savedIds = new Set(result.saved.map(item => item.clientId));
          const failures = new Map(result.failed.map(item => [item.clientId, item.error]));
          setBatch(previous => previous.filter(item => !savedIds.has(item.clientId)).map(item => failures.has(item.clientId) ? { ...item, saveError: failures.get(item.clientId) } : item));
          if (result.failed.length) onMessage(`${result.saved.length} saved; ${result.failed.length} failed.`, "error");
          else onMessage(`Saved ${result.saved.length} bills successfully.`, "success");
        } catch (error) {
          onMessage(error instanceof Error ? error.message : "Saving failed.", "error");
        }
      }
    });
  };

  return (
    <div className="batch-page">
      <div className="page-heading">
        <div>
          <h1>Batch Scanning</h1>
        </div>
        <div className="batch-actions">
          <button className="button button-primary" onClick={save} disabled={!valid.length || saving}>
            {saving ? <LoaderCircle size={17} className="spin" /> : <CheckCircle2 size={17} />}
            Save Batch ({valid.length})
          </button>
        </div>
      </div>

      <div className="batch-top-clean">
        <ScannerCapture onRead={read} batch />
        <ParserSettings config={config} setConfig={setConfig} />
      </div>

      <section className="card batch-queue" style={{ marginTop: "20px" }}>
        <div className="card-heading">
          <div>
            <h2>Scanned Bills Queue ({batch.length})</h2>
          </div>
          <div className="queue-total">
            <small>TOTAL PAYABLE</small>
            <strong>PKR {formatMoney(total)}</strong>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table batch-table">
            <thead>
              <tr>
                <th>REFERENCE NUMBER</th>
                <th>DUE DATE</th>
                <th>ORIGINAL</th>
                <th>LATE</th>
                <th>PAYABLE</th>
                <th>PAYMENT DATE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {batch.map(item => {
                const duplicate = isDuplicate(item, records, batch);
                const errors = validateBill(item);
                const amount = selectedAmount(item);
                const issue = duplicate || errors.length > 0 || !!item.saveError;
                return (
                  <tr key={item.clientId} className={issue ? "row-warning" : ""}>
                    <td><b>{item.reference || "Missing"}</b></td>
                    <td>{formatDate(item.dueDate)}</td>
                    <td>{item.originalAmount ? `PKR ${formatMoney(item.originalAmount)}` : "—"}</td>
                    <td>{item.lateAmount ? `PKR ${formatMoney(item.lateAmount)}` : "—"}</td>
                    <td><b>{amount === null ? "—" : `PKR ${formatMoney(amount)}`}</b></td>
                    <td>{formatDate(item.paymentDate)}</td>
                    <td>
                      <span className={`status-pill ${issue ? "warning" : "success"}`}>
                        {duplicate ? "Duplicate" : issue ? "Needs review" : "Ready"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => setEditId(item.clientId)} aria-label="Edit"><Pencil size={15} /></button>
                        <button onClick={() => setBatch(prev => prev.filter(e => e.clientId !== item.clientId))} aria-label="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!batch.length && (
          <div className="empty-state queue-empty">
            <h3>Queue is empty</h3>
            <p>Scan bills with the camera or barcode scanner above.</p>
          </div>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditId(null); }}>
          <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Edit bill">
            <BillEditor
              bill={editing}
              update={updated => setBatch(prev => prev.map(i => i.clientId === updated.clientId ? updated : i))}
              duplicate={isDuplicate(editing, records, batch)}
              allowInvalid
              submitLabel="Done"
              onSubmit={() => setEditId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsView({ config, setConfig }: { config: ParserConfig; setConfig: Dispatch<SetStateAction<ParserConfig>> }) {
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <h1>Barcode Settings</h1>
          <p>Configure parser positions and formats for your electricity bills.</p>
        </div>
      </div>
      <div className="settings-layout-clean">
        <ParserSettings config={config} setConfig={setConfig} expanded />
      </div>
    </div>
  );
}
