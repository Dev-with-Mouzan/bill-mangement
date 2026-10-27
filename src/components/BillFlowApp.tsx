"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, CircleHelp, FilePlus2, LayoutDashboard, Layers3, LoaderCircle, Menu, ScanLine, Search, Settings2, ShieldCheck, TableProperties, X, Zap } from "lucide-react";
import { DEFAULT_PARSER_CONFIG, type BillDraft, type ParserConfig, type Payment } from "@/lib/bills";
import type { ConfirmOptions, Filters, NoticeType, SaveResult, ViewName } from "@/lib/ui";
import { Overview } from "@/components/Overview";
import { BatchScan, SettingsView, SingleScan } from "@/components/ScannerViews";
import { ManualEntry, RecordsView } from "@/components/RecordViews";

const validViews: ViewName[] = ["overview", "single", "batch", "manual", "records", "settings"];
const viewLabels: Record<ViewName, string> = { overview: "Overview", single: "Single bill scan", batch: "Batch scanning", manual: "Manual entry", records: "Payment records", settings: "Barcode settings" };

type Toast = { message: string; type: NoticeType } | null;

export default function BillFlowApp() {
  const [view, setView] = useState<ViewName>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [records, setRecords] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState<BillDraft[]>([]);
  const [single, setSingle] = useState<BillDraft | null>(null);
  const [config, setConfig] = useState<ParserConfig>(DEFAULT_PARSER_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const notify = useCallback((message: string, type: NoticeType = "info") => setToast({ message, type }), []);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/payments", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load payment records.");
    setRecords(result.records); setLoadError("");
  }, []);
  useEffect(() => {
    let cancelled = false;
    refresh().catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load payment records."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);
  useEffect(() => {
    try {
      const savedBatch = JSON.parse(localStorage.getItem("billflow-batch-v1") || "[]");
      if (Array.isArray(savedBatch)) setBatch(savedBatch.filter((item: unknown) => !!item && typeof item === "object" && typeof (item as BillDraft).clientId === "string" && typeof (item as BillDraft).reference === "string" && typeof (item as BillDraft).rawBarcode === "string").slice(0, 1000));
      const savedConfig = JSON.parse(localStorage.getItem("billflow-parser-v1") || "null");
      if (savedConfig && typeof savedConfig === "object") {
        const base = { ...DEFAULT_PARSER_CONFIG };
        if (typeof savedConfig.separator === "string" && savedConfig.separator.length <= 5) base.separator = savedConfig.separator;
        for (const key of ["monthPosition", "referencePosition", "amountPosition", "duePosition", "latePosition"] as const) if (Number.isInteger(savedConfig[key]) && savedConfig[key] >= 1 && savedConfig[key] <= 30) base[key] = savedConfig[key];
        if (["YYYYMMDD", "DDMMYYYY", "YYYY-MM-DD", "DD/MM/YYYY"].includes(savedConfig.dateFormat)) base.dateFormat = savedConfig.dateFormat;
        if (["rupees", "paisa", "decimal"].includes(savedConfig.amountEncoding)) base.amountEncoding = savedConfig.amountEncoding;
        setConfig(base);
      }
    } catch { /* Ignore invalid local settings without affecting server records. */ }
    const syncView = () => { const value = new URL(window.location.href).searchParams.get("view") as ViewName | null; setView(value && validViews.includes(value) ? value : "overview"); };
    syncView(); setHydrated(true); window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);
  useEffect(() => { if (hydrated) { try { localStorage.setItem("billflow-batch-v1", JSON.stringify(batch)); } catch { /* Keep in memory if storage is unavailable. */ } } }, [batch, hydrated]);
  useEffect(() => { if (hydrated) { try { localStorage.setItem("billflow-parser-v1", JSON.stringify(config)); } catch { /* Settings still work for this session. */ } } }, [config, hydrated]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 5000); return () => window.clearTimeout(timer); }, [toast]);
  const navigate = useCallback((next: ViewName) => {
    setView(next); setMobileMenu(false);
    const url = new URL(window.location.href); if (next === "overview") url.searchParams.delete("view"); else url.searchParams.set("view", next); window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const savePayments = async (entries: Array<Record<string, unknown>>): Promise<SaveResult> => {
    setSaving(true);
    try {
      const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: entries }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your payments. Your unsaved entries are still available.");
      await refresh().catch(() => setLoadError("The payment was saved, but the record list could not be refreshed. Please reload."));
      return result as SaveResult;
    } finally { setSaving(false); }
  };
  const exportRecords = async (filters: Filters = {}) => {
    setExporting(true);
    try {
      const params = new URLSearchParams(); if (filters.search?.trim()) params.set("search", filters.search.trim()); if (filters.from) params.set("from", filters.from); if (filters.to) params.set("to", filters.to);
      const response = await fetch(`/api/export${params.size ? `?${params}` : ""}`);
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Could not export records."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "electricity_bill_records.xlsx"; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Your Excel workbook is ready to download.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not export records.", "error"); } finally { setExporting(false); }
  };
  const common = { records, config, setConfig, onSave: savePayments, onMessage: notify, saving, askConfirm: setConfirmation };
  const navGroups: Array<{ title: string; items: Array<{ view: ViewName; label: string; icon: typeof LayoutDashboard }> }> = [
    { title: "WORKSPACE", items: [{ view: "overview", label: "Overview", icon: LayoutDashboard }, { view: "single", label: "Single bill scan", icon: ScanLine }, { view: "batch", label: "Batch scanning", icon: Layers3 }, { view: "manual", label: "Manual entry", icon: FilePlus2 }] },
    { title: "MANAGE", items: [{ view: "records", label: "Payment records", icon: TableProperties }, { view: "settings", label: "Barcode settings", icon: Settings2 }] },
  ];
  return <div className="app-shell">
    {mobileMenu && <button className="sidebar-scrim" onClick={() => setMobileMenu(false)} aria-label="Close menu"/>}
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <button className="brand" onClick={() => navigate("overview")} aria-label="Billflow home"><span className="brand-mark"><Zap size={22} fill="currentColor"/></span><span className="brand-word">bill<span>flow</span><small>PAYMENT WORKSPACE</small></span></button>
      <div className="sidebar-separator"/>
      <nav className="side-nav" aria-label="Main navigation">{navGroups.map(group => <div className="nav-group" key={group.title}><div className="nav-label">{group.title}</div>{group.items.map(({ view: itemView, label, icon: Icon }) => <button key={itemView} className={`nav-item ${view === itemView ? "active" : ""}`} onClick={() => navigate(itemView)}><Icon size={18} strokeWidth={1.8}/><span>{label}</span>{itemView === "batch" && batch.length > 0 && <small className="nav-count">{batch.length}</small>}{view === itemView && <span className="active-indicator"/>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><div className="sidebar-tip-icon"><FilePlus2 size={18}/></div><b>All your bills, together.</b><p>A little organization goes a long way.</p><button onClick={() => navigate("single")}>Scan your first bill <ArrowUpRight size={14}/></button></div><button className="help-link" onClick={() => setHelpOpen(true)}><CircleHelp size={17}/> Help & tips <ArrowUpRight size={15}/></button><div className="side-profile"><span className="profile-avatar"><Zap size={15} fill="currentColor"/></span><span><b>Personal workspace</b><small><i/> Ready to go</small></span><ChevronRight size={16}/></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-left"><button className="mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21}/></button><span className="crumb-muted">Workspace</span><ChevronRight size={14} className="crumb-chevron"/><span className="crumb-current">{viewLabels[view]}</span></div><div className="topbar-right"><form className="top-search" onSubmit={event => { event.preventDefault(); navigate("records"); }}><button type="submit" aria-label="Open record search"><Search size={17}/></button><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records..." aria-label="Search records"/><kbd>↵</kbd></form><button className="button header-export" onClick={() => void exportRecords()} disabled={exporting}>{exporting ? <LoaderCircle size={16} className="spin"/> : <ArrowDownToLine size={16}/>} <span>Export Excel</span></button><span className="header-avatar" title="Personal workspace">P</span></div></header>
      <main className="main-content">{loadError && <div className="global-error"><AlertCircle size={17}/><span>{loadError}</span><button onClick={() => { setLoading(true); void refresh().catch(error => setLoadError(error.message)).finally(() => setLoading(false)); }}>Retry</button></div>}
        {view === "overview" && <Overview records={records} loading={loading} onNavigate={navigate} onExport={filters => void exportRecords(filters)}/>}
        {view === "single" && <SingleScan {...common} bill={single} setBill={setSingle}/>}
        {view === "batch" && <BatchScan {...common} batch={batch} setBatch={setBatch}/>}
        {view === "manual" && <ManualEntry records={records} onMessage={notify} onSave={savePayments} saving={saving} onNavigate={navigate}/>}
        {view === "records" && <RecordsView records={records} loading={loading} search={search} setSearch={setSearch} onExport={filters => void exportRecords(filters)} onMessage={notify} askConfirm={setConfirmation} refresh={refresh} exporting={exporting}/>}
        {view === "settings" && <SettingsView config={config} setConfig={setConfig}/>}
      </main>
    </div>
    {toast && <div className={`toast toast-${toast.type}`} role="status">{toast.type === "error" ? <AlertCircle size={19}/> : <CheckCircle2 size={19}/>}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss message"><X size={16}/></button></div>}
    {confirmation && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmation(null); }}><div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><div className={`modal-icon ${confirmation.danger ? "danger" : ""}`}>{confirmation.danger ? <AlertCircle size={21}/> : <Check size={21}/>}</div><h2 id="confirm-title">{confirmation.title}</h2><p>{confirmation.description}</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirmation(null)}>Cancel</button><button className={`button ${confirmation.danger ? "button-danger" : "button-primary"}`} onClick={() => { const action = confirmation.onConfirm; setConfirmation(null); void action(); }}>{confirmation.confirmLabel || "Confirm"}</button></div></div></div>}
    {helpOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setHelpOpen(false); }}><div className="modal help-modal" role="dialog" aria-modal="true" aria-label="Help and tips"><button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Close"><X size={19}/></button><div className="modal-icon"><CircleHelp size={21}/></div><h2>A little help, right here.</h2><p>Here are a few tips to get you started with Billflow.</p><div className="help-list"><div><b>1</b><span><strong>Set your barcode format</strong><small>Providers use different layouts. Adjust the parser settings to match your bill.</small></span></div><div><b>2</b><span><strong>Scan and review</strong><small>Use your camera, a keyboard scanner, or enter a payment manually.</small></span></div><div><b>3</b><span><strong>Keep a copy</strong><small>Export all records or a filtered selection to Excel at any time.</small></span></div></div><button className="button button-primary full-button" onClick={() => { setHelpOpen(false); navigate("settings"); }}>Open barcode settings <ArrowRight size={16}/></button></div></div>}
  </div>;
}
