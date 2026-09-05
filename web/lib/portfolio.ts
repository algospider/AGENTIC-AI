// Portfolio math — TypeScript port of src/tools.py + src/agents.py (deterministic parts).
// Behavior matches Python: exact math first, 2dp rounding only on output,
// largest-remainder normalization so sectors sum to exactly 100.00.

export interface Holding {
  ticker: string; company_name: string; sector: string;
  quantity: number; buy_price: number; current_price: number;
  cost_value: number; current_value: number; pnl: number; pnl_pct: number;
}
export interface Totals {
  total_cost: number; total_value: number; total_pnl: number; return_pct: number;
  best_ticker: string | null; worst_ticker: string | null;
  num_winners: number; num_losers: number;
}
export interface Returns { holdings: Holding[]; totals: Totals }
export interface Allocation {
  by_sector: Record<string, number>; by_holding: Record<string, number>;
  top_sector: string; top_sector_pct: number; top_holding: string;
  top_holding_pct: number; hhi: number;
}
export interface Risk {
  risk_level: "LOW" | "MEDIUM" | "HIGH"; risk_score: number; flags: string[];
  top_sector: string; top_sector_pct: number; num_losers: number;
  losers: { ticker: string; pnl: number; pnl_pct: number }[];
}
export interface Alert { severity: "critical" | "warn" | "ok"; text: string }
export interface Insight { tone: "bad" | "warn" | "good"; title: string; body: string }
export interface Risks {
  risk: Risk; tax: Tax; health: Health; plan: Plan; projection: Projection;
  stress: Stress; harvest: Harvest; goal: Goal; metrics: Metrics; alerts: Alert[];
  insights: Insight[];
}
export interface Tax {
  rate: number; total_taxable_gain: number; total_est_tax: number;
  per_holding: { ticker: string; pnl: number; taxable_gain: number; est_tax: number }[];
  note: string;
}
export interface Health { score: number; grade: string; breakdown: string[] }
export interface Plan {
  cap_pct: number; freed_total: number;
  sells: { ticker: string; sector: string; sell_value: number; sell_qty: number }[];
  buys: { sector: string; buy_value: number; new_pct: number }[];
  new_by_sector: Record<string, number>; note: string;
}
export interface Projection {
  starting_value: number; years: number;
  scenarios: { label: string; rate: number; value: number }[]; note: string;
}
export interface Stress {
  sector: string; drop_pct: number; sector_loss: number;
  old_total: number; new_total: number; portfolio_fall_pct: number;
  sector_new_pct: number; note: string;
}
export interface Harvest {
  rate: number;
  pairs: { sell_loser: string; book_loss: number;
           offset_with: { ticker: string; offset: number }[]; tax_saved: number }[];
  total_tax_saved: number; note: string;
}
export interface Goal {
  target_amount: number; years: number; annual_rate: number;
  monthly_sip: number; total_invested: number; note: string;
}
export interface Metrics {
  volatility_pct: number; sharpe_proxy: number; win_rate_pct: number;
  avg_win: number; avg_loss: number;
  best_contributor: string | null; worst_contributor: string | null; note: string;
}
export interface Findings { analysis: string; returns: Returns; allocation: Allocation }

/** Python-compatible banker's rounding to 2dp. */
export function r2(x: number): number {
  const n = x * 100;
  const f = Math.floor(n);
  const d = n - f;
  const rounded = d < 0.5 ? f : d > 0.5 ? f + 1 : (f % 2 === 0 ? f : f + 1);
  return rounded / 100;
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("CSV needs a header row plus at least one holding.");
  const headers = lines[0].split(",").map((h) => h.trim());
  const required = ["ticker", "company_name", "sector", "quantity", "buy_price", "current_price"];
  const missing = required.filter((c) => !headers.includes(c));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}. Expected ${required.join(",")}`);
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

interface Row { ticker: string; company_name: string; sector: string;
  quantity: number; buy_price: number; current_price: number }

function toRows(records: Record<string, string>[]): Row[] {
  return records.map((r) => {
    const quantity = Number(r.quantity), buy = Number(r.buy_price), cur = Number(r.current_price);
    if (!Number.isFinite(quantity) || !Number.isFinite(buy) || !Number.isFinite(cur))
      throw new Error(`Non-numeric quantity/price in row ${r.ticker || "?"}.`);
    if (quantity < 0) throw new Error("quantity must be >= 0");
    return { ticker: r.ticker, company_name: r.company_name, sector: r.sector,
             quantity: quantity, buy_price: buy, current_price: cur };
  });
}

function pctNormalize(exact: Record<string, number>): Record<string, number> {
  const keys = Object.keys(exact);
  if (!keys.length) return {};
  const total = keys.reduce((s, k) => s + exact[k], 0);
  if (total === 0) return Object.fromEntries(keys.map((k) => [k, 0]));
  const scaled: Record<string, number> = {};
  keys.forEach((k) => { scaled[k] = (exact[k] / total) * 100; });
  const floored: Record<string, number> = {};
  keys.forEach((k) => { floored[k] = Math.floor(scaled[k] * 100) / 100; });
  const cents = Math.round((100 - keys.reduce((s, k) => s + floored[k], 0)) * 100);
  const order = [...keys].sort((a, b) => (scaled[b] - floored[b]) - (scaled[a] - floored[a]));
  const out = { ...floored };
  for (let i = 0; i < Math.abs(cents); i++) {
    const k = order[i % order.length];
    out[k] = r2(out[k] + (cents > 0 ? 0.01 : -0.01));
  }
  return out;
}

export function calculateReturns(records: Record<string, string>[]): Returns {
  const rows = toRows(records).map((r) => ({
    ...r,
    cost_value: r.quantity * r.buy_price,
    current_value: r.quantity * r.current_price,
  })).map((r) => ({
    ...r,
    pnl: r.current_value - r.cost_value,
    pnl_pct: r.cost_value ? (r.current_value - r.cost_value) / r.cost_value * 100 : 0,
  })).sort((a, b) => b.pnl - a.pnl);
  const total_cost = rows.reduce((s, r) => s + r.cost_value, 0);
  const total_value = rows.reduce((s, r) => s + r.current_value, 0);
  const total_pnl = total_value - total_cost;
  return {
    holdings: rows.map((r) => ({
      ticker: r.ticker, company_name: r.company_name, sector: r.sector,
      quantity: r.quantity, buy_price: r.buy_price, current_price: r.current_price,
      cost_value: r2(r.cost_value), current_value: r2(r.current_value),
      pnl: r2(r.pnl), pnl_pct: r2(r.pnl_pct),
    })),
    totals: {
      total_cost: r2(total_cost), total_value: r2(total_value), total_pnl: r2(total_pnl),
      return_pct: r2(total_cost ? total_pnl / total_cost * 100 : 0),
      best_ticker: rows[0]?.ticker ?? null, worst_ticker: rows[rows.length - 1]?.ticker ?? null,
      num_winners: rows.filter((r) => r.pnl > 0).length,
      num_losers: rows.filter((r) => r.pnl < 0).length,
    },
  };
}

export function calculateAllocation(records: Record<string, string>[]): Allocation {
  const rows = toRows(records);
  const total = rows.reduce((s, r) => s + r.quantity * r.current_price, 0);
  const empty: Allocation = { by_sector: {}, by_holding: {}, top_sector: "", top_sector_pct: 0,
    top_holding: "", top_holding_pct: 0, hhi: 0 };
  if (total === 0) return empty;
  const sectorExact: Record<string, number> = {};
  const holdingExact: Record<string, number> = {};
  rows.forEach((r) => {
    const v = (r.quantity * r.current_price) / total * 100;
    sectorExact[r.sector] = (sectorExact[r.sector] ?? 0) + v;
    holdingExact[r.ticker] = (holdingExact[r.ticker] ?? 0) + v;
  });
  const by_sector = pctNormalize(sectorExact);
  const by_holding: Record<string, number> = {};
  Object.keys(holdingExact).forEach((k) => { by_holding[k] = r2(holdingExact[k]); });
  const top_sector = Object.keys(sectorExact).sort((a, b) => sectorExact[b] - sectorExact[a])[0];
  const top_holding = Object.keys(holdingExact).sort((a, b) => holdingExact[b] - holdingExact[a])[0];
  return {
    by_sector, by_holding, top_sector, top_sector_pct: by_sector[top_sector],
    top_holding, top_holding_pct: by_holding[top_holding],
    hhi: r2(Object.values(sectorExact).reduce((s, w) => s + w * w, 0)),
  };
}

export function assessRisk(returns: Returns, allocation: Allocation): Risk {
  const flags: string[] = [];
  let level: Risk["risk_level"] = "LOW";
  const top_pct = allocation.top_sector_pct;
  if (top_pct >= 50) {
    flags.push(`Very high concentration: ${allocation.top_sector} is ${top_pct}% of portfolio (threshold 50%).`);
    level = "HIGH";
  } else if (top_pct >= 30) {
    flags.push(`High concentration: ${allocation.top_sector} is ${top_pct}% of portfolio (threshold 30%).`);
    if (level === "LOW") level = "MEDIUM";
  }
  if (allocation.top_holding_pct >= 20) {
    flags.push(`Single-holding risk: ${allocation.top_holding} is ${allocation.top_holding_pct}% (threshold 20%).`);
    if (level === "LOW") level = "MEDIUM";
  }
  const losers = returns.holdings.filter((h) => h.pnl < 0);
  if (losers.length) {
    const worst = losers.reduce((a, b) => (a.pnl_pct < b.pnl_pct ? a : b));
    flags.push(`${losers.length} losing holding(s); worst is ${worst.ticker} (${worst.pnl_pct}%).`);
  }
  if (allocation.hhi >= 2500) {
    flags.push(`Diversification weak (HHI ${allocation.hhi} >= 2500 = highly concentrated).`);
    if (level === "LOW") level = "MEDIUM";
  }
  if (!flags.length) flags.push("No major concentration or loss flags. Portfolio looks reasonably diversified.");
  return {
    risk_level: level, risk_score: { LOW: 25, MEDIUM: 55, HIGH: 80 }[level], flags,
    top_sector: allocation.top_sector, top_sector_pct: top_pct, num_losers: losers.length,
    losers: losers.map((h) => ({ ticker: h.ticker, pnl: h.pnl, pnl_pct: h.pnl_pct })),
  };
}

export function estimateTax(returns: Returns, rate = 0.15): Tax {
  const per_holding = returns.holdings.map((h) => {
    const gain = Math.max(0, h.pnl);
    return { ticker: h.ticker, pnl: h.pnl, taxable_gain: r2(gain), est_tax: r2(gain * rate) };
  });
  return {
    rate,
    total_taxable_gain: r2(per_holding.reduce((s, p) => s + p.taxable_gain, 0)),
    total_est_tax: r2(per_holding.reduce((s, p) => s + p.est_tax, 0)),
    per_holding,
    note: "Simplified flat-rate estimate on unrealized gains only. Not tax advice.",
  };
}

export function healthScore(returns: Returns, allocation: Allocation, risk: Risk): Health {
  let score = 100;
  const notes: string[] = [];
  if (allocation.top_sector_pct > 30) {
    const p = Math.min(40, r2((allocation.top_sector_pct - 30) * 1.5));
    score -= p;
    notes.push(`-${trimNum(p)} concentration (${allocation.top_sector} ${allocation.top_sector_pct}%)`);
  }
  if (allocation.top_holding_pct >= 20) {
    score -= 10;
    notes.push(`-10 single holding ${allocation.top_holding} at ${allocation.top_holding_pct}%`);
  }
  if (allocation.hhi >= 2500) { score -= 10; notes.push("-10 weak diversification (HHI >= 2500)"); }
  if (risk.losers.length) {
    const p = Math.min(15, 5 * risk.losers.length);
    score -= p;
    notes.push(`-${trimNum(p)} for ${risk.losers.length} losing holding(s)`);
    const worst = risk.losers.reduce((a, b) => (a.pnl_pct < b.pnl_pct ? a : b));
    if (worst.pnl_pct <= -10) { score -= 5; notes.push(`-5 worst loser ${worst.ticker} at ${worst.pnl_pct}%`); }
  }
  if (returns.totals.return_pct > 0) { score = Math.min(100, score + 5); notes.push("+5 overall gain is positive"); }
  score = r2(Math.max(0, Math.min(100, score)));
  if (!notes.length) notes.push("No penalties — well balanced.");
  return { score, grade: score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D", breakdown: notes };
}
function trimNum(n: number): string { return String(Math.round(n * 10) / 10); }

export function rebalancePlan(records: Record<string, string>[], cap_pct = 35): Plan {
  const rows = toRows(records);
  const values = rows.map((r) => ({ ...r, current_value: r.quantity * r.current_price }));
  const total = values.reduce((s, r) => s + r.current_value, 0);
  const bySector: Record<string, number> = {};
  values.forEach((r) => { bySector[r.sector] = (bySector[r.sector] ?? 0) + r.current_value; });
  const sells: Plan["sells"] = [];
  let freed = 0;
  Object.keys(bySector).forEach((sector) => {
    const pct = (bySector[sector] / total) * 100;
    if (pct > cap_pct) {
      const excess = r2(((pct - cap_pct) / 100) * total);
      freed += excess;
      const members = values.filter((r) => r.sector === sector);
      const secTotal = members.reduce((s, r) => s + r.current_value, 0);
      members.forEach((r) => {
        const sell_val = r2(excess * (secTotal ? r.current_value / secTotal : 0));
        sells.push({ ticker: r.ticker, sector, sell_value: sell_val,
                     sell_qty: Math.round((sell_val / r.current_price) * 1000) / 1000 });
      });
    }
  });
  freed = r2(freed);
  const under = Object.keys(bySector).filter((s) => (bySector[s] / total) * 100 < cap_pct);
  const underTotal = under.reduce((s, k) => s + bySector[k], 0);
  const buys: Plan["buys"] = [];
  if (freed && underTotal) {
    under.sort((a, b) => bySector[b] - bySector[a]).forEach((sector) => {
      const buy_val = r2((freed * bySector[sector]) / underTotal);
      buys.push({ sector, buy_value: buy_val,
                  new_pct: r2((bySector[sector] + buy_val) / total * 100) });
    });
  }
  const new_by_sector: Record<string, number> = {};
  Object.keys(bySector).forEach((s) => {
    const pct = (bySector[s] / total) * 100;
    new_by_sector[s] = pct > cap_pct ? cap_pct : (buys.find((b) => b.sector === s)?.new_pct ?? r2(pct));
  });
  return {
    cap_pct, freed_total: freed, sells, buys, new_by_sector,
    note: sells.length
      ? "Trim the SELL list and spread proceeds across the BUY list. Values only — review taxes before acting."
      : `No sector above ${cap_pct}% — no rebalancing needed.`,
  };
}

export function projectGrowth(total_value: number, years = 5, rates: number[] = [0.05, 0.1, 0.15]): Projection {
  return {
    starting_value: r2(total_value), years,
    scenarios: rates.map((r) => ({
      label: `${Math.round(r * 100)}% p.a.`, rate: r,
      value: r2(total_value * Math.pow(1 + r, years)),
    })),
    note: "Straight compounding illustration. Real returns vary — not a prediction.",
  };
}

export function stressTest(records: Record<string, string>[], drop_sector?: string | null, drop_pct = 20): Stress {
  if (drop_pct < 0 || drop_pct > 100) throw new Error("drop_pct must be between 0 and 100");
  const allocation = calculateAllocation(records);
  const target = drop_sector || allocation.top_sector;
  if (!(target in allocation.by_sector))
    throw new Error(`Unknown sector '${target}'. Choices: ${Object.keys(allocation.by_sector).sort().join(", ")}`);
  const rows = toRows(records);
  const total = rows.reduce((s, r) => s + r.quantity * r.current_price, 0);
  const sectorVal = rows.filter((r) => r.sector === target)
    .reduce((s, r) => s + r.quantity * r.current_price, 0);
  const loss = r2((sectorVal * drop_pct) / 100);
  const newTotal = r2(total - loss);
  const fallPct = total ? r2((loss / total) * 100) : 0;
  return {
    sector: target, drop_pct, sector_loss: loss, old_total: r2(total), new_total: newTotal,
    portfolio_fall_pct: fallPct,
    sector_new_pct: newTotal ? r2(((sectorVal - loss) / newTotal) * 100) : 0,
    note: `If ${target} fell ${drop_pct}% the portfolio would drop ${fallPct}% to ~${newTotal}. Hypothetical.`,
  };
}

export function sipForGoal(target_amount: number, years: number, annual_rate = 0.1): Goal {
  if (target_amount <= 0 || years <= 0) throw new Error("target_amount and years must be positive");
  if (!(annual_rate >= 0 && annual_rate <= 1)) throw new Error("annual_rate must be between 0 and 1 (e.g. 0.10 for 10%)");
  const r = annual_rate / 12, n = years * 12;
  const monthly = r ? r2((target_amount * r) / (Math.pow(1 + r, n) - 1)) : r2(target_amount / n);
  return {
    target_amount, years, annual_rate, monthly_sip: monthly,
    total_invested: r2(monthly * n),
    note: `Invest ~${monthly}/month for ${years}y at ${Math.round(annual_rate * 100)}% to reach ~${target_amount}.`,
  };
}

export function taxLossHarvest(returns: Returns, rate = 0.15): Harvest {
  const losers = returns.holdings.filter((h) => h.pnl < 0);
  const winners = returns.holdings.filter((h) => h.pnl > 0).sort((a, b) => b.pnl - a.pnl);
  const pairs = losers.map((loser) => {
    const loss = Math.abs(loser.pnl);
    const offset_with: { ticker: string; offset: number }[] = [];
    let remaining = loss;
    for (const w of winners) {
      if (remaining <= 0) break;
      const use = r2(Math.min(w.pnl, remaining));
      offset_with.push({ ticker: w.ticker, offset: use });
      remaining = r2(remaining - use);
    }
    return { sell_loser: loser.ticker, book_loss: r2(loss), offset_with,
             tax_saved: r2((loss - remaining) * rate) };
  });
  return {
    rate, pairs, total_tax_saved: r2(pairs.reduce((s, p) => s + p.tax_saved, 0)),
    note: pairs.length
      ? "Sell losers + trim paired winners to offset gains. Simplified — watch wash-sale rules. Not tax advice."
      : "No losing holdings — nothing to harvest.",
  };
}

export function riskMetrics(returns: Returns): Metrics {
  const pcts = returns.holdings.map((h) => h.pnl_pct);
  const mean = pcts.length ? pcts.reduce((s, x) => s + x, 0) / pcts.length : 0;
  const vol = pcts.length > 1
    ? r2(Math.sqrt(pcts.reduce((s, x) => s + (x - mean) ** 2, 0) / pcts.length)) : 0;
  const total_ret = returns.totals.return_pct;
  const wins = returns.holdings.filter((h) => h.pnl > 0);
  const losses = returns.holdings.filter((h) => h.pnl < 0);
  const best = returns.holdings.reduce((a, b) => (b.pnl > (a?.pnl ?? -Infinity) ? b : a), returns.holdings[0] ?? null);
  const worst = returns.holdings.reduce((a, b) => (b.pnl < (a?.pnl ?? Infinity) ? b : a), returns.holdings[0] ?? null);
  return {
    volatility_pct: vol, sharpe_proxy: vol ? r2(total_ret / vol) : 0,
    win_rate_pct: returns.holdings.length ? Math.round((wins.length / returns.holdings.length) * 1000) / 10 : 0,
    avg_win: wins.length ? r2(wins.reduce((s, h) => s + h.pnl, 0) / wins.length) : 0,
    avg_loss: losses.length ? r2(losses.reduce((s, h) => s + h.pnl, 0) / losses.length) : 0,
    best_contributor: best?.ticker ?? null, worst_contributor: worst?.ticker ?? null,
    note: "Higher Sharpe proxy = more return per unit of wobble. Single-period estimate — compare portfolios with it, don't worship it.",
  };
}

export function buildAlerts(returns: Returns, allocation: Allocation): Alert[] {
  const alerts: Alert[] = [];
  const top_pct = allocation.top_sector_pct || 0;
  if (top_pct >= 50) alerts.push({ severity: "critical", text: `${allocation.top_sector} is ${top_pct}% — over the 50% danger line.` });
  else if (top_pct >= 30) alerts.push({ severity: "warn", text: `${allocation.top_sector} is ${top_pct}% — over the 30% watch line.` });
  const hold_pct = allocation.top_holding_pct || 0;
  if (hold_pct >= 20) alerts.push({
    severity: hold_pct < 25 ? "warn" : "critical",
    text: `${allocation.top_holding} alone is ${hold_pct}% of your money.`,
  });
  returns.holdings.forEach((h) => {
    if (h.pnl_pct <= -20) alerts.push({ severity: "critical", text: `${h.ticker} is down ${h.pnl_pct}% — review urgently.` });
    else if (h.pnl_pct <= -10) alerts.push({ severity: "warn", text: `${h.ticker} is down ${h.pnl_pct}% — check the story.` });
  });
  if ((allocation.hhi || 0) >= 2500) alerts.push({ severity: "warn", text: `Diversification weak (HHI ${allocation.hhi}).` });
  if (!alerts.length) {
    alerts.push(returns.holdings.length && !returns.holdings.some((h) => h.pnl < 0)
      ? { severity: "ok", text: "Every holding is green — consider booking partial profit on the top winner." }
      : { severity: "ok", text: "No threshold breaches. Portfolio looks balanced." });
  }
  const order = { critical: 0, warn: 1, ok: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function analystBundle(records: Record<string, string>[]): { findings: Findings; risks: Risks } {
  const returns = calculateReturns(records);
  const allocation = calculateAllocation(records);
  const t = returns.totals;
  const findings: Findings = {
    analysis: `Portfolio worth ${t.total_value} (cost ${t.total_cost}, P&L ${t.total_pnl} / ${t.return_pct}%). ` +
      `Top sector ${allocation.top_sector} at ${allocation.top_sector_pct}%. ` +
      `Winners ${t.num_winners}, losers ${t.num_losers}.`,
    returns, allocation,
  };
  const risk = assessRisk(returns, allocation);
  const risks: Risks = {
    risk, tax: estimateTax(returns), health: healthScore(returns, allocation, risk),
    plan: rebalancePlan(records), projection: projectGrowth(t.total_value),
    stress: stressTest(records), harvest: taxLossHarvest(returns),
    goal: sipForGoal(100000, 5), metrics: riskMetrics(returns),
    alerts: buildAlerts(returns, allocation), insights: [],
  };
  risks.insights = buildInsights(returns, allocation, risk, risks.harvest, risks.plan);
  return { findings, risks };
}

export function simulateRebalance(
  records: Record<string, string>[],
  opts: { target_sector_weights?: Record<string, number>; sell_ticker?: string; sell_fraction?: number },
) {
  const allocation = calculateAllocation(records);
  const returns = calculateReturns(records);
  const total = returns.totals.total_value;
  if (opts.target_sector_weights) {
    const deltas: Record<string, { current_pct: number; target_pct: number; delta_pct: number; delta_value: number }> = {};
    Object.keys(opts.target_sector_weights).forEach((sector) => {
      const target = opts.target_sector_weights![sector];
      const cur = allocation.by_sector[sector] ?? 0;
      deltas[sector] = { current_pct: cur, target_pct: target,
        delta_pct: r2(target - cur), delta_value: r2(((target - cur) / 100) * total) };
    });
    return { mode: "target_weights", total_value: total, deltas,
             note: "Positive delta_value = buy more; negative = trim. Adds to 0 only if targets sum to 100." };
  }
  if (opts.sell_ticker) {
    const rows = toRows(records).filter((r) => r.ticker === opts.sell_ticker);
    if (!rows.length) throw new Error(`ticker ${opts.sell_ticker} not in portfolio`);
    const qty = rows.reduce((s, r) => s + r.quantity, 0);
    const avg = qty ? rows.reduce((s, r) => s + r.quantity * r.current_price, 0) / qty : 0;
    const frac = opts.sell_fraction ?? 0.5;
    const proceeds = r2(qty * avg * frac);
    return { mode: "trim_holding", sell_ticker: opts.sell_ticker, sell_fraction: frac,
             proceeds, new_total: r2(total - proceeds),
             note: `Selling ${Math.round(frac * 100)}% of ${opts.sell_ticker} frees ~${proceeds}. Redeploy to underweight sectors.` };
  }
  return { mode: "none", note: "Pass target_sector_weights or sell_ticker." };
}

export function compareBundles(
  a: { name: string; findings: Findings; risks: Risks },
  b: { name: string; findings: Findings; risks: Risks },
) {
  const side = (x: typeof a) => ({
    file: x.name, n: x.findings.returns.holdings.length,
    value: x.findings.returns.totals.total_value,
    return_pct: x.findings.returns.totals.return_pct,
    health: x.risks.health.score, grade: x.risks.health.grade,
    risk: x.risks.risk.risk_level, top_sector: x.findings.allocation.top_sector,
    top_sector_pct: x.findings.allocation.top_sector_pct,
    winners: x.findings.returns.totals.num_winners, losers: x.findings.returns.totals.num_losers,
  });
  const A = side(a), B = side(b);
  const verdict = (key: "return_pct" | "health" | "top_sector_pct" | "losers",
                   better: (x: number, y: number) => boolean) => {
    if (A[key] === B[key]) return `Tie on ${key} (${A[key]}).`;
    const [w, l] = better(A[key] as number, B[key] as number) ? [A, B] : [B, A];
    return `${w.file} wins ${key} (${w[key]} vs ${l[key]}).`;
  };
  return { a: A, b: B, verdicts: [
    verdict("return_pct", (x, y) => x > y),
    verdict("health", (x, y) => x > y),
    verdict("top_sector_pct", (x, y) => x < y),
    verdict("losers", (x, y) => x < y),
  ] };
}

/** Insight Agent's raw material: up to 5 plain-English briefs, most urgent first. */
export function buildInsights(
  returns: Returns, allocation: Allocation, risk: Risk,
  harvest?: Harvest, plan?: Plan,
): Insight[] {
  const t = returns.totals;
  const holdings = returns.holdings;
  const insights: Insight[] = [];
  const top_pct = allocation.top_sector_pct || 0;
  if (top_pct >= 30) {
    insights.push({
      tone: top_pct >= 50 ? "bad" : "warn",
      title: `${allocation.top_sector} runs the show at ${top_pct}%`,
      body: `Over half your money moves with one sector. A 20% dip there would cost ~${r2((t.total_value * top_pct) / 100 * 0.2)}.`,
    });
  }
  if (holdings.length) {
    const best = holdings.reduce((a, b) => (b.pnl > a.pnl ? b : a));
    const worst = holdings.reduce((a, b) => (b.pnl < a.pnl ? b : a));
    const w = holdings.filter((h) => h.pnl > 0).length;
    insights.push({
      tone: best.pnl > 0 ? "good" : "warn",
      title: `${best.ticker} earned you ${best.pnl >= 0 ? "+" : ""}${best.pnl}; ${worst.ticker} cost ${worst.pnl >= 0 ? "+" : ""}${worst.pnl}`,
      body: `${w} of ${holdings.length} holdings are green. Know your winners — and what your worst one is teaching you.`,
    });
  }
  if (harvest?.pairs.length) {
    insights.push({
      tone: "good",
      title: `${harvest.pairs.length} loser(s) can save ~${harvest.total_tax_saved} in tax`,
      body: "Selling losers alongside trimmed winners offsets gains. Check the harvest panel for exact pairs.",
    });
  }
  if (plan?.sells.length) {
    insights.push({
      tone: "warn",
      title: `One trim frees ~${plan.freed_total}`,
      body: `Trimming the overweight sector back to ${plan.cap_pct}% funds every underweight sector at once.`,
    });
  }
  if (t.return_pct > 0 && !insights.some((i) => i.tone === "bad")) {
    insights.push({
      tone: "good",
      title: `Up ${t.return_pct}% overall — protect it`,
      body: "Gains are made; the job now is keeping them. A phased rebalance beats a rushed exit.",
    });
  }
  if (!insights.length)
    insights.push({ tone: "good", title: "Steady as she goes", body: "No concentration, no heavy losers. Review quarterly." });
  return insights.slice(0, 5);
}
/** Rule-based advice fallback — mirrors Python _fallback_advice (used when no LLM key). */
export function fallbackAdvice(findings: Findings, risks: Risks): string {
  const t = findings.returns.totals, a = findings.allocation;
  const lines = [
    `• Your portfolio is worth ${t.total_value} with an overall gain of ${t.total_pnl} (${t.return_pct}%).`,
    `• Health score: ${risks.health.score}/100 (grade ${risks.health.grade}).`,
  ];
  lines.push(a.top_sector_pct >= 30
    ? `• Risk: ${a.top_sector} is ${a.top_sector_pct}% of your money — that's concentrated. Consider trimming it gradually and adding to underweight sectors.`
    : `• Diversification looks reasonable across sectors.`);
  if (risks.plan.sells.length) {
    const top = risks.plan.sells[0];
    lines.push(`• Suggestion: rebalance plan frees ~${risks.plan.freed_total} (e.g. trim ${top.ticker} by ~${top.sell_value}). Spread it across: ${risks.plan.buys.slice(0, 3).map((x) => x.sector).join(", ")}.`);
  } else {
    const losers = findings.returns.holdings.filter((h) => h.pnl < 0).slice(0, 2);
    lines.push(losers.length
      ? `• Suggestion: review losers ${losers.map((h) => `${h.ticker} (${h.pnl_pct}%)`).join(", ")} — decide if the story changed or it's time to exit.`
      : `• Suggestion: all holdings are green — consider booking partial profit on the top winner.`);
  }
  lines.push(`• Note: selling all winners now could mean ~${risks.tax.total_est_tax} in simplified tax at ${Math.round(risks.tax.rate * 100)}%. Prefer phased exits.`);
  return lines.join("\n");
}

/** Offline Q&A fallback — mirrors Python qa_agent branches. */
export function qaFallback(findings: Findings, risks: Risks, question: string): string {
  const q = question.toLowerCase();
  const a = findings.allocation;
  if (/score|health|grade/.test(q)) {
    const h = risks.health;
    return `Health score is ${h.score}/100 (grade ${h.grade}). ` + h.breakdown.join(" ");
  }
  if (/rebalanc|plan|\bfix\b/.test(q)) {
    const p = risks.plan;
    if (p.sells.length)
      return `Rebalance plan frees ~${p.freed_total} by trimming ` +
        p.sells.slice(0, 3).map((s) => `${s.ticker} (~${s.sell_value})`).join(", ") +
        `. Spread it across ${p.buys.slice(0, 3).map((x) => x.sector).join(", ")}.`;
    return p.note;
  }
  if (/sip|goal/.test(q)) {
    const nums = (q.match(/[\d,]+/g) ?? []).map((n) => parseFloat(n.replace(/,/g, "")));
    if (nums.length >= 2) {
      try {
        const g = sipForGoal(nums[0], Math.floor(nums[1]));
        return `${g.note} Total invested ~${g.total_invested}.`;
      } catch (e) { return String((e as Error).message ?? e); }
    }
  }
  if (/project|future|grow/.test(q)) {
    const pj = risks.projection;
    return `In ${pj.years} years from ${pj.starting_value}: ` +
      pj.scenarios.map((s) => `${s.label}: ${s.value}`).join(", ") + ". Illustration only.";
  }
  if (/stress|crash|\bdrop\b|\bfall\b/.test(q)) {
    const s = risks.stress;
    return `Stress test: if ${s.sector} fell ${s.drop_pct}%, you'd lose ~${s.sector_loss} and the portfolio would drop ${s.portfolio_fall_pct}% to ~${s.new_total}. Hypothetical.`;
  }
  if (/harvest|offset|save tax/.test(q)) {
    const hv = risks.harvest;
    if (!hv.pairs.length) return hv.note;
    return "Tax-loss harvest: " + hv.pairs.map((p) =>
      `sell ${p.sell_loser} (loss ${p.book_loss}) saves ~${p.tax_saved}`).join("; ") +
      `. Total saved ~${hv.total_tax_saved}. Simplified.`;
  }
  if (/insight|brief|headline|tl;?dr/.test(q)) {
    if (!risks.insights.length) return "No insights right now.";
    return "Today's brief: " + risks.insights.slice(0, 3)
      .map((i) => `${i.title} — ${i.body}`).join(" | ");
  }
  if (/alert|warning|watch/.test(q)) {
    if (!risks.alerts.length) return "No alerts right now.";
    return "Alerts: " + risks.alerts.slice(0, 5).map((x) => `[${x.severity.toUpperCase()}] ${x.text}`).join(" | ");
  }
  if (/sharpe|volatil|win rate|metric/.test(q)) {
    const m = risks.metrics;
    return `Volatility ${m.volatility_pct}% | Sharpe proxy ${m.sharpe_proxy} | win rate ${m.win_rate_pct}% | best ${m.best_contributor} / worst ${m.worst_contributor}. Single-period estimates.`;
  }
  if (/risk|concentrat|diversif/.test(q))
    return `Your biggest risk is concentration: ${a.top_sector} is ${a.top_sector_pct}% (top holding ${a.top_holding} at ${a.top_holding_pct}%). HHI is ${a.hhi}. Consider trimming the top sector toward ~30-35%.`;
  if (/tax/.test(q))
    return `Simplified tax estimate is ~${risks.tax.total_est_tax} on gains of ${risks.tax.total_taxable_gain}.`;
  if (/los|worst|sell/.test(q)) {
    const w = findings.returns.holdings[findings.returns.holdings.length - 1];
    return `Worst holding is ${w.ticker} (${w.company_name}): ${w.pnl} (${w.pnl_pct}%). Review if its story changed before selling.`;
  }
  const t = findings.returns.totals;
  return `Portfolio worth ${t.total_value} (${t.return_pct}% overall). Top sector ${a.top_sector} ${a.top_sector_pct}%. Ask me about risk, tax, or any ticker.`;
}
