"use client";

import { ArrowDownToLine, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Check, ChevronRight, CircleDollarSign, FileCheck2, FilePlus2, Files, Layers3, ScanLine, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { formatDate, formatMoney, todayLocal, type Payment } from "@/lib/bills";
import type { Filters, ViewName } from "@/lib/ui";

type Props = { records: Payment[]; loading: boolean; onNavigate: (view: ViewName) => void; onExport: (filters?: Filters) => void };

function BillIllustration() {
  return <div className="hero-art" aria-hidden="true">
    <div className="hero-orbit hero-orbit-one"/><div className="hero-orbit hero-orbit-two"/>
    <span className="hero-spark hero-spark-one"><Sparkles size={19}/></span><span className="hero-spark hero-spark-two"><Zap size={15} fill="currentColor"/></span>
    <div className="art-card-back"><div/><div/><div/></div>
    <div className="art-bill">
      <div className="art-bill-top"><span className="art-bolt"><Zap size={17} fill="currentColor"/></span><span><i/><i/></span><span className="art-dots">•••</span></div>
      <div className="art-bill-line long"/><div className="art-bill-line short"/>
      <div className="art-bill-amount"><span/><b/></div>
      <div className="art-barcode"/>
      <div className="art-scan-corner tl"/><div className="art-scan-corner tr"/><div className="art-scan-corner bl"/><div className="art-scan-corner br"/>
    </div>
    <div className="art-check"><Check size={20} strokeWidth={3}/></div>
    <div className="art-floating"><span><Check size={13} strokeWidth={3}/></span><div><b>All organized</b><small>Ready when you are</small></div></div>
  </div>;
}

export function Overview({ records, loading, onNavigate, onExport }: Props) {
  const total = records.reduce((sum, record) => sum + Number(record.paymentAmount), 0);
  const today = todayLocal();
  const scannedToday = records.filter((record) => record.source === "scan" && new Date(record.createdAt).toLocaleDateString("en-CA") === today).length;
  const stats = [
    { label: "Total bills recorded", value: String(records.length), caption: "All your bills in one place", icon: FileCheck2, color: "mint" },
    { label: "Total amount paid", value: `PKR\u00a0${formatMoney(total)}`, caption: "Across all payment records", icon: CircleDollarSign, color: "blue" },
    { label: "Bills scanned today", value: String(scannedToday), caption: "A little progress goes a long way", icon: ScanLine, color: "lilac" },
  ];
  const quick = [
    { title: "Scan a single bill", description: "Capture and save a bill instantly", icon: ScanLine, color: "mint", view: "single" as const },
    { title: "Batch scanning", description: "Add multiple bills in one go", icon: Layers3, color: "blue", view: "batch" as const },
    { title: "Manual entry", description: "Add a payment by hand", icon: FilePlus2, color: "peach", view: "manual" as const },
  ];
  return <>
    <div className="page-heading overview-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR WORKSPACE</div><h1>Overview <span className="heading-wave">✦</span></h1><p>Everything you need to keep your bills in order.</p></div>
      <div className="date-chip"><CalendarDays size={16}/><span>{formatDate(today, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span></div>
    </div>
    <section className="welcome-banner">
      <div className="welcome-copy">
        <div className="welcome-label"><span><Zap size={12} fill="currentColor"/></span> A LITTLE LESS PAPERWORK</div>
        <h2>Bill management,<br/><em>made effortless.</em></h2>
        <p>Scan, organize, and keep track of your electricity<br className="desktop-break"/> payments, all in one simple workspace.</p>
        <div className="welcome-actions"><button className="button button-dark" onClick={() => onNavigate("single")}><ScanLine size={17}/> Scan a bill <ArrowRight size={15}/></button><button className="button button-light" onClick={() => onNavigate("manual")}>Add manually <ArrowUpRight size={15}/></button></div>
        <div className="welcome-trust"><ShieldCheck size={14}/> Your records, safe and organized</div>
      </div>
      <BillIllustration/>
    </section>
    <div className="section-heading stats-heading"><div><h2>At a glance</h2><p>A quick look at your payment activity</p></div><span className="section-kicker">YOUR SUMMARY</span></div>
    <div className="stats-grid">
      {stats.map(({ label, value, caption, icon: Icon, color }) => <article className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`icon-tile ${color}`}><Icon size={19}/></span></div><strong>{loading ? "—" : value}</strong><div className="stat-caption"><span className="stat-dot"/>{caption}</div></article>)}
    </div>
    <div className="dashboard-lower">
      <section className="card recent-card">
        <div className="card-heading"><div><h2>Recent payments</h2><p>Your latest recorded electricity bills</p></div><button className="text-link" onClick={() => onNavigate("records")}>View all <ArrowRight size={15}/></button></div>
        <div className="recent-table-head"><span>REFERENCE NUMBER</span><span>PAYMENT DATE</span><span>AMOUNT</span><span/></div>
        {loading ? <div className="empty-state compact"><span className="spinner"/><p>Loading your records…</p></div> : records.length ? <div className="recent-list">{records.slice(0, 4).map(record => <div className="recent-row" key={record.id}><div className="reference-cell"><span className="file-mini"><FileCheck2 size={16}/></span><span><b>{record.reference}</b><small>{record.source === "scan" ? "Scanned bill" : record.source === "imported" ? "Imported" : "Manual entry"}</small></span></div><span>{formatDate(record.paymentDate)}</span><strong>PKR {formatMoney(record.paymentAmount)}</strong><BadgeCheck size={16} className="row-check"/></div>)}</div> : <div className="empty-state compact"><div className="empty-illustration"><Files size={24}/><span><Zap size={12} fill="currentColor"/></span></div><h3>No payments just yet</h3><p>Once you add a bill, it will show up here.</p><button className="text-link" onClick={() => onNavigate("single")}>Scan your first bill <ArrowRight size={15}/></button></div>}
      </section>
      <section className="card quick-card"><div className="card-heading"><div><h2>Quick actions</h2><p>What would you like to do?</p></div><span className="quick-bolt"><Zap size={16}/></span></div><div className="quick-list">{quick.map(({ title, description, icon: Icon, color, view }) => <button className="quick-action" key={title} onClick={() => onNavigate(view)}><span className={`icon-tile ${color}`}><Icon size={19}/></span><span className="quick-copy"><b>{title}</b><small>{description}</small></span><ChevronRight size={17}/></button>)}</div><button className="export-inline" onClick={() => onExport()}><span className="export-inline-icon"><ArrowDownToLine size={17}/></span><span><b>Need a copy?</b> Export your records to Excel</span><ArrowUpRight size={15}/></button></section>
    </div>
    <div className="dashboard-footnote"><span><ShieldCheck size={15}/> Made for simpler, more reliable record-keeping.</span><span>BUILT FOR YOUR PEACE OF MIND <span>✳</span></span></div>
  </>;
}
