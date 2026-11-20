export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:3000";

function headers(apiKey, extra = {}) {
  return { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...extra };
}

async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (err) {
    console.warn(`[Fluxera API] Network error on ${url}:`, err.message);
    return {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({
        error: "Backend service is unreachable. Ensure the backend server is running on port 3000, or explore in demo mode.",
        offline: true,
      }),
      text: async () => "Backend service is unreachable.",
    };
  }
}

export async function apiGet(path, apiKey) {
  return safeFetch(`${API_BASE}${path}`, { headers: headers(apiKey) });
}

export async function apiPatch(path, apiKey, body) {
  return safeFetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: headers(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify(body || {}),
  });
}

export async function apiPost(path, apiKey, body) {
  return safeFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify(body || {}),
  });
}

export function dashboardHeaders(session, extra = {}) {
  return {
    Authorization: `Bearer ${session?.dashboardToken || ""}`,
    "X-Fluxera-Workspace": session?.workspaceId || "",
    ...extra,
  };
}

export function dashboardGet(path, session) {
  return safeFetch(`${API_BASE}${path}`, { headers: dashboardHeaders(session) });
}

export function dashboardPost(path, session, body) {
  return safeFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: dashboardHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(body || {}),
  });
}

export function dashboardPatch(path, session, body) {
  return safeFetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: dashboardHeaders(session, { "Content-Type": "application/json" }),
    body: JSON.stringify(body || {}),
  });
}
