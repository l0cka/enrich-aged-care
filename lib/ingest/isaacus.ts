import Isaacus from "isaacus";

export async function enrichWithIsaacus(text: string): Promise<unknown | null> {
  const apiKey = process.env.ISAACUS_API_KEY;

  if (!apiKey) {
    return null;
  }

  const client = new Isaacus({ apiKey });
  const response = await client.enrichments.create({
    model: "kanon-2-enricher",
    overflow_strategy: "auto",
    texts: text,
  });

  return response.results[0]?.document ?? null;
}
