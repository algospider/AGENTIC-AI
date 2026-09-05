"use client";
import { useState } from "react";
import {
  rebalancePlan, simulateRebalance, sipForGoal, stressTest,
  type Findings, type Plan, type Projection, type Risks,
} from "@/lib/portfolio";
import { Badge, Card, Field, btnGhost, btnPrimary, inputCls, money, signed } from "./ui";
import { DownloadIcon, InfoIcon, PlusIcon, TrashIcon, XIcon } from "./icons";

type Rec = Record<string, string>;

export function HoldingsTable({ findings, sectors, onAdd, onDelete, onDownload }: {
  findings: Findings; sectors: string[];
  onAdd: (h: Rec) => void; onDelete: (ticker: string) => void; onDownload: () => void;
}) {
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const rows = findings.returns.holdings.filter((h) =>
    !q || `${h.ticker} ${h.company_name} ${h.sector}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title={`Holdings — ${rows.length} shown`} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Filter ticker / company / sector…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ml-auto flex gap-2">
          <button className={btnGhost} onClick={onDownload} title="Download current table as CSV">
            <span className="inline-flex items-center gap-1.5"><DownloadIcon />CSV</span>
          </button>
          <button className={btnPrimary} onClick={() => setShowAdd(true)}>
            <span className="inline-flex items-center gap-1.5"><PlusIcon />Add holding</span>
          </button>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs uppercase text-mist">
              {["Ticker", "Company", "Sector", "Qty", "Buy", "Now", "Value", "P&L", "P&L%", ""].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.ticker} className="border-b border-edge/60 hover:bg-well">
                <td className="px-2 py-1.5 font-mono font-bold text-signal">{h.ticker}</td>
                <td className="px-2 py-1.5 text-paper">{h.company_name}</td>
                <td className="px-2 py-1.5 text-fog">{h.sector}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{h.quantity}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{h.buy_price.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{h.current_price.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{money(h.current_value)}</td>
                <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${h.pnl >= 0 ? "text-up" : "text-down"}`}>
                  {signed(h.pnl)}
                </td>
                <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${h.pnl >= 0 ? "text-up" : "text-down"}`}>
                  {signed(h.pnl_pct, "%")}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button onClick={() => onDelete(h.ticker)} title={`Remove ${h.ticker}`}
                    aria-label={`Remove ${h.ticker}`}
                    className="rounded-md p-1.5 text-mist hover:bg-down-soft hover:text-down">
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <HoldingModal sectors={sectors} onClose={() => setShowAdd(false)}
          onSave={(h) => { setShowAdd(false); onAdd(h); }} />
      )}
    </Card>
  );
}

export function HoldingModal({ sectors, onClose, onSave }: {
  sectors: string[]; onClose: () => void; onSave: (h: Rec) => void;
}) {
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState(sectors[0] ?? "");
  const [customSector, setCustomSector] = useState("");
  const [qty, setQty] = useState("");
  const [buy, setBuy] = useState("");
  const [now, setNow] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return setError("Ticker is required (e.g. TCHX).");
    if (!company.trim()) return setError("Company name is required.");
    const q = Number(qty), b = Number(buy), c = Number(now);
    if (!Number.isFinite(q) || q <= 0) return setError("Quantity must be a positive number.");
    if (!Number.isFinite(b) || b <= 0) return setError("Buy price must be a positive number.");
    if (!Number.isFinite(c) || c <= 0) return setError("Current price must be a positive number.");
    const s = sector === "__custom__" ? customSector.trim() : sector;
    if (!s) return setError("Pick a sector or type a new one.");
    onSave({ ticker: t, company_name: company.trim(), sector: s,
             quantity: String(q), buy_price: String(b), current_price: String(c) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Add holding">
      <div className="w-full max-w-md rounded-xl border border-edge bg-panel p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-paper">Add holding</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-mist hover:bg-well">
            <XIcon />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ticker"><input className={inputCls} value={ticker}
            onChange={(e) => setTicker(e.target.value)} placeholder="TCHX" /></Field>
          <Field label="Quantity"><input className={inputCls} value={qty}
            onChange={(e) => setQty(e.target.value)} placeholder="25" inputMode="decimal" /></Field>
          <div className="col-span-2"><Field label="Company">
            <input className={inputCls} value={company}
              onChange={(e) => setCompany(e.target.value)} placeholder="TechCorp Innovations" />
          </Field></div>
          <Field label="Sector">
            <select className={inputCls} value={sector} onChange={(e) => setSector(e.target.value)}>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__custom__">New sector…</option>
            </select>
          </Field>
          {sector === "__custom__" && (
            <Field label="New sector"><input className={inputCls} value={customSector}
              onChange={(e) => setCustomSector(e.target.value)} placeholder="e.g. Crypto" /></Field>
          )}
          <Field label="Buy price"><input className={inputCls} value={buy}
            onChange={(e) => setBuy(e.target.value)} placeholder="142.50" inputMode="decimal" /></Field>
          <Field label="Current price"><input className={inputCls} value={now}
            onChange={(e) => setNow(e.target.value)} placeholder="198.30" inputMode="decimal" /></Field>
        </div>
        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-down bg-down-soft p-3 text-sm text-down">
            <span className="mt-0.5 shrink-0"><InfoIcon /></span>{error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save}>
            <span className="inline-flex items-center gap-1.5"><PlusIcon />Add to portfolio</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanTable({ plan }: { plan: Plan }) {
  if (!plan.sells.length)
    return <p className="text-sm text-fog">{plan.note}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-edge text-left text-xs uppercase text-mist">
            <th className="px-2 py-2">Action</th><th className="px-2 py-2">Target</th>
            <th className="px-2 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {plan.sells.map((s) => (
            <tr key={s.ticker} className="border-b border-edge">
              <td className="px-2 py-1.5 font-bold text-down">SELL</td>
              <td className="px-2 py-1.5">{s.ticker} <span className="text-mist">(~{s.sell_qty} shares)</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{money(s.sell_value)}</td>
            </tr>
          ))}
          {plan.buys.map((b) => (
            <tr key={b.sector} className="border-b border-edge">
              <td className="px-2 py-1.5 font-bold text-up">BUY</td>
              <td className="px-2 py-1.5">{b.sector} <span className="text-mist">(→ {b.new_pct}%)</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{money(b.buy_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-mist">{plan.note}</p>
    </div>
  );
}

export function PlanView({ records, harvest }: {
  records: Rec[]; harvest: Risks["harvest"];
}) {
  const [cap, setCap] = useState(35);
  const live = rebalancePlan(records, cap);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={`Rebalance plan — frees ~${money(live.freed_total)}`} accent="#22d3ee" wide>
        <div className="mb-3 flex max-w-xs items-center gap-3">
          <Field label={`Sector cap: ${cap}%`}>
            <input type="range" min={20} max={50} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="w-full accent-signal" />
          </Field>
        </div>
        <PlanTable plan={live} />
      </Card>
      <Card title={`Tax-loss harvest — save ~${money(harvest.total_tax_saved)}`} accent="#e879f9">
        {harvest.pairs.length === 0 && <p className="text-sm text-fog">{harvest.note}</p>}
        <ul className="space-y-2 text-sm">
          {harvest.pairs.map((p) => (
            <li key={p.sell_loser} className="rounded-lg bg-well p-3">
              Sell <b className="text-down">{p.sell_loser}</b> (book loss {money(p.book_loss)}) offsets{" "}
              {p.offset_with.map((o) => o.ticker).join(", ")} → saves <b className="text-up">~{money(p.tax_saved)}</b>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-mist">Simplified — watch wash-sale rules. Not tax advice.</p>
      </Card>
    </div>
  );
}

export function ProjectionView({ projection, goal }: {
  projection: Projection; goal: Risks["goal"];
}) {
  const [target, setTarget] = useState("100000");
  const [years, setYears] = useState("5");
  const [rate, setRate] = useState("10");
  const [sip, setSip] = useState<string | null>(null);
  const calc = () => {
    try {
      const g = sipForGoal(Number(target), Number(years), Number(rate) / 100);
      setSip(`${g.note} Total invested ~${money(g.total_invested)}.`);
    } catch (e) { setSip(String((e as Error).message ?? e)); }
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={`Growth — ${money(projection.starting_value)} over ${projection.years}y`} accent="#22d3ee">
        <ul className="space-y-2">
          {projection.scenarios.map((s) => (
            <li key={s.label} className="flex items-center justify-between rounded-lg bg-well px-4 py-3">
              <span className="font-semibold text-paper">{s.label}</span>
              <span className="text-xl font-bold tabular-nums text-paper">{money(s.value)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-mist">{projection.note}</p>
      </Card>
      <Card title="SIP goal planner" accent="#34d399">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target"><input className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" /></Field>
          <Field label="Years"><input className={inputCls} value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" /></Field>
          <Field label="Return %"><input className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" /></Field>
        </div>
        <button className={`${btnPrimary} mt-3`} onClick={calc}>Calculate SIP</button>
        {sip && <p className="mt-3 rounded-lg bg-up-soft p-3 text-sm text-up">{sip}</p>}
        <p className="mt-2 text-xs text-mist">Example: ~{money(goal.monthly_sip)}/month for {goal.years}y at {Math.round(goal.annual_rate * 100)}% reaches ~{money(goal.target_amount)}.</p>
      </Card>
    </div>
  );
}

export function LabView({ records, tickers, sectors }: {
  records: Rec[]; tickers: string[]; sectors: string[];
}) {
  const [ticker, setTicker] = useState(tickers[0] ?? "");
  const [frac, setFrac] = useState("0.5");
  const [trimOut, setTrimOut] = useState<string | null>(null);
  const [targets, setTargets] = useState("Technology=35");
  const [targetOut, setTargetOut] = useState<string | null>(null);
  const [sector, setSector] = useState("");
  const [drop, setDrop] = useState("20");
  const [stressOut, setStressOut] = useState<string | null>(null);

  const runTrim = () => {
    try {
      const r = simulateRebalance(records, { sell_ticker: ticker, sell_fraction: Number(frac) });
      setTrimOut(`Selling ${Math.round(Number(frac) * 100)}% of ${ticker} frees ~${money((r as { proceeds: number }).proceeds)}. New total ~${money((r as { new_total: number }).new_total)}.`);
    } catch (e) { setTrimOut(String((e as Error).message ?? e)); }
  };
  const runTargets = () => {
    try {
      const map: Record<string, number> = {};
      targets.split(",").forEach((p) => {
        const [k, v] = p.split("=");
        if (k && v) map[k.trim()] = Number(v);
      });
      if (!Object.keys(map).length) throw new Error("Type targets like: Technology=35, Financials=15");
      const r = simulateRebalance(records, { target_sector_weights: map }) as {
        deltas: Record<string, { current_pct: number; target_pct: number; delta_value: number }>;
      };
      setTargetOut(Object.entries(r.deltas).map(([s, d]) =>
        `${s}: ${d.current_pct}% → ${d.target_pct}% (${signed(d.delta_value)})`).join("  ·  "));
    } catch (e) { setTargetOut(String((e as Error).message ?? e)); }
  };
  const runStress = () => {
    try {
      const r = stressTest(records, sector || null, Number(drop));
      setStressOut(r.note);
    } catch (e) { setStressOut(String((e as Error).message ?? e)); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Trim a holding" accent="#22d3ee">
        <div className="space-y-3">
          <Field label="Ticker">
            <select className={inputCls} value={ticker} onChange={(e) => setTicker(e.target.value)}>
              {tickers.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label={`Fraction to sell: ${frac}`}>
            <input type="range" min={0.05} max={1} step={0.05} value={frac}
              onChange={(e) => setFrac(e.target.value)} className="w-full accent-signal" />
          </Field>
          <button className={btnPrimary} onClick={runTrim}>Simulate trim</button>
          {trimOut && <p className="rounded-lg bg-well p-3 text-sm text-paper">{trimOut}</p>}
        </div>
      </Card>
      <Card title="Target weights" accent="#a78bfa">
        <div className="space-y-3">
          <Field label="Sector=percent, comma separated">
            <input className={inputCls} value={targets} onChange={(e) => setTargets(e.target.value)} />
          </Field>
          <button className={btnPrimary} onClick={runTargets}>Simulate targets</button>
          {targetOut && <p className="rounded-lg bg-well p-3 text-sm text-paper">{targetOut}</p>}
        </div>
      </Card>
      <Card title="Stress-test a crash" accent="#fbbf24">
        <div className="space-y-3">
          <Field label="Sector (blank = biggest)">
            <select className={inputCls} value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">Biggest sector</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={`Drop: ${drop}%`}>
            <input type="range" min={5} max={80} step={5} value={drop}
              onChange={(e) => setDrop(e.target.value)} className="w-full accent-warn" />
          </Field>
          <button className={btnPrimary} onClick={runStress}>Run stress test</button>
          {stressOut && <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">{stressOut}</p>}
        </div>
      </Card>
      <p className="text-xs text-mist md:col-span-3">Nothing is actually traded — every simulation is hypothetical.</p>
    </div>
  );
}

export function AlertsList({ alerts }: { alerts: Risks["alerts"] }) {
  const style = { critical: "border-down bg-down-soft", warn: "border-warn bg-warn-soft", ok: "border-up bg-up-soft" };
  const badge = { critical: "red", warn: "yellow", ok: "green" } as const;
  return (
    <ul className="space-y-2">
      {alerts.map((a, i) => (
        <li key={i} className={`rounded-lg border p-3 text-sm ${style[a.severity]}`}>
          <Badge tone={badge[a.severity]}>{a.severity.toUpperCase()}</Badge>{" "}
          <span className="text-paper">{a.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChatView({ onAsk, thinking }: {
  onAsk: (q: string) => void; thinking: boolean;
}) {
  const [draft, setDraft] = useState("");
  const send = () => { if (draft.trim() && !thinking) { onAsk(draft.trim()); setDraft(""); } };
  const ideas = ["Why is my risk high?", "What is my health score?", "How to rebalance?",
    "Stress test?", "Harvest losses?", "SIP for 100000 in 5 years?"];
  return (
    <Card title="Ask Advisor" wide>
      <div className="mb-3 flex flex-wrap gap-2">
        {ideas.map((s) => (
          <button key={s} className={btnGhost} onClick={() => !thinking && onAsk(s)}>{s}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Type a question, Enter to send…" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button className={btnPrimary} disabled={thinking} onClick={send}>
          {thinking ? "Thinking…" : "Send"}
        </button>
      </div>
    </Card>
  );
}
