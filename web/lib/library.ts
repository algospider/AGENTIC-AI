// Personal library, stored per-user in the browser (localStorage).
// Why client-side: Netlify functions have an ephemeral filesystem, so a server
// file-store would silently lose data in production. Keyed by Firebase UID.
import type { Findings, Risks } from "./portfolio";

export interface SavedReport {
  id: string; name: string; savedAt: string;
  holdings: number; value: number; health?: { score: number; grade: string };
  findings: Findings; risks: Risks; advice: string;
  records?: Record<string, string>[];
}

const keyFor = (uid: string) => `pha-library-${uid}`;

function readAll(uid: string): SavedReport[] {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(uid: string, items: SavedReport[]) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(items.slice(0, 50)));
  } catch {
    /* storage full/blocked — library just won't persist */
  }
}

export function listReports(uid: string): SavedReport[] {
  return readAll(uid);
}

export function saveReport(
  uid: string, name: string, findings: Findings, risks: Risks, advice: string,
  records?: Record<string, string>[],
): SavedReport {
  const item: SavedReport = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: name.slice(0, 80) || "Untitled",
    savedAt: new Date().toISOString(),
    holdings: findings.returns.holdings.length,
    value: findings.returns.totals.total_value,
    health: { score: risks.health.score, grade: risks.health.grade },
    findings, risks, advice: String(advice ?? "").slice(0, 20000),
    ...(records ? { records } : {}),
  };
  const items = readAll(uid);
  writeAll(uid, [item, ...items]);
  return item;
}

export function deleteReport(uid: string, id: string): boolean {
  const items = readAll(uid);
  const next = items.filter((x) => x.id !== id);
  if (next.length === items.length) return false;
  writeAll(uid, next);
  return true;
}
