export function normalizeForCommandSearch(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD") // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\u0E00-\u0E7F\s]/g, " ") // Support Thai range
    .replace(/\s+/g, " ")
    .trim();
}

export function getFuzzyScore(query: string, haystack: string): number | null {
  if (!query) return 0;
  if (!haystack) return null;

  if (haystack.includes(query)) {
    const index = haystack.indexOf(query);
    return 1200 - index * 3 - Math.abs(haystack.length - query.length);
  }

  let queryIndex = 0;
  let score = 0;
  let streak = 0;

  for (let i = 0; i < haystack.length && queryIndex < query.length; i++) {
    if (haystack[i] === query[queryIndex]) {
      score += streak > 0 ? 14 : 7;
      if (i === 0 || haystack[i - 1] === " ") {
        score += 4;
      }
      streak += 1;
      queryIndex += 1;
    } else {
      streak = 0;
    }
  }

  if (queryIndex !== query.length) return null;
  return score - Math.max(0, haystack.length - query.length) * 0.2;
}
