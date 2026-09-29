export type Solution = {
  name: string;
  description: string;
  url: string;
  summary?: string;
};

export function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  const markdownLink = trimmed.match(/^\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/i);
  const url = markdownLink ? markdownLink[1] : trimmed;

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.href
      : "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function getSolutions(data: unknown): Solution[] {
  if (!isRecord(data)) return [];

  const result = data.result;
  if (!isRecord(result) || !Array.isArray(result.solutions)) return [];

  return result.solutions
    .filter(isRecord)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "",
      description: typeof item.description === "string" ? item.description : "",
      url: normalizeUrl(item.url),
      summary:
        typeof item.summary === "string" ? item.summary.trim().slice(0, 600) : "",
    }))
    .filter((solution) => solution.name || solution.description || solution.url);
}

export function getResultProblem(data: unknown): string | null {
  if (!isRecord(data) || !isRecord(data.result)) return null;
  const problem = data.result.problem;
  return typeof problem === "string" ? problem : null;
}
