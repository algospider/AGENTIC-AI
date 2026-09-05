"use client";
import { useState, type ReactNode } from "react";
import { CheckIcon, MoonIcon, SunIcon } from "./icons";

export function Card({ title, accent, children, wide }: {
  title: string; accent?: string; children: ReactNode; wide?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-edge bg-panel p-5 shadow-card ${wide ? "md:col-span-2" : ""}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-fog">
        {accent && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: accent }} />}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: {
  label: string; value: string; sub?: string;
  tone?: "green" | "red" | "yellow" | "cyan";
}) {
  const colors = {
    green: "text-up", red: "text-down",
    yellow: "text-warn", cyan: "text-signal",
  };
  return (
    <div className="rounded-xl bg-well p-4">
      <div className="text-xs uppercase tracking-wide text-mist">{label}</div>
      <div className={`num-serif mt-1 text-2xl font-bold ${tone ? colors[tone] : "text-paper"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fog">{sub}</div>}
    </div>
  );
}

export function HealthBar({ score, grade }: { score: number; grade: string }) {
  const color = score >= 80 ? "bg-up" : score >= 65 ? "bg-mid" : score >= 50 ? "bg-warn" : "bg-down";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="num-serif text-3xl font-bold text-paper">{score}<span className="text-base text-fog">/100</span></span>
        <span className="rounded-lg bg-track px-2.5 py-1 text-sm font-bold text-paper">Grade {grade}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-track">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function Badge({ tone, children }: { tone: "green" | "red" | "yellow" | "cyan" | "slate"; children: ReactNode }) {
  const map = {
    green: "bg-up-soft text-up border-up",
    red: "bg-down-soft text-down border-down",
    yellow: "bg-warn-soft text-warn border-warn",
    cyan: "bg-signal-soft text-signal border-signal",
    slate: "bg-track text-fog border-edge",
  };
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-fog">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-edge bg-field px-3 py-2 text-sm text-paper placeholder:text-mist focus:border-signal focus:outline-none";

export const btnPrimary =
  "h-10 rounded-lg bg-signal px-5 text-sm font-semibold text-on-accent hover:bg-signal disabled:opacity-50";

export const btnGhost =
  "h-10 rounded-lg border border-edge bg-field px-5 text-sm font-semibold text-paper hover:bg-well disabled:opacity-50";

export function money(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function signed(n: number, suffix = ""): string {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

export interface Toast { id: number; text: string; tone: "green" | "red" | "cyan" }

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  const border = { green: "border-up", red: "border-down", cyan: "border-signal" };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`anim-toast rounded-xl border bg-panel p-3 text-sm text-paper shadow-card ${border[t.tone]}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: `${96 - i * 9}%` }} />
      ))}
    </div>
  );
}

export interface Stage { agent: string; task: string; ms: number; detail: string }

export function Timeline({ stages }: { stages: Stage[] }) {
  if (!stages.length) return null;
  const total = stages.reduce((s, x) => s + x.ms, 0);
  return (
    <ol className="relative space-y-3 border-l border-edge pl-5">
      {stages.map((s, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-up text-on-accent"><CheckIcon width={11} height={11} /></span>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-paper">
              {s.agent} <span className="font-normal text-fog">· {s.task}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-mist">{s.ms}ms</span>
          </div>
          <div className="text-xs tabular-nums text-fog">{s.detail}</div>
        </li>
      ))}
      <li className="pt-1 text-xs text-mist">Pipeline total {total}ms + advisor call</li>
    </ol>
  );
}

export function LiveBadge({ live }: {
  live: { updated: number; at: string } | null;
}) {  if (!live)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-xs text-fog">
        <span className="inline-block h-2 w-2 rounded-full bg-track" /> CSV prices
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-up bg-up-soft px-2.5 py-1 text-xs font-semibold text-up" title="Live market prices from Yahoo Finance">
      <span className="live-dot inline-block h-2 w-2 rounded-full bg-up" />
      LIVE · {live.updated} prices · {live.at}
    </span>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() =>
    typeof document === "undefined" ? "light" : (document.documentElement.dataset.theme || "light"));
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("pha-theme", next); } catch { /* private mode */ }
    setTheme(next);
  };
  return (
    <button className={btnGhost} onClick={flip} aria-label="Switch colour theme"
      title={theme === "dark" ? "White canvas" : "Dark ledger"}>
      <span className="inline-flex items-center gap-1.5">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
