import type { Puzzle, PuzzleState } from "./types";

/** Mayúsculas, sin tildes (conserva la Ñ), solo letras y números. */
export function normalize(s: string | null | undefined): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/Ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "Ñ")
    .replace(/[^A-ZÑ0-9]/g, "");
}

export function lengthLabel(solution: string): string {
  const words = solution.trim().split(/[\s-]+/).filter(Boolean);
  return `(${words.map((w) => normalize(w).length).join(", ")})`;
}

/** "T _ _ _ _" mostrando las primeras n letras. */
export function letterPattern(solution: string, n: number): string {
  let shown = 0;
  return [...solution.toUpperCase()]
    .map((ch) => (/[\s-]/.test(ch) ? " " : shown++ < n ? ch : "_"))
    .join(" ");
}

export const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const fmtShort = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

export type Segment = { text: string; kind?: "def" | "ind" | "fil" };

/** Divide la pista en segmentos resaltando definición, indicadores y rellenos visibles. */
export function clueSegments(p: Puzzle, show: { def: boolean; ind: boolean; fil: boolean }): Segment[] {
  const clue = p.clue ?? "";
  const lower = clue.toLowerCase();
  const spans: { start: number; end: number; kind: Segment["kind"] }[] = [];

  const add = (text: string | null | undefined, kind: Segment["kind"]) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    const i = lower.indexOf(t.toLowerCase());
    if (i >= 0) spans.push({ start: i, end: i + t.length, kind });
  };

  if (show.def) add(p.definitionText, "def");
  if (show.ind) String(p.indicatorText ?? "").split("|").forEach((x) => add(x.replace(/#\d+/g, ""), "ind"));
  if (show.fil) String(p.fillerText ?? "").split("|").forEach((x) => add(x, "fil"));

  spans.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue; // evita solapes
    if (s.start > pos) out.push({ text: clue.slice(pos, s.start) });
    out.push({ text: clue.slice(s.start, s.end), kind: s.kind });
    pos = s.end;
  }
  if (pos < clue.length) out.push({ text: clue.slice(pos) });
  return out;
}

export const emptyState = (): PuzzleState => ({ attempts: 0, solved: false, revealed: false, hints: [], letters: 0 });

export function statusLabel(st: PuzzleState | undefined): { label: string; tone: "idle" | "progress" | "ok" | "bad" } {
  if (!st) return { label: "Sin empezar", tone: "idle" };
  const n = `${st.attempts} intento${st.attempts === 1 ? "" : "s"}`;
  if (st.solved) return { label: `Resuelto · ${n}`, tone: "ok" };
  if (st.revealed) return { label: "Solución vista", tone: "bad" };
  if (st.attempts || st.hints.length || st.letters) return { label: `En curso · ${n}`, tone: "progress" };
  return { label: "Sin empezar", tone: "idle" };
}
