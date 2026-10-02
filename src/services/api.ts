const unavailableMessage = 'The café API is unavailable. For local development, restart with npm run dev; on the live site, check the Worker deployment.';

export async function readAPIResponse<T>(response: Response): Promise<T> {
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(unavailableMessage);
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(unavailableMessage);
  const data = result as { message?: string; success?: boolean };
  if (!response.ok || data.success === false) throw new Error(data.message || 'The request failed. Please try again.');
  return result as T;
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error(unavailableMessage);
  }
  return readAPIResponse<T>(response);
}
