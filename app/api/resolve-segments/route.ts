import { NextRequest, NextResponse } from "next/server";

import { instrumentManifestBySlug } from "@/lib/instruments";
import { getInstrumentBundle } from "@/lib/server/data";

const MAX_SEGMENT_IDS = 100;
const MAX_ID_LENGTH = 240;

function parseSegmentId(rawId: string): { slug: string; segmentId: string } | null {
  if (!rawId || rawId.length > MAX_ID_LENGTH) {
    return null;
  }

  const separatorIndex = rawId.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === rawId.length - 1) {
    return null;
  }

  const slug = rawId.slice(0, separatorIndex);
  const segmentId = rawId.slice(separatorIndex + 1);

  if (!instrumentManifestBySlug[slug] || !segmentId.trim()) {
    return null;
  }

  return { slug, segmentId };
}

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.getAll("id");

  if (!ids.length) {
    return NextResponse.json({});
  }

  if (ids.length > MAX_SEGMENT_IDS) {
    return NextResponse.json(
      { error: `A maximum of ${MAX_SEGMENT_IDS} segment ids may be resolved at once.` },
      { status: 400 },
    );
  }

  const parsedIds = ids.map((id) => ({ rawId: id, parsed: parseSegmentId(id) }));
  const invalidId = parsedIds.find((entry) => !entry.parsed)?.rawId;

  if (invalidId) {
    return NextResponse.json(
      { error: `Invalid segment id: ${invalidId}` },
      { status: 400 },
    );
  }

  const validIds = parsedIds.map((entry) => ({ rawId: entry.rawId, ...entry.parsed! }));
  const slugs = [...new Set(validIds.map((id) => id.slug))];
  const bundles = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return { slug, bundle: await getInstrumentBundle(slug) };
      } catch {
        return null;
      }
    }),
  );

  const bundleBySlug = Object.fromEntries(
    bundles.filter(Boolean).map((entry) => [entry!.slug, entry!.bundle]),
  );

  const result: Record<string, {
    instrumentTitle: string;
    type: string | null;
    code: string | null;
    label: string;
    text: string;
    anchor: string;
  }> = {};

  for (const id of validIds) {
    const bundle = bundleBySlug[id.slug];

    if (!bundle) {
      continue;
    }

    const segment = bundle.segments[id.segmentId];

    if (!segment) {
      continue;
    }

    result[id.rawId] = {
      instrumentTitle: bundle.manifest.title,
      type: segment.type,
      code: segment.code,
      label: segment.label,
      text: segment.text,
      anchor: segment.anchor,
    };
  }

  return NextResponse.json(result);
}
