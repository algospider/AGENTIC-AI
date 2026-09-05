"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AllocationPie, PnlBars } from "@/components/charts";
import { ChatView, HoldingsTable, LabView, PlanView, ProjectionView, AuthModal } from "@/components/views";
import { BookmarkIcon, LogoutIcon, UserIcon } from "@/components/icons";
import {
  Badge, Card, HealthBar, LiveBadge, Skeleton, Stat, ThemeToggle, Timeline, Toast, ToastStack,
  btnGhost, btnPrimary, inputCls, money, signed, type Stage,
} from "@/components/ui";
import { DownloadIcon, LogoMark, RefreshIcon, ArrowRightIcon } from "@/components/icons";
import { buildMarkdown, download, recordsToCSV } from "@/lib/report";
import { orchestrate } from "@/lib/agents";
import {
  firebaseAuth, onAuthStateChanged, signOut as fbSignOut,
} from "@/lib/firebase";
import {
  deleteReport, listReports, saveReport, type SavedReport,
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

const TABS = ["Dashboard", "Holdings", "Rebalance", "Projection", "Lab", "Q&A", "Datasets", "Library"] as const;
type Tab = (typeof TABS)[number];
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
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cmpA, setCmpA] = useState("sample_portfolio.csv");
  const [cmpB, setCmpB] = useState("portfolio_500_diversified_42.csv");
  const [cmpResult, setCmpResult] = useState<ReturnType<typeof compareBundles> | null>(null);
  const [fbUser, setFbUser] = useState<{ email: string; uid: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [library, setLibrary] = useState<SavedReport[]>([]);
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
      } else {
        setFbUser(null);
        setLibrary([]);
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
    if (!bundle) return;
    if (!fbUser) { setShowAuth(true); return; }
    saveReport(fbUser.uid, fileName, bundle.findings, bundle.risks, advice);
    toast("Saved to your library.", "green");
    refreshLibrary(fbUser.uid);
  };

  const loadSaved = async (id: string) => {
    if (!fbUser) return;
    const item = listReports(fbUser.uid).find((x) => x.id === id);
    if (!item) { toast("Could not open that report.", "red"); return; }
    const holdings = item.findings.returns.holdings as {
      ticker: string; company_name: string; sector: string;
      quantity: number; buy_price: number; current_price: number }[];
    const recs: Rec[] = holdings.map((h) => ({
      ticker: h.ticker, company_name: h.company_name, sector: h.sector,
      quantity: String(h.quantity), buy_price: String(h.buy_price), current_price: String(h.current_price),
    }));
    const o = orchestrate(recs);
    setBaseRecords(recs); setRecords(recs);
    setBundle({ findings: item.findings, risks: item.risks });
    setTimeline(o.timeline);
    setAdvice(item.advice); setAdviceMeta("from your library");
    setFileName(item.name); setChat([]); setLive(null);
    setTab("Dashboard");
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
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <header className="sticky top-0 z-10 border-b border-edge bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-2">
            <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <LogoMark /> Portfolio Health Advisor
            </div>
            <div className="text-xs text-fog">Seven-agent orchestra · free-tier AI</div>
          </div>
          <select className={`${inputCls} max-w-60`} value={fileName}
            onChange={(e) => loadDataset(e.target.value)} aria-label="Dataset">
            {DATASETS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
          {live
            ? <button className={btnGhost} onClick={revertLive}>Back to CSV</button>
            :             <button className={btnPrimary} disabled={liveLoading} onClick={goLive}>
                <span className="inline-flex items-center gap-1.5">
                  <RefreshIcon />{liveLoading ? "Fetching prices…" : "Go live"}
                </span>
              </button>}
          <LiveBadge live={live} />
          {fbUser ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-well px-2.5 py-1 text-xs font-semibold text-paper" title={fbUser.email}>
              <UserIcon />{fbUser.email.length > 18 ? fbUser.email.slice(0, 18) + "…" : fbUser.email}
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
          <div className="ml-auto flex gap-2">
            <ThemeToggle />
            <button className={btnGhost} onClick={saveCurrent} title="Save this analysis to your library">
              <span className="inline-flex items-center gap-1.5"><BookmarkIcon />Save</span>
            </button>
            <button className={btnGhost} onClick={() => exportAll("md")}>
              <span className="inline-flex items-center gap-1.5"><DownloadIcon />.md</span>
            </button>
            <button className={btnGhost} onClick={() => exportAll("json")}>
              <span className="inline-flex items-center gap-1.5"><DownloadIcon />.json</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Views">
          {TABS.map((name) => (
            <button key={name} onClick={() => setTab(name)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === name ? "bg-signal text-ink" : "text-fog hover:bg-well"}`}>
              {name}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-5" key={tab}>
        {loadError && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-down">
            {loadError}
          </div>
        )}
        {!bundle && !loadError && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Loading portfolio"><Skeleton lines={4} /></Card>
            <Card title="Waking the agents"><Skeleton lines={4} /></Card>
          </div>
        )}

        {bundle && t && h && r && tab === "Dashboard" && (
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
              <Card title="Health breakdown" accent="#34d399">
                <HealthBar score={h.score} grade={h.grade} />
                <ul className="mt-3 space-y-1 text-sm text-fog">
                  {h.breakdown.map((b, i) => <li key={i}>• {b}</li>)}
                </ul>
              </Card>
              <Card title="Advisor recommendation" accent="#22d3ee">
                {adviceLoading || !advice
                  ? <Skeleton lines={5} />
                  : <>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-paper">{advice}</p>
                      {adviceMeta && <p className="mt-2 text-xs text-mist">via {adviceMeta}</p>}
                    </>}
              </Card>
              <Card title="Agent orchestra — latest run" accent="#a78bfa">
                <Timeline stages={timeline} />
              </Card>
              <Card title="Today's brief — Scout" accent="#34d399">
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
              <Card title="Sector allocation" accent="#a78bfa">
                <AllocationPie allocation={bundle.findings.allocation} />
              </Card>
              <Card title="Top winners & losers" accent="#f472b6">
                <PnlBars returns={bundle.findings.returns} />
              </Card>
              <Card title={`Alerts (${bundle.risks.alerts.length})`} accent="#fbbf24">
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
              onAdd={addHolding} onDelete={deleteHolding} onDownload={downloadCSV} />
          </div>
        )}

        {bundle && records && tab === "Rebalance" && (
          <div className="anim-rise">
            <PlanView records={records} harvest={bundle.risks.harvest} />
          </div>
        )}

        {bundle && tab === "Projection" && (
          <div className="anim-rise">
            <ProjectionView projection={bundle.risks.projection} goal={bundle.risks.goal} />
          </div>
        )}

        {bundle && records && tab === "Lab" && (
          <div className="anim-rise">
            <LabView records={records}
              tickers={bundle.findings.returns.holdings.map((x) => x.ticker)}
              sectors={Object.keys(bundle.findings.allocation.by_sector).sort()} />
          </div>
        )}

        {bundle && tab === "Q&A" && (
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

        {tab === "Datasets" && (
          <div className="anim-rise grid gap-4 md:grid-cols-2">            <Card title="Switch portfolio" accent="#22d3ee">
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
              <p className="mt-2 text-xs text-mist">Or upload any CSV with the same columns via the header button.</p>
            </Card>
            <Card title="Compare two portfolios" accent="#fbbf24">
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

        {tab === "Library" && (
          <div className="anim-rise">
            {!fbUser ? (
              <Card title="Your library lives here" accent="#22d3ee">
                <p className="text-sm text-fog">
                  Sign in to save any analysis and reopen it later — no AI calls, no waiting.
                  One account, hashed passwords, signed-cookie sessions.
                </p>
                <button className={`${btnPrimary} mt-3`} onClick={() => setShowAuth(true)}>
                  <span className="inline-flex items-center gap-1.5"><UserIcon />Sign in / Sign up</span>
                </button>
              </Card>
            ) : (
              <Card title={`Saved reports — ${library.length}`} accent="#22d3ee" wide>
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
              </Card>
            )}
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
