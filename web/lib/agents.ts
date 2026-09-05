// Agent orchestra — five specialists run in order, each timed for the timeline UI.
// Pure + synchronous (the Advisor LLM stage runs separately via /api/advice).
import {
  assessRisk, buildAlerts, buildInsights, calculateAllocation, calculateReturns, estimateTax,
  healthScore, projectGrowth, rebalancePlan, sipForGoal, stressTest,
  taxLossHarvest, riskMetrics,
  type Findings, type Returns, type Risks,
} from "./portfolio";

export interface StageRun { agent: string; task: string; ms: number; detail: string }
export interface Orchestrated { findings: Findings; risks: Risks; timeline: StageRun[] }

type Rec = Record<string, string>;

function timed<T>(agent: string, task: string, fn: () => { value: T; detail: string }): { value: T; stage: StageRun } {
  const t0 = performance.now();
  const { value, detail } = fn();
  return { value, stage: { agent, task, ms: Math.max(1, Math.round(performance.now() - t0)), detail } };
}

/** Tax Calculator Agent: what acting costs, and how losers can pay for winners. */
export function taxAgent(returns: Returns) {
  return { tax: estimateTax(returns), harvest: taxLossHarvest(returns) };
}

export function orchestrate(records: Rec[]): Orchestrated {
  const timeline: StageRun[] = [];

  const an = timed("Analyst", "Measured every holding", () => {
    const returns = calculateReturns(records);
    const allocation = calculateAllocation(records);
    const t = returns.totals;
    return {
      value: {
        analysis: `Portfolio worth ${t.total_value} (cost ${t.total_cost}, P&L ${t.total_pnl} / ${t.return_pct}%). ` +
          `Top sector ${allocation.top_sector} at ${allocation.top_sector_pct}%. ` +
          `Winners ${t.num_winners}, losers ${t.num_losers}.`,
        returns, allocation,
      } as Findings,
      detail: `${returns.holdings.length} holdings · ${t.total_value} · ${t.return_pct >= 0 ? "+" : ""}${t.return_pct}%`,
    };
  });
  timeline.push(an.stage);
  const findings = an.value;
  const { returns, allocation } = findings;

  const rk = timed("Risk", "Scored danger + wobble", () => {
    const risk = assessRisk(returns, allocation);
    const metrics = riskMetrics(returns);
    const stress = stressTest(records);
    return {
      value: { risk, metrics, stress },
      detail: `${risk.risk_level} (${risk.risk_score}) · vol ${metrics.volatility_pct}% · Sharpe ${metrics.sharpe_proxy}`,
    };
  });
  timeline.push(rk.stage);

  const pl = timed("Planner", "Plotted the way out", () => {
    const plan = rebalancePlan(records);
    const projection = projectGrowth(returns.totals.total_value);
    const goal = sipForGoal(100000, 5);
    return {
      value: { plan, projection, goal },
      detail: plan.sells.length ? `frees ~${plan.freed_total}` : "no rebalance needed",
    };
  });
  timeline.push(pl.stage);

  const tx = timed("Tax", "Priced every move", () => {
    const { tax, harvest } = taxAgent(returns);
    return {
      value: { tax, harvest },
      detail: `bill ~${tax.total_est_tax} · harvest saves ~${harvest.total_tax_saved}`,
    };
  });
  timeline.push(tx.stage);

  const se = timed("Sentinel", "Set the tripwires", () => {
    const alerts = buildAlerts(returns, allocation);
    const crit = alerts.filter((a) => a.severity === "critical").length;
    return {
      value: { alerts },
      detail: `${alerts.length} alert${alerts.length === 1 ? "" : "s"} · ${crit} critical`,
    };
  });
  timeline.push(se.stage);

  const risks: Risks = {
    risk: rk.value.risk, tax: tx.value.tax,
    health: healthScore(returns, allocation, rk.value.risk),
    plan: pl.value.plan, projection: pl.value.projection,
    stress: rk.value.stress, harvest: tx.value.harvest, goal: pl.value.goal,
    metrics: rk.value.metrics, alerts: se.value.alerts,
    insights: buildInsights(returns, allocation, rk.value.risk, tx.value.harvest, pl.value.plan),
  };

  const sc = timed("Scout", "Spotted what matters", () => ({
    value: risks.insights,
    detail: risks.insights.length
      ? `${risks.insights.length} briefs · lead: ${risks.insights[0].title.slice(0, 60)}`
      : "nothing to flag",
  }));
  timeline.push(sc.stage);
  return { findings, risks, timeline };
}
