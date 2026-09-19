export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000)
    });
  } catch {
    throw new Error(method === 'GET' ? 'Unable to connect. Check your connection and try again.' : 'The request could not be confirmed. Check your connection and refresh before trying again.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || 'The service is temporarily unavailable. Please try again.');
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}
