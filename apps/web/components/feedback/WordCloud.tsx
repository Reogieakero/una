"use client";

import { useMemo } from "react";
import { STOPWORDS } from "@/lib/sentiment";

export type FeedbackRowLite = {
  id: string;
  appointment_id: string;
  student_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Theme = { word: string; count: number };

/**
 * Word-frequency mining — extracted verbatim from page.tsx analysis memo.
 * Lowercases, strips non-alphanumerics, drops short words / STOPWORDS / pure digits.
 */
export function mineThemes(rows: Pick<FeedbackRowLite, "comment">[]): Theme[] {
  const freq = new Map<string, number>();
  for (const f of rows) {
    if (!f.comment) continue;
    for (const w of f.comment.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
      if (w.length < 4 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Comment themes — extracted verbatim from page.tsx.
 * Pass rows and let mining happen inside, or pass precomputed themes.
 */
export function WordCloud({
  loading,
  rows,
  themes: themesProp,
}: {
  loading: boolean;
  rows?: Pick<FeedbackRowLite, "comment">[];
  themes?: Theme[];
}) {
  const mined = useMemo(() => (themesProp ?? (rows ? mineThemes(rows) : [])), [themesProp, rows]);
  const themes = themesProp ?? mined;
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-ink">Comment themes</h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">Most-used words across written feedback.</p>
      {loading ? (
        <div className="animate-pulse pt-3" aria-hidden><div className="h-20 rounded-xl bg-ink/10" /></div>
      ) : themes.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {themes.map((t) => (
            <li
              key={t.word}
              className="rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-bold text-primary-700 ring-1 ring-blue-100"
            >
              {t.word} <span className="font-semibold text-primary-500">· {t.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No written comments yet.</p>
      )}
    </section>
  );
}
