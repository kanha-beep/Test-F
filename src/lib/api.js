const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
  getTests: () => request("/tests"),
  getTest: (id) => request(`/tests/${id}`),
  listPdfFiles: () => request("/tests/pdf-files"),
  parsePdfFromFolder: (filename) => request(`/tests/parse-pdf?filename=${encodeURIComponent(filename)}`),
  generateTest: (prompt) =>
    request("/tests/generate", {
      method: "POST",
      body: JSON.stringify({ prompt })
    }),
  importTest: (body) =>
    request("/tests/import", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  getSubmissions: (candidateName) =>
    request(candidateName ? `/tests/submissions?candidateName=${encodeURIComponent(candidateName)}` : "/tests/submissions"),
  submitTest: (id, body) =>
    request(`/tests/${id}/submissions`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  getSubmission: (id) => request(`/tests/submissions/${id}`)
};
