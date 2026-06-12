export type JsonResponse<T> = T & {
  error?: string;
};

export async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<JsonResponse<T>> {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return { error: fallbackError } as JsonResponse<T>;
  }

  try {
    return JSON.parse(responseText) as JsonResponse<T>;
  } catch {
    return { error: "Server returned an invalid JSON response." } as JsonResponse<T>;
  }
}
