import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { fallbackAdvice, type Findings, type Risks } from "@/lib/portfolio";

const BASE_URL = (process.env.OPENAI_BASE_URL || "https://opencode.ai/zen/v1").replace(/\/$/, "");
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL_ID = process.env.MODEL_ID || "nemotron-3-ultra-free";
const CACHE_DIR = join(process.cwd(), "..", "outputs", ".advice_cache");

async function zenChat(system: string, prompt: string, timeoutMs = 45000): Promise<string | null> {
  if (!API_KEY) return null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
          temperature: 0.4, max_tokens: 600,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const content: string | undefined =
        data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning;
      if (content?.trim()) return content.trim();
    } catch { /* retry once */ }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { findings, risks, csv } = (await req.json()) as {
    findings: Findings; risks: Risks; csv: string;
  };
  if (!findings || !risks) return NextResponse.json({ error: "findings + risks required" }, { status: 400 });
  const key = createHash("sha256").update((csv || "") + process.env.MODEL_ID || "").digest("hex").slice(0, 16);
  const cacheFile = join(CACHE_DIR, `${key}.txt`);
  try {
    if (existsSync(cacheFile)) return NextResponse.json({ advice: readFileSync(cacheFile, "utf8"), cached: true });
  } catch { /* regenerate */ }

  const slim = { risk: risks.risk, tax: risks.tax, health: risks.health,
    plan: risks.plan, stress: risks.stress, harvest: risks.harvest,
    metrics: risks.metrics, insights: (risks.insights ?? []).slice(0, 3),
    alert_counts: {
      critical: risks.alerts.filter((a) => a.severity === "critical").length,
      warn: risks.alerts.filter((a) => a.severity === "warn").length,
      ok: risks.alerts.filter((a) => a.severity === "ok").length,
    } };
  const prompt =
    "You are a portfolio advisor for a retail investor.\n" +
    `ANALYST FINDINGS (JSON):\n${JSON.stringify(findings).slice(0, 3200)}\n` +
    `RISK+TAX+HEALTH+PLAN+STRESS+HARVEST (JSON):\n${JSON.stringify(slim).slice(0, 2800)}\n\n` +
    "Write a SHORT plain-English summary (max 120 words):\n" +
    "1) One line on overall health (value + return + health score).\n" +
    "2) One line on biggest risk (concentration/losers).\n" +
    "3) Give exactly 1-2 actionable suggestions (mention the rebalance plan's freed amount if useful, no jargon).\n" +
    "End with: 'Not financial advice.'";
  const advice = (await zenChat("You are a concise, honest retail portfolio advisor.", prompt))
    ?? fallbackAdvice(findings, risks);
  try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(cacheFile, advice); } catch { /* cache optional */ }
  return NextResponse.json({ advice, cached: false, model: API_KEY ? MODEL_ID : "rule-engine" });
}
