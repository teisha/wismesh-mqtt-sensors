export const apiBase = "/api";

export type AuthUser = {
  userId: number;
  username: string;
  role: string;
  authenticated: boolean;
};

export async function request<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const responseText = await response.text();
  let data: unknown = {};
  if (responseText) {
    try {
      data = JSON.parse(responseText) as unknown;
    } catch {
      data = { error: responseText.trim() };
    }
  }

  if (!response.ok) {
    const errData = data as { error?: string };
    const fallback = `Request failed (${response.status} ${response.statusText})`;
    throw new Error(errData.error || fallback);
  }

  return data as T;
}