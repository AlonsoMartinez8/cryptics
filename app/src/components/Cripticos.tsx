import { useCallback, useEffect, useMemo, useState } from "react";
import type { CripticosData, PuzzleState } from "../lib/types";
import { emptyState, fmtShort, statusLabel } from "../lib/utils";
import PuzzleDetail from "./PuzzleDetail";

const STORE_KEY = "cripticos-progress-v1";
type Filter = "all" | "pending" | "solved";

const toneClass = {
  idle: "text-stone-500 dark:text-stone-400",
  progress: "text-amber-700 dark:text-amber-400",
  ok: "text-emerald-700 dark:text-emerald-400",
  bad: "text-rose-700 dark:text-rose-400",
};

export default function Cripticos({ data }: { data: CripticosData }) {
  const puzzles = useMemo(
    () => [...(data.puzzles ?? [])].sort((a, b) => b.date.localeCompare(a.date)), // más reciente primero
    [data]
  );

  const [progress, setProgress] = useState<Record<string, PuzzleState>>({});
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  // Cargar progreso y selección inicial (solo en cliente)
  useEffect(() => {
    try {
      setProgress(JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
    } catch {}
    setLoaded(true);

    const fromHash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      setSelected(puzzles.some((p) => p.date === h) ? h : null);
    };
    fromHash();

    // En escritorio abre directamente el de hoy (o el más reciente)
    if (!location.hash && window.matchMedia("(min-width: 768px)").matches && puzzles.length) {
      const today = new Date().toISOString().slice(0, 10);
      const pick = puzzles.find((p) => p.date <= today) ?? puzzles[0];
      history.replaceState(null, "", `#${pick.date}`);
      setSelected(pick.date);
    }

    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [puzzles]);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORE_KEY, JSON.stringify(progress));
  }, [progress, loaded]);

  const updateState = useCallback((date: string, fn: (s: PuzzleState) => PuzzleState | null) => {
    setProgress((prev) => {
      const next = { ...prev };
      const res = fn(prev[date] ?? emptyState());
      if (res) next[date] = res;
      else delete next[date];
      return next;
    });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return puzzles.filter((p) => {
      const st = progress[p.date];
      const done = !!st && (st.solved || st.revealed);
      if (filter === "solved" && !done) return false;
      if (filter === "pending" && done) return false;
      if (!q) return true;
      return [p.clue, p.author, p.date, p.tag].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [puzzles, progress, filter, query]);

  const open = (date: string) => {
    location.hash = date;
  };
  const close = () => {
    history.pushState(null, "", location.pathname + location.search);
    setSelected(null);
  };

  const solvedCount = puzzles.filter((p) => progress[p.date]?.solved).length;
  const current = puzzles.find((p) => p.date === selected) ?? null;
  const idx = current ? visible.findIndex((p) => p.date === current.date) : -1;
  // la lista va de más nuevo a más antiguo: "anterior" = más antiguo
  const older = idx >= 0 ? visible[idx + 1] : undefined;
  const newer = idx > 0 ? visible[idx - 1] : undefined;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-4 py-3 md:px-6 dark:border-stone-800">
        <h1 className="font-serif text-xl font-semibold md:text-2xl">
          Crípticos
        </h1>
        <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
          <span className="font-medium tabular-nums">{solvedCount}</span>/<span className="tabular-nums">{puzzles.length}</span>
          <span className="hidden sm:inline">resueltos</span>
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-stone-200 sm:block dark:bg-stone-800">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${puzzles.length ? (solvedCount / puzzles.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Lista: en móvil ocupa toda la pantalla y se oculta al abrir un críptico */}
        <aside
          className={`${current ? "hidden md:flex" : "flex"} w-full min-h-0 flex-col gap-3 border-stone-200 p-3 md:w-80 md:border-r lg:w-96 dark:border-stone-800`}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pista, autor o fecha…"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20 dark:border-stone-700 dark:bg-stone-900"
          />
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-stone-200/70 p-1 text-sm dark:bg-stone-800">
            {(
              [
                ["all", "Todos"],
                ["pending", "Pendientes"],
                ["solved", "Resueltos"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-md py-1.5 transition ${
                  filter === k
                    ? "bg-white font-medium shadow-sm dark:bg-stone-700"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            {visible.length === 0 && <li className="p-4 text-center text-sm text-stone-500">No hay crípticos.</li>}
            {visible.map((p) => {
              const s = statusLabel(progress[p.date]);
              const active = p.date === selected;
              return (
                <li key={p.date}>
                  <button
                    onClick={() => open(p.date)}
                    className={`grid w-full grid-cols-[3.5rem_1fr] gap-x-3 rounded-lg px-2 py-2.5 text-left transition ${
                      active
                        ? "bg-white shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
                        : "hover:bg-white/70 dark:hover:bg-stone-900/60"
                    }`}
                  >
                    <span className="row-span-2 pt-0.5 text-xs tabular-nums text-stone-500 uppercase">
                      {fmtShort(p.date)}
                    </span>
                    <span className="truncate text-[0.95rem]">{p.clue}</span>
                    <span className={`text-xs ${toneClass[s.tone]}`}>
                      {s.tone === "ok" && "✔ "}
                      {s.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Detalle */}
        <main className={`${current ? "flex" : "hidden md:flex"} min-h-0 flex-1 flex-col overflow-y-auto`}>
          {current ? (
            <PuzzleDetail
              key={current.date}
              puzzle={current}
              state={progress[current.date] ?? emptyState()}
              update={(fn) => updateState(current.date, fn)}
              onBack={close}
              onOlder={older ? () => open(older.date) : undefined}
              onNewer={newer ? () => open(newer.date) : undefined}
            />
          ) : (
            <p className="m-auto text-stone-500">Elige un críptico de la lista.</p>
          )}
        </main>
      </div>
    </div>
  );
}
