import { NextResponse } from "next/server";

import { searchCorpus } from "@/lib/server/search";

const MAX_QUERY_LENGTH = 500;
const MAX_FILTER_LENGTH = 120;
const MAX_THEME_COUNT = 8;

function readBoundedParam(value: string | null, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = readBoundedParam(searchParams.get("q"), MAX_QUERY_LENGTH);
  const instrument = readBoundedParam(searchParams.get("instrument"), MAX_FILTER_LENGTH);
  const type = readBoundedParam(searchParams.get("type"), MAX_FILTER_LENGTH);
  const category = readBoundedParam(searchParams.get("category"), MAX_FILTER_LENGTH);
  const term = readBoundedParam(searchParams.get("term"), MAX_FILTER_LENGTH);
  const citation = readBoundedParam(searchParams.get("citation"), MAX_FILTER_LENGTH);
  const rawThemes = readBoundedParam(searchParams.get("themes"), MAX_QUERY_LENGTH);
  const themes = rawThemes
    ? rawThemes
      .split(",")
      .map((theme) => theme.trim())
      .filter(Boolean)
      .slice(0, MAX_THEME_COUNT)
    : undefined;

  if (!query && !instrument && !type && !category && !term && !citation && !themes?.length) {
    return NextResponse.json([]);
  }

  const results = await searchCorpus({ category, citation, instrument, query, term, themes, type });
  return NextResponse.json(results);
}
