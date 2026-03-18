import { getAllInstrumentBundles } from "@/lib/server/data";
import { normalizeSearchText } from "@/lib/normalize";
import type { SearchResult } from "@/lib/types";

export type SearchFilters = {
  category?: string;
  citation?: string;
  instrument?: string;
  query?: string;
  term?: string;
  type?: string;
};

function countTokenHits(haystack: string, token: string): number {
  if (!token) {
    return 0;
  }

  const matcher = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  return Array.from(haystack.matchAll(matcher)).length;
}

export async function searchCorpus(filters: SearchFilters): Promise<SearchResult[]> {
  const bundles = await getAllInstrumentBundles();
  const query = normalizeSearchText(filters.query ?? "");
  const tokens = query.split(" ").filter(Boolean);
  const results: SearchResult[] = [];

  for (const bundle of bundles) {
    for (const record of bundle.searchRecords) {
      if (filters.instrument && record.instrumentSlug !== filters.instrument) {
        continue;
      }

      if (filters.type && record.type !== filters.type) {
        continue;
      }

      if (filters.category && record.category !== filters.category) {
        continue;
      }

      if (filters.term && !record.termLabels.includes(filters.term)) {
        continue;
      }

      if (filters.citation && !record.citationLabels.includes(filters.citation)) {
        continue;
      }

      let score = 0;
      const matchedTerms = new Set<string>();
      const matchedCitations = new Set<string>();
      const normalizedLabel = normalizeSearchText(record.label);
      const normalizedTitle = normalizeSearchText(record.title ?? "");
      const normalizedCode = normalizeSearchText(record.code ?? "");

      if (!tokens.length) {
        score = 1;
      }

      for (const token of tokens) {
        if (normalizedCode === token) {
          score += 50;
        } else if (normalizedCode.includes(token)) {
          score += 22;
        }

        if (normalizedLabel === query) {
          score += 40;
        } else if (normalizedLabel.includes(token)) {
          score += 20;
        }

        if (normalizedTitle.includes(token)) {
          score += 15;
        }

        for (const termLabel of record.termLabels) {
          if (normalizeSearchText(termLabel).includes(token)) {
            score += 12;
            matchedTerms.add(termLabel);
          }
        }

        for (const citationLabel of record.citationLabels) {
          if (normalizeSearchText(citationLabel).includes(token)) {
            score += 10;
            matchedCitations.add(citationLabel);
          }
        }

        score += countTokenHits(record.searchText, token) * 3;
      }

      if (score <= 0) {
        continue;
      }

      results.push({
        anchor: record.anchor,
        category: record.category,
        excerpt: record.excerpt,
        instrumentSlug: record.instrumentSlug,
        label: record.label,
        matchedCitations: Array.from(matchedCitations),
        matchedTerms: Array.from(matchedTerms),
        score,
        segmentId: record.segmentId,
        type: record.type,
      });
    }
  }

  return results
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 60);
}
