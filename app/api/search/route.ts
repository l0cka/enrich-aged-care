import { searchCorpus } from "@/lib/server/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const instrument = searchParams.get("instrument") ?? "";
  const type = searchParams.get("type") ?? "";
  const category = searchParams.get("category") ?? "";
  const term = searchParams.get("term") ?? "";
  const citation = searchParams.get("citation") ?? "";
  const themesParam = searchParams.get("themes") ?? "";
  const themes = themesParam ? themesParam.split(",").filter(Boolean) : undefined;

  if (!query && !instrument && !type && !category && !term && !citation && !themes?.length) {
    return Response.json([]);
  }

  const results = await searchCorpus({ category, citation, instrument, query, term, themes, type });
  return Response.json(results);
}
