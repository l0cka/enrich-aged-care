import type { EnrichedInstrumentBundle } from "@/lib/types";

export type ReaderVisibility = {
  showEndnotes: boolean;
  showFrontMatter: boolean;
};

export function getVisibleSegmentIds(
  bundle: EnrichedInstrumentBundle,
  visibility: ReaderVisibility,
): string[] {
  return bundle.orderedSegmentIds.filter((id) => {
    if (!visibility.showFrontMatter && bundle.frontMatterIds.includes(id)) {
      return false;
    }

    if (!visibility.showEndnotes && bundle.endnoteIds.includes(id)) {
      return false;
    }

    return true;
  });
}
