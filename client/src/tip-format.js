// Pure formatter shared by the Tip tooltip: turns a multi-statement string
// into { intro, bullets } so provider schema descriptions render as an intro
// line plus a bulleted list. Returns null when the text should stay a plain
// paragraph (single statement, or explicit newline-separated lines which the
// caller already renders as a list).
//
// Rules:
// - Sentence splitting is abbreviation-aware (e.g. / i.e. / etc. / vs. …
//   never split), so "width*height (e.g. 1024*1024). Limits…" stays intact.
// - The first sentence becomes the intro; the rest become bullets.
// - Trailing "For example…", "such as…", "Note…" and leading or/and/but
//   fragments reattach to the previous bullet instead of dangling alone.
// - Comma-joined provider clauses ("…, HuggingFace URLs in the format …,
//   CivitAI URLs …") split into one bullet each, keeping their commas.
// - "in the format <…>" gains a colon, matching the house style.
const ABBR = /\b(e\.g|i\.e|etc|vs|approx|incl|fig|dr|mr|mrs|ms|st|no)\./gi;
const CLAUSE_SPLIT = /,(?=\s+(?:huggingface|civitai|replicate)\b)/i;
const CLAUSE_TEST = /,\s+(?:huggingface|civitai|replicate)\b/i;
const PH = '￾';

function splitClauses(sentence) {
  const parts = String(sentence).split(CLAUSE_SPLIT).map((c) => c.trim()).filter(Boolean);
  return parts.map((c, i) =>
    (i < parts.length - 1 && !/[,;:.!?…]$/.test(c) ? `${c},` : c)
      .replace(/in the format\s+(?!:)/i, 'in the format: '),
  );
}

export function autoBullets(raw) {
  const text = String(raw || '').trim();
  if (!text || text.includes('\n')) return null;
  const safe = text.replace(ABBR, (m) => m.replace(/\./g, PH));
  const sentences = safe
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replaceAll(PH, '.').trim())
    .filter(Boolean);
  if (sentences.length < 2) {
    if (!CLAUSE_TEST.test(text)) return null;
    return { intro: null, bullets: splitClauses(text) };
  }
  const [intro, ...rest] = sentences;
  const bullets = [];
  for (const s of rest) {
    if (/^(for example|e\.g\.|such as|note|or|and|but)\b/i.test(s) && bullets.length) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${s}`;
    } else {
      bullets.push(...splitClauses(s));
    }
  }
  if (!bullets.length) return null;
  return { intro, bullets };
}
