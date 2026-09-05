// Report builders (mirror src/report.py) + browser download helper.
import type { Findings, Risks } from "./portfolio";

type Rec = Record<string, string>;

export function recordsToCSV(records: Rec[]): string {
  const head = "ticker,company_name,sector,quantity,buy_price,current_price";
  return [head, ...records.map((r) =>
    [r.ticker, r.company_name, r.sector, r.quantity, r.buy_price, r.current_price].join(","))].join("\n");
}

export function buildMarkdown(name: string, findings: Findings, risks: Risks, advice: string): string {
  const t = findings.returns.totals, a = findings.allocation;
  const { risk, tax, health, plan, projection: proj, stress, harvest, goal, metrics, alerts, insights } = risks;
  const L: string[] = [
    "# Portfolio Health Report",
    `_Generated ${new Date().toLocaleString()} from \`${name}\`_`, "",
    `## Health Score: ${health.score}/100 (Grade ${health.grade})`,
    ...health.breakdown.map((b) => `- ${b}`), "",
    "## Summary", findings.analysis, "",
    "## Today's Brief",
    ...(insights.length
      ? insights.map((i) => `- [${i.tone.toUpperCase()}] ${i.title} — ${i.body}`)
      : ["- No insights."]),
    "",
    "## Returns",
    `- Total value: ${t.total_value} (cost ${t.total_cost})`,
    `- Profit: ${t.total_pnl >= 0 ? "+" : ""}${t.total_pnl} (${t.return_pct >= 0 ? "+" : ""}${t.return_pct}%)`,
    `- Winners ${t.num_winners} / Losers ${t.num_losers} (best ${t.best_ticker}, worst ${t.worst_ticker})`, "",
    "## Allocation",
    ...Object.entries(a.by_sector).sort((x, y) => y[1] - x[1]).map(([s, p]) => `- ${s}: ${p}%`),
    `- HHI concentration index: ${a.hhi}`, "",
    "## Risk",
    `- Level: ${risk.risk_level} (${risk.risk_score}/100)`,
    ...risk.flags.map((f) => `- ${f}`),
    `- Volatility ${metrics.volatility_pct}% · Sharpe proxy ${metrics.sharpe_proxy} · win rate ${metrics.win_rate_pct}% (best ${metrics.best_contributor}, worst ${metrics.worst_contributor})`, "",
    "## Alerts",
    ...(alerts.length ? alerts.map((x) => `- [${x.severity.toUpperCase()}] ${x.text}`) : ["- No alerts."]), "",
    "## Tax (simplified estimate, not advice)",
    `- Est. tax ~${tax.total_est_tax} on gains ${tax.total_taxable_gain} @ ${Math.round(tax.rate * 100)}%`, "",
    "## Rebalance Plan",
    `- ${plan.note} Freed total: ~${plan.freed_total}`,
    ...plan.sells.map((s) => `- SELL ${s.ticker}: ~${s.sell_value} (~${s.sell_qty} shares)`),
    ...plan.buys.map((b) => `- BUY ${b.sector}: ~${b.buy_value} (-> ${b.new_pct}%)`), "",
    "## Growth Projection (illustration only)",
    `- From ${proj.starting_value} over ${proj.years} years: ` +
      proj.scenarios.map((s) => `${s.label} = ${s.value}`).join(", "),
    `- Goal example: ~${goal.monthly_sip}/month for ${goal.years}y at ${Math.round(goal.annual_rate * 100)}% reaches ~${goal.target_amount}`, "",
    "## Stress Test (hypothetical)", `- ${stress.note}`, "",
    "## Tax-Loss Harvest (simplified, not advice)",
    `- ${harvest.note} Total est. saved: ~${harvest.total_tax_saved}`,
    ...harvest.pairs.map((p) =>
      `- Sell ${p.sell_loser} (book loss ${p.book_loss}): offsets ` +
      p.offset_with.map((o) => `${o.ticker} (${o.offset})`).join(", ") +
      ` → saves ~${p.tax_saved}`), "",
    "## Advisor Recommendation", advice, "",
    "_Not financial advice. Educational demo on static sample data._",
  ];
  return L.join("\n");
}

export function download(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = filename;
  el.click();
  URL.revokeObjectURL(url);
}
