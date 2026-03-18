import { NextRequest, NextResponse } from "next/server";

import { getInstrumentBundle } from "@/lib/server/data";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.getAll("id");

  if (!ids.length) {
    return NextResponse.json({});
  }

  const slugs = [...new Set(ids.map((id) => id.split(":")[0]))];
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

  for (const id of ids) {
    const separatorIndex = id.indexOf(":");
    const slug = id.slice(0, separatorIndex);
    const segmentId = id.slice(separatorIndex + 1);
    const bundle = bundleBySlug[slug];

    if (!bundle) {
      continue;
    }

    const segment = bundle.segments[segmentId];

    if (!segment) {
      continue;
    }

    result[id] = {
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
