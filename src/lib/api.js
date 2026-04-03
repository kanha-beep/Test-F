const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const TOKEN_KEY = "gest_auth_token";

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || error.detail || "Request failed");
  }

  return response.json();
}

function buildTestQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.examType) {
    const examValue = Array.isArray(filters.examType) ? filters.examType.join(",") : filters.examType;
    params.set("examType", examValue);
  }

  if (filters.pageType) {
    params.set("pageType", filters.pageType);
  }

  const query = params.toString();
  return query ? `/api/tests?${query}` : "/api/tests";
}

export const api = {
  register: (body) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/api/auth/me"),
  updatePreferences: (preferredExamTypes) =>
    request("/api/auth/preferences", { method: "PATCH", body: JSON.stringify({ preferredExamTypes }) }),
  listUsers: () => request("/api/auth/users"),
  getTests: (filters) => request(buildTestQuery(filters)),
  getTest: (id) => request(`/api/tests/${id}`),
  getRankings: (id) => request(`/api/tests/${id}/rankings`),
  deleteTest: (id) => request(`/api/tests/${id}`, { method: "DELETE" }),
  listPdfFiles: () => request("/api/tests/pdf-files"),
  parsePdfFromFolder: (filename) => request(`/api/tests/parse-pdf?filename=${encodeURIComponent(filename)}`),
  generateTest: (prompt, metadata = {}) =>
    request("/api/tests/generate", { method: "POST", body: JSON.stringify({ prompt, ...metadata }) }),
  importTest: (body) => request("/api/tests/import", { method: "POST", body: JSON.stringify(body) }),
  saveImportDraft: (body) => request("/api/drafts", { method: "POST", body: JSON.stringify(body) }),
  getLatestImportDraft: () => request("/api/drafts/latest"),
  getSubmissions: (candidateName) =>
    request(candidateName ? `/api/tests/submissions?candidateName=${encodeURIComponent(candidateName)}` : "/api/tests/submissions"),
  submitTest: (id, body) => request(`/api/tests/${id}/submissions`, { method: "POST", body: JSON.stringify(body) }),
  getSubmission: (id) => request(`/api/tests/submissions/${id}`)
};
