export type HintKey = "definition" | "indicator" | "filler";

export interface Puzzle {
  date: string;
  clue: string;
  solution: string;
  author?: string | null;
  definitionText?: string | null;
  indicatorText?: string | null;
  fillerText?: string | null;
  hints?: Partial<Record<HintKey, string>> | null;
  definition?: string | null;
  wordplay?: string | null;
  tag?: string | null;
}

export interface CripticosData {
  source?: string;
  year?: number;
  generatedAt?: string;
  count?: number;
  puzzles: Puzzle[];
}

export interface PuzzleState {
  attempts: number;
  solved: boolean;
  revealed: boolean;
  hints: HintKey[];
  letters: number;
  lastWrong?: string;
}
