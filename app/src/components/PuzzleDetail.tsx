import { useEffect, useRef, useState } from "react";
import type { HintKey, Puzzle, PuzzleState } from "../lib/types";
import { clueSegments, fmtLong, lengthLabel, letterPattern, normalize } from "../lib/utils";

interface Props {
  puzzle: Puzzle;
  state: PuzzleState;
  update: (fn: (s: PuzzleState) => PuzzleState | null) => void;
  onBack: () => void;
  onOlder?: () => void;
  onNewer?: () => void;
}

const markClass = {
  def: "bg-amber-200/80 dark:bg-amber-500/30",
  ind: "bg-sky-200/80 dark:bg-sky-500/30",
  fil: "bg-emerald-200/80 dark:bg-emerald-500/30",
};

const hintMeta: { key: HintKey; label: string; dot: string }[] = [
  { key: "definition", label: "Definición", dot: "bg-amber-400" },
  { key: "indicator", label: "Indicador", dot: "bg-sky-400" },
  { key: "filler", label: "Relleno", dot: "bg-emerald-400" },
];

const btn =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm transition hover:bg-stone-50 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800";

export default function PuzzleDetail({ puzzle: p, state: st, update, onBack, onOlder, onNewer }: Props) {
  const [guess, setGuess] = useState("");
  const [wrong, setWrong] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const finished = st.solved || st.revealed;
  const totalLetters = normalize(p.solution).length;
  const show = {
    def: finished || st.hints.includes("definition"),
    ind: finished || st.hints.includes("indicator"),
    fil: finished || st.hints.includes("filler"),
  };

  useEffect(() => {
    if (!finished && window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const g = normalize(guess);
    if (!g || finished) return;
    const ok = g === normalize(p.solution);
    update((s) => ({ ...s, attempts: s.attempts + 1, solved: ok || s.solved }));
    if (ok) setWrong(null);
    else {
      setWrong(guess.trim().toUpperCase());
      const el = inputRef.current;
      if (el) {
        el.classList.remove("animate-shake");
        void el.offsetWidth; // reinicia la animación
        el.classList.add("animate-shake");
        el.select();
      }
    }
  };

  const revealHint = (k: HintKey) =>
    update((s) => (s.hints.includes(k) ? s : { ...s, hints: [...s.hints, k] }));

  return (
    <div className="flex min-h-full flex-col">
      {/* Barra superior en móvil */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-paper/90 px-2 py-2 backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-950/90">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-400">
          <span aria-hidden>‹</span> Lista
        </button>
        <span className="text-sm text-stone-500 first-letter:uppercase">{fmtLong(p.date)}</span>
        <span className="w-14" />
      </div>

      <article className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:px-8 md:py-10">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-8 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
            <span className="hidden md:inline-block first-letter:uppercase">{fmtLong(p.date)}</span>
            {p.author && <span>por {p.author}</span>}
            {p.tag && <span className="rounded-full bg-stone-100 px-2 text-xs dark:bg-stone-800">{p.tag}</span>}
          </div>

          <p className="mt-4 font-serif text-2xl leading-snug md:text-3xl">
            {clueSegments(p, show).map((s, i) =>
              s.kind ? (
                <mark key={i} className={`rounded px-0.5 text-inherit ${markClass[s.kind]}`}>
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              )
            )}
          </p>

          <p className="mt-2 font-mono text-stone-500 tracking-[0.25em]">
            {st.letters > 0 && !finished ? `${letterPattern(p.solution, st.letters)}  ` : ""}
            {lengthLabel(p.solution)}
          </p>

          {/* Respuesta */}
          <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              value={finished ? p.solution : guess}
              onChange={(e) => {
                setGuess(e.target.value);
                setWrong(null);
              }}
              disabled={finished}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Tu respuesta"
              aria-label="Tu respuesta"
              className={`min-w-0 flex-1 rounded-lg border bg-stone-50 px-4 py-3 text-lg uppercase tracking-widest outline-none focus:ring-2 dark:bg-stone-950 ${
                st.solved
                  ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                  : wrong
                    ? "border-rose-400 focus:ring-rose-500/20"
                    : "border-stone-300 focus:border-sky-600 focus:ring-sky-600/20 dark:border-stone-700"
              }`}
            />
            <button
              type="submit"
              disabled={finished || !guess.trim()}
              className="rounded-lg bg-sky-700 px-5 py-3 font-medium text-white transition hover:bg-sky-800 active:scale-[.98] disabled:opacity-40"
            >
              Comprobar
            </button>
          </form>

          <div className="mt-2 min-h-6 text-sm" aria-live="polite">
            {st.solved ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">¡Correcto! 🎉</span>
            ) : wrong ? (
              <span className="font-medium text-rose-700 dark:text-rose-400">“{wrong}” no es correcto. Sigue probando.</span>
            ) : null}
            {st.attempts > 0 && <span className="ml-2 text-stone-500">· {st.attempts} intento{st.attempts === 1 ? "" : "s"}</span>}
          </div>

          {/* Pistas */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {hintMeta.map(({ key, label, dot }) => (
              <button
                key={key}
                className={btn}
                disabled={!p.hints?.[key] || st.hints.includes(key)}
                onClick={() => revealHint(key)}
              >
                <span className={`mr-1.5 inline-block size-2 rounded-full ${dot}`} />
                {label}
              </button>
            ))}
            <button
              className={btn}
              disabled={finished || st.letters >= totalLetters - 1}
              onClick={() => update((s) => ({ ...s, letters: s.letters + 1 }))}
            >
              Revelar letra
            </button>
            <button
              className={`${btn} col-span-2 text-rose-700 dark:text-rose-400`}
              disabled={finished}
              onClick={() => confirm("¿Seguro que quieres ver la solución?") && update((s) => ({ ...s, revealed: true }))}
            >
              Ver solución
            </button>
          </div>

          {st.hints.length > 0 && (
            <ul className="mt-4 space-y-2 text-[0.95rem]">
              {hintMeta
                .filter(({ key }) => st.hints.includes(key) && p.hints?.[key])
                .map(({ key, dot }) => (
                  <li key={key} className="flex gap-2">
                    <span className={`mt-2 size-2 shrink-0 rounded-full ${dot}`} />
                    <span>{p.hints![key]}</span>
                  </li>
                ))}
            </ul>
          )}

          {finished && (
            <section className="mt-6 space-y-2 border-t border-stone-200 pt-5 dark:border-stone-800">
              <h2 className="text-lg font-semibold tracking-wider">
                Solución: <span className="text-sky-700 dark:text-sky-400">{p.solution}</span>
              </h2>
              {p.definition && (
                <p>
                  <strong>Definición:</strong> {p.definition}
                </p>
              )}
              {p.wordplay && (
                <p>
                  <strong>Juego de palabras:</strong> {p.wordplay}
                </p>
              )}
            </section>
          )}
        </div>

        <nav className="mt-6 flex items-center justify-between gap-2">
          <button className={btn} disabled={!onOlder} onClick={onOlder}>
            ← Anterior
          </button>
          <button
            className={`${btn} text-stone-500`}
            onClick={() => {
              update(() => null);
              setGuess("");
              setWrong(null);
            }}
          >
            Reiniciar
          </button>
          <button className={btn} disabled={!onNewer} onClick={onNewer}>
            Siguiente →
          </button>
        </nav>
      </article>
    </div>
  );
}
