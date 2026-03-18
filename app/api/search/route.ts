import { searchCorpus } from "@/lib/server/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const instrument = searchParams.get("instrument") ?? "";
  const type = searchParams.get("type") ?? "";
  const category = searchParams.get("category") ?? "";
  const term = searchParams.get("term") ?? "";
  const citation = searchParams.get("citation") ?? "";

  if (!query && !instrument && !type && !category && !term && !citation) {
    return Response.json([]);
  }

  const results = await searchCorpus({ category, citation, instrument, query, term, type });
  return Response.json(results);
}
