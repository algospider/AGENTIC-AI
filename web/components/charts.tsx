"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Allocation, Returns } from "@/lib/portfolio";

// Restrained classic set: blue-led categoricals, semantic gain/loss.
const COLORS = ["#3b82f6", "#64748b", "#60a5fa", "#94a3b8", "#2563eb",
  "#93c5fd", "#475569", "#cbd5e1", "#1d4ed8", "#7c8aa0", "#bfdbfe", "#9aa7b8"];

const TOOLTIP = { background: "var(--panel-solid)", border: "1px solid var(--edge)", borderRadius: 8 };

export function AllocationPie({ allocation }: { allocation: Allocation }) {
  const data = Object.entries(allocation.by_sector)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={95} label={(d) => `${d.name} ${d.value}%`}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => [`${v}%`, "Share"]} contentStyle={TOOLTIP} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PnlBars({ returns }: { returns: Returns }) {
  const rows = [...returns.holdings].sort((a, b) => b.pnl - a.pnl);
  const data = [...rows.slice(0, 5), ...rows.slice(-3)].map((h) => ({ name: h.ticker, pnl: h.pnl }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" />
        <XAxis type="number" stroke="var(--faint)" fontSize={12} />
        <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} width={55} />
        <Tooltip formatter={(v) => [v, "P&L"]} contentStyle={TOOLTIP} />
        <Bar dataKey="pnl" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#10b981" : "#ef4444"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
