import type { InstrumentManifestEntry } from "@/lib/types";

export const instrumentManifest: InstrumentManifestEntry[] = [
  {
    slug: "aged-care-act-2024",
    title: "Aged Care Act 2024",
    sourceFile: "Aged Care Act 2024.docx",
    instrumentType: "statute",
    compilationLabel: "Compilation No. 1 • 1 November 2025",
    citationAliases: ["Aged Care Act 2024"],
    referenceAliases: [
      {
        targetSlug: "aged-care-rules-2025",
        aliases: ["the rules", "Aged Care Rules 2025"],
      },
      {
        targetSlug: "aged-care-consequential-and-transitional-provisions-rules-2025",
        aliases: ["Aged Care (Consequential and Transitional Provisions) Rules 2025"],
      },
    ],
  },
  {
    slug: "aged-care-rules-2025",
    title: "Aged Care Rules 2025",
    sourceFile: "Aged Care Rules 2025.docx",
    instrumentType: "regulation",
    compilationLabel: "Compilation No. 2 • 3 February 2026",
    citationAliases: ["Aged Care Rules 2025"],
    referenceAliases: [
      {
        targetSlug: "aged-care-act-2024",
        aliases: ["the Act", "Aged Care Act 2024"],
      },
    ],
  },
  {
    slug: "aged-care-consequential-and-transitional-provisions-rules-2025",
    title: "Aged Care (Consequential and Transitional Provisions) Rules 2025",
    sourceFile: "Aged Care (Consequential and Transitional Provisions) Rules 2025.docx",
    instrumentType: "regulation",
    compilationLabel: "As made • 24 October 2025",
    citationAliases: ["Aged Care (Consequential and Transitional Provisions) Rules 2025"],
    referenceAliases: [
      {
        targetSlug: "aged-care-act-2024",
        aliases: ["new Act", "Aged Care Act 2024"],
      },
      {
        targetSlug: "aged-care-rules-2025",
        aliases: ["Aged Care Rules 2025"],
      },
    ],
  },
];

export const instrumentManifestBySlug = Object.fromEntries(
  instrumentManifest.map((entry) => [entry.slug, entry]),
) satisfies Record<string, InstrumentManifestEntry>;

export const instrumentColorBySlug = {
  "aged-care-act-2024": "var(--color-accent)",
  "aged-care-rules-2025": "#4da872",
  "aged-care-consequential-and-transitional-provisions-rules-2025": "#c4933a",
} as const satisfies Record<string, string>;

export function getInstrumentColor(slug: string): string {
  return instrumentColorBySlug[slug as keyof typeof instrumentColorBySlug] ?? "var(--color-muted)";
}

