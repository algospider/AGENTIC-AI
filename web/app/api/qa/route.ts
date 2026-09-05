import { NextRequest, NextResponse } from "next/server";
import { qaFallback, type Findings, type Risks } from "@/lib/portfolio";

// Keep well under serverless function limits (Netlify free ≈10s):
// one quick LLM attempt, then the instant offline answer.
export const maxDuration = 60;

const QA_TIMEOUT_MS = 8000;

const BASE_URL = (process.env.OPENAI_BASE_URL || "https://opencode.ai/zen/v1").replace(/\/$/, "");
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL_ID = process.env.MODEL_ID || "nemotron-3-ultra-free";

export async function POST(req: NextRequest) {
  const { findings, risks, question, history } = (await req.json()) as {
    findings: Findings; risks: Risks; question: string;
    history?: { role: string; content: string }[];
  };
  if (!findings || !risks || !question?.trim())
    return NextResponse.json({ error: "findings + risks + question required" }, { status: 400 });

  if (API_KEY) {
    const rd = risks;
    const extras = {
      projection: rd.projection, stress: rd.stress, harvest: rd.harvest,
      goal_example: rd.goal, metrics: rd.metrics, alerts: rd.alerts,
      sip_help: "For a custom SIP goal use: monthly = FV*r/((1+r)^n-1), r=annual_rate/12, n=years*12. Compute it.",
    };
    const hist = (history ?? []).slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");
    const prompt =
      "Answer the user's portfolio question using ONLY these findings.\n" +
      `FINDINGS:\n${JSON.stringify(findings).slice(0, 3000)}\n` +
      `RISK:\n${JSON.stringify(rd.risk).slice(0, 1200)}\n` +
      `PROJECTION+STRESS+HARVEST+GOAL:\n${JSON.stringify(extras).slice(0, 1500)}\n` +
      `CHAT SO FAR:\n${hist}\nQUESTION: ${question}\n` +
      "Keep it under 100 words, plain English.";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), QA_TIMEOUT_MS);
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: [
            { role: "system", content: "You answer portfolio questions briefly and factually." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4, max_tokens: 400,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const text: string | undefined =
          data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning;
        if (text?.trim()) return NextResponse.json({ answer: text.trim(), model: MODEL_ID });
      }
    } catch { /* fall through to offline answer */ }
  }
  return NextResponse.json({ answer: qaFallback(findings, risks, question), model: "rule-engine" });
}
