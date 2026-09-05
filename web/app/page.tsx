"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AllocationPie, PnlBars } from "@/components/charts";
import { ChatView, HoldingsTable, LabView, PlanView, ProjectionView, AuthModal, ExtractPreview, type PreviewData } from "@/components/views";
import { BookmarkIcon, LogoutIcon, UserIcon, PlusIcon, FlaskIcon, WalletIcon, TargetIcon, ChatIcon, DatabaseIcon, TrendUpIcon, UploadIcon, DownloadIcon, LogoMark, RefreshIcon, ArrowRightIcon, TrashIcon } from "@/components/icons";
import {
  Badge, Card, HealthBar, LiveBadge, Skeleton, Stat, ThemeToggle, Timeline, Toast, ToastStack,
  btnGhost, btnPrimary, inputCls, money, signed, type Stage,
} from "@/components/ui";
import { buildMarkdown, download, recordsToCSV } from "@/lib/report";
import { mergeRows } from "@/lib/extract";
import { orchestrate } from "@/lib/agents";
import {
  firebaseAuth, onAuthStateChanged, signOut as fbSignOut,
} from "@/lib/firebase";
import {
  deleteReport, listReports, saveReport, type SavedReport,
  deletePortfolio, listPortfolios, savePortfolio, type SavedPortfolio,
} from "@/lib/library";
import {
  analystBundle, compareBundles, parseCSV,
  type Findings, type Risks,
} from "@/lib/portfolio";

const DATASETS = [
  "sample_portfolio.csv",
  "large_portfolio_200.csv",
  "portfolio_50_42.csv",
  "portfolio_100_diversified_123.csv",
  "portfolio_200_diversified_42.csv",
  "portfolio_500_diversified_42.csv",
];

const TABS = [
  { id: "Overview", icon: TrendUpIcon },
  { id: "Holdings", icon: WalletIcon },
  { id: "Plan", icon: TargetIcon },
  { id: "Lab", icon: FlaskIcon },
  { id: "Ask", icon: ChatIcon },
  { id: "My Data", icon: DatabaseIcon },
] as const;
type Tab = (typeof TABS)[number]["id"];
interface ChatMsg { role: "user" | "assistant"; content: string }
type Rec = Record<string, string>;

let toastId = 0;

export default function Home() {
  const [fileName, setFileName] = useState("sample_portfolio.csv");
  const [baseRecords, setBaseRecords] = useState<Rec[] | null>(null);
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [bundle, setBundle] = useState<{ findings: Findings; risks: Risks } | null>(null);
  const [timeline, setTimeline] = useState<Stage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [advice, setAdvice] = useState("");
  const [adviceMeta, setAdviceMeta] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [live, setLive] = useState<{ updated: number; at: string } | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cmpA, setCmpA] = useState("sample_portfolio.csv");
  const [cmpB, setCmpB] = useState("portfolio_500_diversified_42.csv");
  const [cmpResult, setCmpResult] = useState<ReturnType<typeof compareBundles> | null>(null);
  const [fbUser, setFbUser] = useState<{ email: string; uid: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [library, setLibrary] = useState<SavedReport[]>([]);
  const [myPortfolios, setMyPortfolios] = useState<SavedPortfolio[]>([]);
  const [newMenu, setNewMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string, tone: Toast["tone"] = "cyan") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const runAdvisor = useCallback(async (b: { findings: Findings; risks: Risks }, csv: string) => {
    const t0 = performance.now();
    setAdvice(""); setAdviceLoading(true);
    try {
      const r = await fetch("/api/advice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings: b.findings, risks: b.risks, csv }),
      });
      const data = await r.json();
      setAdvice(data.advice ?? "Advice unavailable.");
      setAdviceMeta(`${data.cached ? "cached ⚡" : "fresh"} · ${data.model ?? ""}`);
      return {
        agent: "Advisor", task: "Wrote the summary",
        ms: Math.max(1, Math.round(performance.now() - t0)),
        detail: `${data.cached ? "instant from cache" : "fresh from model"} · ${data.model ?? ""}`,
      } as Stage;
    } catch (e) {
      setAdvice(`Advice failed: ${String((e as Error).message ?? e)}`);
      return { agent: "Advisor", task: "Wrote the summary", ms: 0, detail: "failed" } as Stage;
    } finally {
      setAdviceLoading(false);
    }
  }, []);

  /** Full orchestra: 4 instant agents, then the Advisor. Timeline shown on dashboard. */
  const applyDataset = useCallback(async (
    name: string, recs: Rec[], csv: string,
    keepLive: { updated: number; at: string } | null,
    baseOverride?: Rec[] | null,
  ) => {
    try {
      const o = orchestrate(recs);
      setBaseRecords(baseOverride ?? (keepLive ? baseRecordsRef.current : recs));
      setRecords(recs); setBundle({ findings: o.findings, risks: o.risks });
      setTimeline(o.timeline); setFileName(name);
      setLoadError(null); setChat([]); setLive(keepLive);
      const advisorStage = await runAdvisor({ findings: o.findings, risks: o.risks }, csv);
      setTimeline([...o.timeline, advisorStage]);
    } catch (e) {
      setLoadError(String((e as Error).message ?? e));
    }
  }, [runAdvisor]);

  const baseRecordsRef = useRef<Rec[] | null>(null);
  // keep ref in sync for applyDataset's keepLive branch
  useEffect(() => { baseRecordsRef.current = baseRecords; }, [baseRecords]);

  const loadDataset = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/datasets/${name}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await applyDataset(name, parseCSV(text), text, null);
    } catch (e) {
      setLoadError(String((e as Error).message ?? e));
    }
  }, [applyDataset]);

  useEffect(() => { loadDataset("sample_portfolio.csv"); }, [loadDataset]);

  const refreshLibrary = useCallback((uid: string) => {
    setLibrary(listReports(uid));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth(), (u) => {
      if (u?.uid) {
        setFbUser({ email: u.email ?? "Account", uid: u.uid });
        setLibrary(listReports(u.uid));
        setMyPortfolios(listPortfolios(u.uid));
      } else {
        setFbUser(null);
        setLibrary([]);
        setMyPortfolios([]);
      }
    });
    return unsub;
  }, []);

  const signOut = async () => {
    try { await fbSignOut(firebaseAuth()); } catch { /* already out */ }
    setFbUser(null); setLibrary([]);
    toast("Signed out. Your saved reports wait for you.", "cyan");
  };

  const saveCurrent = async () => {
    if (!bundle || !records) return;
    if (!fbUser) { setShowAuth(true); return; }
    saveReport(fbUser.uid, fileName, bundle.findings, bundle.risks, advice, records);
    toast("Saved to your library.", "green");
    refreshLibrary(fbUser.uid);
  };

  const loadSaved = async (id: string) => {
    if (!fbUser) return;
    const item = listReports(fbUser.uid).find((x) => x.id === id);
    if (!item) { toast("Could not open that report.", "red"); return; }
    const recs: Rec[] = item.records ?? item.findings.returns.holdings.map((h) => ({
      ticker: h.ticker, company_name: h.company_name, sector: h.sector,
      quantity: String(h.quantity), buy_price: String(h.buy_price), current_price: String(h.current_price),
    }));
    const o = orchestrate(recs);
    setBaseRecords(recs); setRecords(recs);
    setBundle({ findings: item.findings, risks: item.risks });
    setTimeline(o.timeline);
    setAdvice(item.advice); setAdviceMeta("from your library");
    setFileName(item.name); setChat([]); setLive(null);
    setTab("Overview");
    toast(`Opened “${item.name}” — no AI call needed.`, "green");
  };

  const deleteSaved = async (id: string) => {
    if (!fbUser) return;
    if (deleteReport(fbUser.uid, id)) { toast("Deleted.", "cyan"); refreshLibrary(fbUser.uid); }
    else toast("Delete failed.", "red");
  };

  const goLive = async () => {
    if (!baseRecords && !records) return;
    const src = baseRecords ?? records!;
    const tickers = [...new Set(src.map((r) => r.ticker))];
    setLiveLoading(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      const data = await res.json();
      const prices: Record<string, { price: number }> = data.prices ?? {};
      const n = Object.keys(prices).length;
      if (!n) {
        toast("Live feed unreachable — staying on CSV prices.", "red");
        return;
      }
      const merged = src.map((r) => (prices[r.ticker]
        ? { ...r, current_price: String(prices[r.ticker].price) } : r));
      const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await applyDataset(fileName, merged, recordsToCSV(merged), { updated: n, at });
      toast(`Live prices on — ${n}/${tickers.length} tickers updated at ${at}.`, "green");
    } catch (e) {
      toast(`Live feed failed: ${String((e as Error).message ?? e)}`, "red");
    } finally {
      setLiveLoading(false);
    }
  };

  const revertLive = async () => {
    if (!baseRecords) return;
    await applyDataset(fileName, baseRecords, recordsToCSV(baseRecords), null);
    toast("Back to CSV prices.", "cyan");
  };

  const ask = async (q: string) => {
    if (!bundle || thinking) return;
    setThinking(true);
    setChat((c) => [...c, { role: "user", content: q }]);
    try {
      const r = await fetch("/api/qa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings: bundle.findings, risks: bundle.risks, question: q,
          history: chat.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await r.json();
      setChat((c) => [...c, { role: "assistant", content: data.answer ?? "No answer." }]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: `Sorry, that failed: ${String(e)}` }]);
    }
    setThinking(false);
  };

  const onUpload = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      await applyDataset(f.name, parseCSV(text), text, null);
      toast(`Loaded ${f.name}.`, "green");
    } catch (e) {
      setLoadError(String((e as Error).message ?? e));
    }
  };

  const addHolding = async (h: Rec) => {
    if (!records) return;
    if (records.some((r) => r.ticker === h.ticker)) {
      toast(`${h.ticker} is already here — remove it first to re-add.`, "red");
      return;
    }
    const newRecs = [...records, h];
    await applyDataset(fileName, newRecs, recordsToCSV(newRecs), live, newRecs);
    toast(`Added ${h.ticker} — all five agents re-ran.`, "green");
  };

  const deleteHolding = async (ticker: string) => {
    if (!records) return;
    const newRecs = records.filter((r) => r.ticker !== ticker);
    if (!newRecs.length) {
      toast("A portfolio needs at least one holding.", "red");
      return;
    }
    await applyDataset(fileName, newRecs, recordsToCSV(newRecs), live, newRecs);
    toast(`Removed ${ticker} — analysis refreshed.`, "green");
  };

  const editHolding = async (origTicker: string, h: Rec) => {
    if (!records) return;
    if (h.ticker !== origTicker && records.some((r) => r.ticker === h.ticker)) {
      toast(`${h.ticker} is already here — pick another ticker.`, "red");
      return;
    }
    const newRecs = records.map((r) => (r.ticker === origTicker ? h : r));
    await applyDataset(fileName, newRecs, recordsToCSV(newRecs), live, newRecs);
    toast(`Updated ${h.ticker} — analysis refreshed.`, "green");
  };

  const startBlank = async () => {
    const recs: Rec[] = [{
      ticker: "EXAMPLE", company_name: "Example Corp", sector: "Technology",
      quantity: "10", buy_price: "100", current_price: "110",
    }];
    await applyDataset("my-portfolio.csv", recs, recordsToCSV(recs), null);
    if (fbUser) {
      savePortfolio(fbUser.uid, "my-portfolio.csv", recs);
      setMyPortfolios(listPortfolios(fbUser.uid));
    }
    setTab("Holdings");
    toast("Blank portfolio started — edit the example, add your holdings.", "green");
  };

  const persistCurrent = () => {
    if (!fbUser || !records) return;
    savePortfolio(fbUser.uid, fileName, records);
    setMyPortfolios(listPortfolios(fbUser.uid));
    toast(`Saved “${fileName}” to My Data.`, "green");
  };

  const openPortfolio = async (id: string) => {
    if (!fbUser) return;
    const item = listPortfolios(fbUser.uid).find((x) => x.id === id);
    if (!item) { toast("Could not open that portfolio.", "red"); return; }
    await applyDataset(item.name, item.records, recordsToCSV(item.records), null);
    setTab("Overview");
  };

  const removePortfolio = (id: string) => {
    if (!fbUser) return;
    if (deletePortfolio(fbUser.uid, id)) {
      setMyPortfolios(listPortfolios(fbUser.uid));
      toast("Portfolio deleted.", "cyan");
    }
  };

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const stmtRef = useRef<HTMLInputElement>(null);

  const uploadStatement = async (f: File | undefined) => {
    if (!f) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Extraction failed.", "red"); return; }
      setPreview({ filename: data.filename, format: data.format, rows: data.rows, warnings: data.warnings ?? [] });
    } catch {
      toast("Upload failed — is the server running?", "red");
    } finally {
      setExtracting(false);
    }
  };

  const applyExtracted = async (mode: "merge" | "new") => {
    if (!preview) return;
    const incoming = preview.rows.map((r) => ({ ...r }));
    if (mode === "new" || !records) {
      const name = preview.filename.replace(/\.[^.]+$/, "") + ".csv";
      await applyDataset(name, incoming, recordsToCSV(incoming), null);
      if (fbUser) {
        savePortfolio(fbUser.uid, name, incoming);
        setMyPortfolios(listPortfolios(fbUser.uid));
      }
      toast(`Started “${name}” with ${incoming.length} holdings.`, "green");
    } else {
      const { merged, added, skipped } = mergeRows(records, incoming);
      await applyDataset(fileName, merged, recordsToCSV(merged), live, merged);
      toast(`Added ${added} holding${added === 1 ? "" : "s"}` +
        (skipped.length ? ` (${skipped.length} dupes skipped: ${skipped.slice(0, 3).join(", ")})` : "") + ".", added ? "green" : "cyan");
    }
    setPreview(null);
    setTab("Holdings");
  };

  const downloadCSV = () => {
    if (!records) return;
    download(fileName.replace(/\.csv$/i, "") + "-edited.csv", recordsToCSV(records), "text/csv");
    toast("Downloaded your edited CSV — drop it in sample_data/ to keep it.", "green");
  };

  const runCompare = async () => {
    try {
      const [ta, tb] = await Promise.all([
        fetch(`/datasets/${cmpA}`).then((r) => r.text()),
        fetch(`/datasets/${cmpB}`).then((r) => r.text()),
      ]);
      const ba = analystBundle(parseCSV(ta)), bb = analystBundle(parseCSV(tb));
      setCmpResult(compareBundles({ name: cmpA, ...ba }, { name: cmpB, ...bb }));
    } catch (e) { setCmpResult(null); setLoadError(String((e as Error).message ?? e)); }
  };

  const exportAll = (kind: "md" | "json") => {
    if (!bundle) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "md") {
      download(`report-${stamp}.md`, buildMarkdown(fileName, bundle.findings, bundle.risks, advice), "text/markdown");
    } else {
      download(`report-${stamp}.json`, JSON.stringify({
        generated_at: new Date().toISOString(), portfolio: fileName,
        analysis: bundle.findings.analysis, returns: bundle.findings.returns,
        allocation: bundle.findings.allocation, risks: bundle.risks, advice,
        disclaimer: "Not financial advice. Educational demo on static sample data.",
      }, null, 2), "application/json");
    }
    toast(`Downloaded report.${kind}.`, "green");
  };

  const t = bundle?.findings.returns.totals;
  const h = bundle?.risks.health;
  const r = bundle?.risks.risk;

  return (
    <div className="app-texture flex min-h-screen flex-col bg-ink text-paper">
      <ToastStack toasts={toasts} />
      {preview && (
        <ExtractPreview data={preview}
          onMerge={() => applyExtracted("merge")}
          onNew={() => applyExtracted("new")}
          onClose={() => setPreview(null)} />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <header className="sticky top-0 z-10 border-b border-edge bg-ink-soft backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="mr-1 flex items-center gap-2 text-base font-extrabold tracking-tight" title="Seven-agent orchestra · free-tier AI">
            <LogoMark /> <span className="hidden sm:inline">Portfolio Health Advisor</span>
          </div>
          <div className="relative">
            <button className={btnPrimary} onClick={() => { setNewMenu((v) => !v); setExportMenu(false); }}>
              <span className="inline-flex items-center gap-1.5"><PlusIcon />New</span>
            </button>
            {newMenu && (
              <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-xl border border-edge bg-panel p-1.5 shadow-card">
                <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-well"
                  onClick={() => { setNewMenu(false); stmtRef.current?.click(); }}>
                  <span className="inline-flex items-center gap-2"><UploadIcon />Upload statement (PDF/Excel/CSV)</span>
                </button>
                <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-well"
                  onClick={() => { setNewMenu(false); fileRef.current?.click(); }}>
                  <span className="inline-flex items-center gap-2"><UploadIcon />Import plain CSV</span>
                </button>
                <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-well"
                  onClick={() => { setNewMenu(false); startBlank(); }}>
                  <span className="inline-flex items-center gap-2"><PlusIcon />Blank portfolio</span>
                </button>
                <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-well"
                  onClick={() => { setNewMenu(false); setTab("Holdings"); }}>
                  <span className="inline-flex items-center gap-2"><WalletIcon />Add a holding</span>
                </button>
              </div>
            )}
          </div>
          <input ref={stmtRef} type="file" accept=".csv,.xlsx,.xls,.pdf,.txt,.md" className="hidden"
            onChange={(e) => { uploadStatement(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
          {live
            ? <button className={btnGhost} onClick={revertLive}>Back to CSV</button>
            : <button className={btnGhost} disabled={liveLoading} onClick={goLive} title="Refresh real-ticker prices">
                <span className="inline-flex items-center gap-1.5">
                  <RefreshIcon />{liveLoading ? "Fetching…" : "Go live"}
                </span>
              </button>}
          <LiveBadge live={live} />
          <div className="ml-auto flex items-center gap-2">
            {fbUser ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-edge bg-well px-2.5 py-1 text-xs font-semibold text-paper md:inline-flex" title={fbUser.email}>
                <UserIcon />{fbUser.email.length > 16 ? fbUser.email.slice(0, 16) + "…" : fbUser.email}
              </span>
            ) : null}
            {fbUser ? (
              <button className={btnGhost} onClick={signOut} title="Sign out">
                <span className="inline-flex items-center gap-1.5"><LogoutIcon />Out</span>
              </button>
            ) : (
              <button className={btnGhost} onClick={() => setShowAuth(true)}>
                <span className="inline-flex items-center gap-1.5"><UserIcon />Sign in</span>
              </button>
            )}
            <div className="relative">
              <button className={btnGhost} onClick={() => { setExportMenu((v) => !v); setNewMenu(false); }}>
                <span className="inline-flex items-center gap-1.5"><DownloadIcon />Export</span>
              </button>
              {exportMenu && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-edge bg-panel p-1.5 shadow-card">
                  {[["md", "Report (.md)"], ["json", "Data (.json)"], ["csv", "Holdings (.csv)"]].map(([kind, label]) => (
                    <button key={kind} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-well"
                      onClick={() => {
                        setExportMenu(false);
                        if (kind === "csv") downloadCSV();
                        else exportAll(kind as "md" | "json");
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Views">
          {TABS.map(({ id, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setNewMenu(false); setExportMenu(false); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === id ? "bg-signal text-ink" : "text-fog hover:bg-well"}`}>
              <Icon />{id}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-5" key={tab}>
        {loadError && (
          <div className="rounded-xl border border-down bg-down-soft p-4 text-sm text-down">
            {loadError}
          </div>
        )}
        {!bundle && !loadError && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Loading portfolio"><Skeleton lines={4} /></Card>
            <Card title="Waking the agents"><Skeleton lines={4} /></Card>
          </div>
        )}

        {bundle && t && h && r && tab === "Overview" && (
          <div className="anim-rise">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Total value" value={money(t.total_value)} sub={`cost ${money(t.total_cost)}`} />
              <Stat label="Profit" value={signed(t.total_pnl)} sub={`${signed(t.return_pct, "%")} overall`}
                tone={t.total_pnl >= 0 ? "green" : "red"} />
              <Stat label="Health" value={`${h.score.toFixed(1)}/100 · ${h.grade}`}
                sub={`${t.num_winners} winners / ${t.num_losers} losers`}
                tone={h.score >= 65 ? "green" : h.score >= 50 ? "yellow" : "red"} />
              <Stat label="Risk" value={r.risk_level} sub={`score ${r.risk_score}/100 · vol ${bundle.risks.metrics.volatility_pct}%`}
                tone={r.risk_level === "LOW" ? "green" : r.risk_level === "MEDIUM" ? "yellow" : "red"} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card title="Health breakdown" accent="#10b981">
                <HealthBar score={h.score} grade={h.grade} />
                <ul className="mt-3 space-y-1 text-sm text-fog">
                  {h.breakdown.map((b, i) => <li key={i}>• {b}</li>)}
                </ul>
              </Card>
              <Card title="Advisor recommendation" accent="#3b82f6">
                {adviceLoading || !advice
                  ? <Skeleton lines={5} />
                  : <>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-paper">{advice}</p>
                      {adviceMeta && <p className="mt-2 text-xs text-mist">via {adviceMeta}</p>}
                    </>}
              </Card>
              <Card title="Agent orchestra — latest run" accent="#8b5cf6">
                <Timeline stages={timeline} />
              </Card>
              <Card title="Today's brief — Scout" accent="#10b981">
                <ul className="space-y-2.5">
                  {bundle.risks.insights.map((ins, i) => (
                    <li key={i}>
                      <Badge tone={ins.tone === "bad" ? "red" : ins.tone === "warn" ? "yellow" : "green"}>
                        {ins.tone.toUpperCase()}
                      </Badge>
                      <div className="mt-1 text-sm font-semibold text-paper">{ins.title}</div>
                      <div className="text-sm text-fog">{ins.body}</div>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Sector allocation" accent="#8b5cf6">
                <AllocationPie allocation={bundle.findings.allocation} />
              </Card>
              <Card title="Top winners & losers" accent="#ec4899">
                <PnlBars returns={bundle.findings.returns} />
              </Card>
              <Card title={`Alerts (${bundle.risks.alerts.length})`} accent="#f59e0b">
                <div className="grid gap-2">
                  {bundle.risks.alerts.slice(0, 4).map((a, i) => (
                    <div key={i} className="rounded-lg bg-well p-3 text-sm">
                      <Badge tone={a.severity === "critical" ? "red" : a.severity === "warn" ? "yellow" : "green"}>
                        {a.severity.toUpperCase()}
                      </Badge>{" "}{a.text}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <p className="mt-4 text-xs text-mist">
              {bundle.findings.analysis} Not financial advice. Educational demo on
              {live ? " live market prices" : " static sample data"}.
            </p>
          </div>
        )}

        {bundle && tab === "Holdings" && (
          <div className="anim-rise grid gap-4">
            <HoldingsTable findings={bundle.findings}
              sectors={Object.keys(bundle.findings.allocation.by_sector).sort()}
              onAdd={addHolding} onEdit={editHolding} onDelete={deleteHolding} onDownload={downloadCSV} />
          </div>
        )}

        {bundle && records && tab === "Plan" && (
          <div className="anim-rise space-y-4">
            <PlanView records={records} harvest={bundle.risks.harvest} />
            <ProjectionView projection={bundle.risks.projection} goal={bundle.risks.goal} />
          </div>
        )}

        {bundle && records && tab === "Lab" && (
          <div className="anim-rise space-y-4">
            <LabView records={records}
              tickers={bundle.findings.returns.holdings.map((x) => x.ticker)}
              sectors={Object.keys(bundle.findings.allocation.by_sector).sort()} />
            <Card title="Compare two portfolios" accent="#f59e0b">
              <div className="grid grid-cols-2 gap-3">
                <select className={inputCls} value={cmpA} onChange={(e) => setCmpA(e.target.value)} aria-label="Compare A">
                  {DATASETS.map((d) => <option key={d}>{d}</option>)}
                </select>
                <select className={inputCls} value={cmpB} onChange={(e) => setCmpB(e.target.value)} aria-label="Compare B">
                  {DATASETS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <button className={`${btnPrimary} mt-3`} onClick={runCompare}>Compare A vs B</button>
              {cmpResult && (
                <div className="mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-edge text-xs uppercase text-mist">
                        <th className="py-1 text-left">Metric</th>
                        <th className="py-1 text-right">{cmpResult.a.file.slice(0, 18)}</th>
                        <th className="py-1 text-right">{cmpResult.b.file.slice(0, 18)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["n", "value", "return_pct", "health", "risk", "top_sector_pct", "winners", "losers"] as const).map((k) => (
                        <tr key={k} className="border-b border-edge">
                          <td className="py-1.5 text-fog">{k}</td>
                          <td className="py-1.5 text-right tabular-nums">{cmpResult.a[k]}</td>
                          <td className="py-1.5 text-right tabular-nums">{cmpResult.b[k]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="mt-2 space-y-1 text-sm text-signal">
                    {cmpResult.verdicts.map((v, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 text-signal"><ArrowRightIcon /></span>{v}
                      </li>))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        )}

        {bundle && tab === "Ask" && (
          <div className="anim-rise space-y-4">
            <ChatView onAsk={ask} thinking={thinking} />
            <div className="space-y-3">
              {chat.map((m, i) => (
                <div key={i} className={`rounded-xl p-4 text-sm leading-relaxed ${
                  m.role === "user" ? "ml-8 bg-well" : "mr-8 border border-signal/20 bg-panel"}`}>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-mist">
                    {m.role === "user" ? "You" : "Advisor"}
                  </div>
                  <div className="whitespace-pre-line text-paper">{m.content}</div>
                </div>
              ))}
              {thinking && (
                <div className="mr-8 rounded-xl border border-signal/20 bg-panel p-4 text-sm text-fog">
                  Advisor is thinking<span className="live-dot">…</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "My Data" && (
          <div className="anim-rise grid gap-4 md:grid-cols-2">
            <Card title={fbUser ? "Your portfolios — saved to your account" : "Your portfolios"} accent="#3b82f6">
              {!fbUser ? (
                <div>
                  <p className="text-sm text-fog">
                    Sign in to keep your own portfolios here — uploads, blanks, and edits persist across visits.
                  </p>
                  <button className={`${btnPrimary} mt-3`} onClick={() => setShowAuth(true)}>
                    <span className="inline-flex items-center gap-1.5"><UserIcon />Sign in / Sign up</span>
                  </button>
                </div>
              ) : (
                <div>
                  <button className={`${btnGhost} mb-3`} onClick={persistCurrent} disabled={!bundle}>
                    <span className="inline-flex items-center gap-1.5"><BookmarkIcon />Save current as “{fileName}”</span>
                  </button>
                  {myPortfolios.length === 0 && (
                    <p className="text-sm text-fog">
                      Nothing of yours yet. Hit <b>＋ New</b> up top — upload a statement, start blank, or import a CSV — and it lands here automatically.
                    </p>
                  )}
                  <div className="space-y-2">
                    {myPortfolios.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-well px-3 py-2">
                        <button className="min-w-0 flex-1 truncate text-left text-sm font-medium text-paper hover:text-signal"
                          onClick={() => openPortfolio(p.id)} title={`Open ${p.name}`}>
                          {p.name} <span className="text-xs text-mist">· {p.holdings} holdings</span>
                        </button>
                        <button onClick={() => removePortfolio(p.id)} title={`Delete ${p.name}`} aria-label={`Delete ${p.name}`}
                          className="rounded-md p-1.5 text-mist hover:bg-down-soft hover:text-down">
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            <Card title="Samples & uploads" accent="#3b82f6">
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button className={btnPrimary} disabled={extracting} onClick={() => stmtRef.current?.click()}>
                  <span className="inline-flex items-center gap-1.5"><UploadIcon />
                    {extracting ? "Reading file…" : "Upload statement"}</span>
                </button>
                <button className={btnGhost} onClick={startBlank}>
                  <span className="inline-flex items-center gap-1.5"><PlusIcon />Blank portfolio</span>
                </button>
              </div>
              <input ref={stmtRef} type="file" accept=".csv,.xlsx,.xls,.pdf,.txt,.md" className="hidden"
                onChange={(e) => { uploadStatement(e.target.files?.[0]); e.target.value = ""; }} />
              <p className="mb-2 text-xs text-mist">Broker PDF, Excel, CSV or text — the Extractor Agent pulls out holdings for your review.</p>
              <div className="space-y-2">
                {DATASETS.map((d) => (
                  <button key={d} onClick={() => loadDataset(d)}
                    className={`block w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                      d === fileName && !live ? "border-signal bg-signal/10 text-signal"
                        : "border-edge bg-well text-paper hover:bg-well"}`}>
                    {d === fileName ? <span className="mr-1 inline-flex align-[-2px] text-signal"><ArrowRightIcon /></span> : ""}{d}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-mist">Samples are read-only starters — your uploads and blanks live in “Your portfolios” once signed in.</p>
            </Card>
            <Card title={`Saved reports — ${library.length}`} accent="#3b82f6" wide>
              {!fbUser ? (
                <div>
                  <p className="text-sm text-fog">
                    Sign in to save any analysis and reopen it later — no AI calls, no waiting.
                  </p>
                  <button className={`${btnPrimary} mt-3`} onClick={() => setShowAuth(true)}>
                    <span className="inline-flex items-center gap-1.5"><UserIcon />Sign in / Sign up</span>
                  </button>
                </div>
              ) : (
                <div>
                  <button className={`${btnGhost} mb-3`} onClick={saveCurrent}>
                    <span className="inline-flex items-center gap-1.5"><BookmarkIcon />Save current analysis</span>
                  </button>
                  {library.length === 0 && (
                    <p className="text-sm text-fog">Nothing saved yet. Analyze anything, then hit Save.</p>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {library.map((item) => (
                      <div key={item.id} className="rounded-xl border border-edge bg-well p-4">
                        <div className="font-semibold text-paper">{item.name}</div>
                        <div className="mt-1 text-xs text-fog">
                          {item.holdings} holdings · {money(item.value)} ·
                          health {item.health?.score ?? "?"}/100({item.health?.grade ?? "?"}) ·
                          saved {new Date(item.savedAt).toLocaleString()}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className={btnPrimary} onClick={() => loadSaved(item.id)}>Open</button>
                          <button className={btnGhost} onClick={() => deleteSaved(item.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      <footer className="border-t border-[#262626] bg-[#101010] py-8 text-center text-xs leading-relaxed text-[#a1a1aa]">
        Portfolio Health Advisor · read closely, rebalance calmly<br />
        ACM Student Chapter Hackathon · Not financial advice ·
        {live ? " Live prices via Yahoo Finance" : " Static sample data"}
      </footer>
    </div>
  );
}
