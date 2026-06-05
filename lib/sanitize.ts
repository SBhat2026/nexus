// Paper titles from OpenAlex (and other sources) sometimes embed raw HTML markup
// such as <i>, <sub>, <sup>, <scp> — these render as literal text in the UI.
// Strip tags and decode the handful of entities that show up in titles so the
// stored value is clean plain text. Applied at ingestion so every future session
// is clean; a one-time migration handles already-stored rows.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function stripHtml(input: string | null | undefined): string {
  if (!input) return ''
  return input
    // Drop any HTML/XML tag, e.g. <i>, </sub>, <scp>, <mml:math …>
    .replace(/<\/?[a-z][^>]*>/gi, '')
    // Decode numeric entities (&#945; / &#x3b1;)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    // Decode the common named entities
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    // Collapse the whitespace a removed tag may have left behind
    .replace(/\s+/g, ' ')
    .trim()
}

function safeFromCodePoint(cp: number): string {
  try {
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : ''
  } catch {
    return ''
  }
}
