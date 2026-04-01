const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

export const api = {
  getTests: () => request("/api/tests"),
  getTest: (id) => request(`/api/tests/${id}`),
  listPdfFiles: () => request("/api/tests/pdf-files"),
  parsePdfFromFolder: (filename) => request(`/api/tests/parse-pdf?filename=${encodeURIComponent(filename)}`),
  generateTest: (prompt) =>
    request("/api/tests/generate", {
      method: "POST",
      body: JSON.stringify({ prompt })
    }),
  importTest: (body) =>
    request("/api/tests/import", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  getSubmissions: (candidateName) =>
    request(candidateName ? `/api/tests/submissions?candidateName=${encodeURIComponent(candidateName)}` : "/api/tests/submissions"),
  submitTest: (id, body) =>
    request(`/api/tests/${id}/submissions`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  getSubmission: (id) => request(`/api/tests/submissions/${id}`)
};
