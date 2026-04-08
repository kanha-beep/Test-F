// Wrap backend API calls with axios and token-based authentication handling.

import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const TOKEN_KEY = "gest_auth_token";

// Handle the getStoredToken logic for this module.
export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// Handle the setStoredToken logic for this module.
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

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`
    };
  }

  return config;
});

// Send one API request through the shared axios client and normalize errors.
async function request(path, options = {}) {
  try {
    const response = await apiClient({
      url: path,
      ...options
    });

    return response.data;
  } catch (error) {
    const message = error?.response?.data?.message || error?.response?.data?.detail || error?.message || "Request failed";
    throw new Error(message);
  }
}

// Build the test-list query string from optional filtering values.
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
  register: (body) => request("/api/auth/register", { method: "POST", data: body }),
  login: (body) => request("/api/auth/login", { method: "POST", data: body }),
  me: () => request("/api/auth/me"),
  updatePreferences: (preferredExamTypes) => request("/api/auth/preferences", { method: "PATCH", data: { preferredExamTypes } }),
  listUsers: () => request("/api/auth/users"),
  getTests: (filters) => request(buildTestQuery(filters)),
  getTest: (id) => request(`/api/tests/${id}`),
  getRankings: (id) => request(`/api/tests/${id}/rankings`),
  deleteTest: (id) => request(`/api/tests/${id}`, { method: "DELETE" }),
  listPdfFiles: () => request("/api/tests/pdf-files"),
  parsePdfFromFolder: (filename) => request(`/api/tests/parse-pdf?filename=${encodeURIComponent(filename)}`),
  generateTest: (prompt, metadata = {}) => request("/api/tests/generate", { method: "POST", data: { prompt, ...metadata } }),
  importTest: (body) => request("/api/tests/import", { method: "POST", data: body }),
  saveImportDraft: (body) => request("/api/drafts", { method: "POST", data: body }),
  getLatestImportDraft: () => request("/api/drafts/latest"),
  getSubmissions: (candidateName) => request(candidateName ? `/api/tests/submissions?candidateName=${encodeURIComponent(candidateName)}` : "/api/tests/submissions"),
  submitTest: (id, body) => request(`/api/tests/${id}/submissions`, { method: "POST", data: body }),
  getSubmission: (id) => request(`/api/tests/submissions/${id}`)
};

