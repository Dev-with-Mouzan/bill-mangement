"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowDownToLine, Check, CheckCircle2, FilePlus2, LayoutDashboard, Layers3, LoaderCircle, ScanLine, Settings, Settings2, TableProperties, X, Zap } from "lucide-react";
import { DEFAULT_PARSER_CONFIG, type BillDraft, type ParserConfig, type Payment } from "@/lib/bills";
import type { ConfirmOptions, Filters, NoticeType, SaveResult, ViewName } from "@/lib/ui";
import { Overview } from "@/components/Overview";
import { BatchScan, SettingsView, SingleScan } from "@/components/ScannerViews";
import { ManualEntry, RecordsView } from "@/components/RecordViews";

const validViews: ViewName[] = ["overview", "single", "batch", "manual", "records", "settings"];

type Toast = { message: string; type: NoticeType } | null;

export default function BillFlowApp() {
  const [view, setView] = useState<ViewName>("overview");
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

  const notify = useCallback((message: string, type: NoticeType = "info") => setToast({ message, type }), []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/payments", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load payment records.");
    setRecords(result.records);
    setLoadError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load records."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    try {
      const savedBatch = JSON.parse(localStorage.getItem("billflow-batch-v1") || "[]");
      if (Array.isArray(savedBatch)) {
        setBatch(savedBatch.filter((item: unknown) => !!item && typeof item === "object" && typeof (item as BillDraft).clientId === "string" && typeof (item as BillDraft).reference === "string").slice(0, 1000));
      }
      const savedConfig = JSON.parse(localStorage.getItem("billflow-parser-v1") || "null");
      if (savedConfig && typeof savedConfig === "object") {
        const base = { ...DEFAULT_PARSER_CONFIG };
        if (typeof savedConfig.separator === "string" && savedConfig.separator.length <= 5) base.separator = savedConfig.separator;
        for (const key of ["monthPosition", "referencePosition", "amountPosition", "duePosition", "latePosition"] as const) {
          if (Number.isInteger(savedConfig[key]) && savedConfig[key] >= 1 && savedConfig[key] <= 30) base[key] = savedConfig[key];
        }
        if (["YYYYMMDD", "DDMMYYYY", "YYYY-MM-DD", "DD/MM/YYYY"].includes(savedConfig.dateFormat)) base.dateFormat = savedConfig.dateFormat;
        if (["rupees", "paisa", "decimal"].includes(savedConfig.amountEncoding)) base.amountEncoding = savedConfig.amountEncoding;
        setConfig(base);
      }
    } catch { /* Ignore storage errors */ }

    const syncView = () => {
      const value = new URL(window.location.href).searchParams.get("view") as ViewName | null;
      setView(value && validViews.includes(value) ? value : "overview");
    };
    syncView();
    setHydrated(true);
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem("billflow-batch-v1", JSON.stringify(batch)); } catch {}
    }
  }, [batch, hydrated]);

  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem("billflow-parser-v1", JSON.stringify(config)); } catch {}
    }
  }, [config, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = useCallback((next: ViewName) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const savePayments = async (entries: Array<Record<string, unknown>>): Promise<SaveResult> => {
    setSaving(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: entries })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save payment.");
      await refresh().catch(() => setLoadError("Record saved, but refresh failed. Please reload."));
      return result as SaveResult;
    } finally {
      setSaving(false);
    }
  };

  const exportRecords = async (filters: Filters = {}) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.search?.trim()) params.set("search", filters.search.trim());
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const response = await fetch(`/api/export${params.size ? `?${params}` : ""}`);
      if (!response.ok) throw new Error("Could not export records.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "electricity_bill_records.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Excel workbook downloaded successfully.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not export records.", "error");
    } finally {
      setExporting(false);
    }
  };

  const common = { records, config, setConfig, onSave: savePayments, onMessage: notify, saving, askConfirm: setConfirmation };

  const navItems: Array<{ view: ViewName; label: string; icon: typeof LayoutDashboard }> = [
    { view: "overview", label: "Overview", icon: LayoutDashboard },
    { view: "single", label: "Scan Bill", icon: ScanLine },
    { view: "batch", label: "Batch Scan", icon: Layers3 },
    { view: "manual", label: "Manual Entry", icon: FilePlus2 },
    { view: "records", label: "Records", icon: TableProperties },
  ];

  return (
    <div className="app-shell">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-container">
          <button className="navbar-brand" onClick={() => navigate("overview")} aria-label="Billflow Home">
            <span className="navbar-brand-icon"><Zap size={18} fill="currentColor" /></span>
            <span className="navbar-brand-title">BillFlow</span>
          </button>

          <nav className="navbar-nav" aria-label="Main Navigation">
            {navItems.map(({ view: itemView, label, icon: Icon }) => (
              <button
                key={itemView}
                className={`navbar-link ${view === itemView ? "active" : ""}`}
                onClick={() => navigate(itemView)}
              >
                <Icon size={16} />
                <span>{label}</span>
                {itemView === "batch" && batch.length > 0 && (
                  <span className="navbar-badge">{batch.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="navbar-actions">
            <button
              className={`navbar-icon-btn ${view === "settings" ? "active" : ""}`}
              onClick={() => navigate("settings")}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {loadError && (
          <div className="global-error">
            <AlertCircle size={17} />
            <span>{loadError}</span>
            <button onClick={() => { setLoading(true); void refresh().finally(() => setLoading(false)); }}>
              Retry
            </button>
          </div>
        )}

        {view === "overview" && <Overview records={records} loading={loading} onNavigate={navigate} onExport={filters => void exportRecords(filters)} />}
        {view === "single" && <SingleScan {...common} bill={single} setBill={setSingle} />}
        {view === "batch" && <BatchScan {...common} batch={batch} setBatch={setBatch} />}
        {view === "manual" && <ManualEntry records={records} onMessage={notify} onSave={savePayments} saving={saving} onNavigate={navigate} />}
        {view === "records" && <RecordsView records={records} loading={loading} search={search} setSearch={setSearch} onExport={filters => void exportRecords(filters)} onMessage={notify} askConfirm={setConfirmation} refresh={refresh} exporting={exporting} />}
        {view === "settings" && <SettingsView config={config} setConfig={setConfig} />}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Close notification"><X size={15} /></button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmation && (
        <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmation(null); }}>
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true">
            <div className={`modal-icon ${confirmation.danger ? "danger" : ""}`}>
              {confirmation.danger ? <AlertCircle size={21} /> : <Check size={21} />}
            </div>
            <h2>{confirmation.title}</h2>
            <p>{confirmation.description}</p>
            <div className="modal-actions">
              <button className="button button-outline" onClick={() => setConfirmation(null)}>Cancel</button>
              <button
                className={`button ${confirmation.danger ? "button-danger" : "button-primary"}`}
                onClick={() => {
                  const action = confirmation.onConfirm;
                  setConfirmation(null);
                  void action();
                }}
              >
                {confirmation.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
