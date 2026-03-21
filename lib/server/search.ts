import { getAllInstrumentBundles } from "@/lib/server/data";
import {
  embedQuery,
  getClassificationIndex,
  getEmbeddingIndex,
  getSegmentThemes,
  semanticSearch,
} from "@/lib/server/semantic";
import { normalizeSearchText } from "@/lib/normalize";
import type { SearchResult } from "@/lib/types";

export type SearchFilters = {
  category?: string;
  citation?: string;
  instrument?: string;
  query?: string;
  term?: string;
  themes?: string[];
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

  // ── Theme filtering ─────────────────────────────────────────
  const classificationIndex = await getClassificationIndex();
  const themePassSet = new Set<string>(); // "slug:segmentId" keys that pass theme filter

  if (classificationIndex && filters.themes?.length) {
    for (const entry of classificationIndex.entries) {
      const segmentThemes = entry.themes
        .filter((t) => t.score >= 0.5)
        .map((t) => t.theme);
      const matches = filters.themes.some((theme) => segmentThemes.includes(theme));

      if (matches) {
        themePassSet.add(`${entry.instrumentSlug}:${entry.segmentId}`);
      }
    }
  }

  // ── Keyword scoring ─────────────────────────────────────────
  const keywordResults = new Map<string, SearchResult>();

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

      const key = `${record.instrumentSlug}:${record.segmentId}`;

      if (filters.themes?.length && !themePassSet.has(key)) {
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

      // Classify themes for this segment (for display, not filtering)
      let themes: string[] | undefined;

      if (classificationIndex) {
        themes = getSegmentThemes(classificationIndex, record.instrumentSlug, record.segmentId);

        if (themes.length === 0) {
          themes = undefined;
        }
      }

      keywordResults.set(key, {
        anchor: record.anchor,
        category: record.category,
        excerpt: record.excerpt,
        instrumentSlug: record.instrumentSlug,
        label: record.label,
        matchedCitations: Array.from(matchedCitations),
        matchedTerms: Array.from(matchedTerms),
        score,
        segmentId: record.segmentId,
        themes,
        type: record.type,
      });
    }
  }

  // ── Semantic scoring ────────────────────────────────────────
  if (tokens.length > 0) {
    const [embeddingIndex, queryVector] = await Promise.all([
      getEmbeddingIndex(),
      embedQuery(filters.query ?? ""),
    ]);

    if (embeddingIndex && queryVector) {
      const semanticHits = semanticSearch(queryVector, embeddingIndex.entries, 100);

      // Find the max keyword score for normalization
      let maxKeywordScore = 0;

      for (const result of keywordResults.values()) {
        if (result.score > maxKeywordScore) {
          maxKeywordScore = result.score;
        }
      }

      if (maxKeywordScore === 0) {
        maxKeywordScore = 1;
      }

      // Normalize ALL keyword scores to 0-1 range first
      for (const result of keywordResults.values()) {
        result.score = (result.score / maxKeywordScore) * 0.4;
      }

      // Blend semantic scores into results
      for (const hit of semanticHits) {
        const key = `${hit.instrumentSlug}:${hit.segmentId}`;

        if (filters.themes?.length && !themePassSet.has(key)) {
          continue;
        }

        const existing = keywordResults.get(key);

        if (existing) {
          existing.semanticScore = hit.score;
          existing.score = existing.score + hit.score * 0.6;
        } else {
          // Semantic-only result — find the record in bundles for metadata
          for (const bundle of bundles) {
            const record = bundle.searchRecords.find(
              (r) => r.segmentId === hit.segmentId && r.instrumentSlug === hit.instrumentSlug,
            );

            if (!record) {
              continue;
            }

            if (filters.instrument && record.instrumentSlug !== filters.instrument) {
              break;
            }

            if (filters.type && record.type !== filters.type) {
              break;
            }

            if (filters.category && record.category !== filters.category) {
              break;
            }

            let themes: string[] | undefined;

            if (classificationIndex) {
              themes = getSegmentThemes(classificationIndex, record.instrumentSlug, record.segmentId);

              if (themes.length === 0) {
                themes = undefined;
              }
            }

            keywordResults.set(key, {
              anchor: record.anchor,
              category: record.category,
              excerpt: record.excerpt,
              instrumentSlug: record.instrumentSlug,
              label: record.label,
              matchedCitations: [],
              matchedTerms: [],
              score: hit.score * 0.6,
              semanticScore: hit.score,
              segmentId: record.segmentId,
              themes,
              type: record.type,
            });

            break;
          }
        }
      }
    }
  }

  // ── Sort and return ─────────────────────────────────────────
  const results = Array.from(keywordResults.values()).filter((r) => r.score > 0);

  return results
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 60);
}
