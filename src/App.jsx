// Hold the top-level client state and connect the landing, runner, and results flows.

import { useEffect, useMemo, useRef, useState } from "react";
import { ResultsView } from "./components/ResultsView.jsx";
import { TestLanding } from "./components/TestLanding.jsx";
import { TestRunner } from "./components/TestRunner.jsx";
import { EXAM_TYPES } from "./lib/examData.js";
import { api, getStoredToken, setStoredToken } from "./lib/api.js";
import { parsePdfQuestions } from "./lib/pdfParser.js";

// Keep the local-storage key centralized so every draft read and write stays in sync.
const DRAFT_LOCAL_KEY = "gest_import_draft_backup";

// Normalize imported questions into one reliable structure before the UI uses them.
// Handle the normalizeQuestion logic for this module.
function normalizeQuestion(question, index, fallbackSubject = "General") {
  // Always keep the option order fixed for the runner and editor.
  const keys = ["A", "B", "C", "D"];
  // Build a keyed lookup so missing or shuffled option arrays can be normalized safely.
  const optionMap = new Map((question.options || []).map((option) => [String(option.key).toUpperCase(), option]));

  return {
    id: question.id || `draft-${index + 1}`,
    number: question.number || index + 1,
    prompt: question.prompt || "",
    subject: question.subject || fallbackSubject,
    difficulty: question.difficulty || "Mixed",
    correctOption: (question.correctOption || "").toUpperCase(),
    parserNotes: question.parserNotes || [],
    explanation: question.explanation || "",
    options: keys.map((key) => {
      const raw = optionMap.get(key);
      const text = typeof raw === "string" ? raw : raw?.text || "";
      const explanation = typeof raw === "object" && raw ? raw.explanation || "" : "";
      return { key, text, explanation };
    })
  };
}

// Collect the whole default app state in one place so resets stay predictable.
const initialState = {
  tests: [],
  submissions: [],
  adminUsers: [],
  loading: true,
  error: "",
  candidateName: "",
  authUser: null,
  authChecking: true,
  generationPrompt: "Prepare a 10-question UPSC-style mixed difficulty test with clear explanations and practical exam framing.",
  selectedExamTypes: [],
  activeExamType: EXAM_TYPES[0],
  selectedPageType: "full-test",
  selectedSectionName: "",
  syllabusTagsInput: "",
  generating: false,
  parsing: false,
  savingImport: false,
  savingDraft: false,
  draftStatus: "",
  importedDraft: null,
  durationMinutes: 30,
  activeTest: null,
  currentIndex: 0,
  answers: {},
  timeLeft: 0,
  submission: null,
  resultFilter: "all",
  rankings: [],
  rankingsTest: null,
  rankingsLoading: false
};

// Merge one answer update into the existing answer map without mutating state.
// Handle the buildAnswerState logic for this module.
function buildAnswerState(previous, questionId, nextAnswer) {
  return {
    ...previous,
    [questionId]: {
      ...(previous[questionId] || {}),
      ...nextAnswer
    }
  };
}

// Remove blanks and duplicates from exam selection while guaranteeing a fallback exam.
// Handle the normalizeExamSelection logic for this module.
function normalizeExamSelection(exams = []) {
  const unique = [...new Set((exams || []).map((item) => String(item || "").trim()).filter(Boolean))];
  return unique.length ? unique : [EXAM_TYPES[0]];
}

// Keep stored user preferences distinct from UI fallbacks so users are not forced into SSC.
function sanitizeExamSelection(exams = []) {
  return [...new Set((exams || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

// Convert the current exam and page selection into reusable backend metadata.
// Handle the buildMetadataFromState logic for this module.
function buildMetadataFromState(state) {
  return {
    examType: state.activeExamType,
    pageType: state.selectedPageType,
    sectionName: state.selectedPageType === "sectional" ? state.selectedSectionName.trim() : "",
    syllabusTags: state.syllabusTagsInput.split(",").map((tag) => tag.trim()).filter(Boolean)
  };
}

// Run the top-level client application and coordinate all major screens.
export default function App() {
  // Store all cross-page application state in one object.
  const [state, setState] = useState(initialState);
  // Keep the timer id available for cleanup whenever the active test changes.
  const timerRef = useRef(null);
  // Keep a live reference to state so async callbacks can always read the latest values.
  const stateRef = useRef(state);

  // Refresh the mutable state reference every time React state changes.

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load tests, submissions, and admin-only data for the current dashboard context.
  const loadDashboardData = async (candidateName = "", options = {}) => {
    const { silent = false } = options;
    const token = getStoredToken();
    const nameQuery = token ? "" : candidateName.trim();

    try {
      const testsPromise = api.getTests();
      const submissionsPromise = token || nameQuery ? api.getSubmissions(nameQuery) : Promise.resolve([]);
      const [tests, submissions] = await Promise.all([testsPromise, submissionsPromise]);

      let adminUsers = [];
      if (stateRef.current.authUser?.role === "admin") {
        try {
          adminUsers = await api.listUsers();
        } catch {
          adminUsers = [];
        }
      }

      setState((previous) => ({ ...previous, tests, submissions, adminUsers, loading: false }));
    } catch (error) {
      if (silent) {
        setState((previous) => ({ ...previous, tests: [], submissions: [], adminUsers: [], loading: false }));
        return;
      }

      throw error;
    }
  };

  // Rebuild a saved draft payload into the richer client-side draft format.
  const restoreDraftPayload = (payload) => {
    if (!payload?.questions?.length) {
      return null;
    }
    const fallbackSubject = payload.sectionName || payload.examType || "General";
    return {
      title: payload.title || "",
      description: payload.description || "",
      sourceFileName: payload.sourceFileName || "",
      questions: payload.questions.map((question, index) => normalizeQuestion(question, index, fallbackSubject)),
      confirmedIds: new Set(payload.confirmedIds || []),
      warnings: payload.warnings || []
    };
  };

  // Save the current imported draft locally and remotely when a user is logged in.
  const persistImportDraft = async (draft, durationMinutesValue) => {
    const metadata = buildMetadataFromState(stateRef.current);
    const payload = {
      title: draft.title,
      description: draft.description,
      sourceFileName: draft.sourceFileName || "",
      durationMinutes: Number(durationMinutesValue) || 30,
      ...metadata,
      questions: draft.questions,
      confirmedIds: [...draft.confirmedIds],
      warnings: draft.warnings || []
    };
    let savedLocal = false;
    let savedRemote = false;
    let lastError = null;
    try {
      localStorage.setItem(DRAFT_LOCAL_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
      savedLocal = true;
    } catch (error) {
      lastError = error;
    }
    if (getStoredToken()) {
      try {
        await api.saveImportDraft(payload);
        savedRemote = true;
      } catch (error) {
        lastError = error;
      }
    }
    if (!savedLocal && !savedRemote) {
      throw new Error(lastError?.message || "Unable to save draft");
    }
    return { savedLocal, savedRemote };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getStoredToken();
      if (token) {
        try {
          const { user } = await api.me();
          if (!cancelled && user) {
            const preferred = sanitizeExamSelection(user.preferredExamTypes);
            setState((previous) => ({
              ...previous,
              authUser: user,
              candidateName: user.displayName || previous.candidateName,
              selectedExamTypes: preferred,
              activeExamType: preferred[0] || previous.activeExamType || EXAM_TYPES[0] || previous.activeExamType || EXAM_TYPES[0]
            }));
            try {
              const { draft } = await api.getLatestImportDraft();
              if (!cancelled && draft?.questions?.length) {
                const restored = restoreDraftPayload(draft);
                if (restored) {
                  setState((previous) => ({
                    ...previous,
                    importedDraft: restored,
                    durationMinutes: draft.durationMinutes || previous.durationMinutes,
                    activeExamType: draft.examType || previous.activeExamType,
                    selectedPageType: draft.pageType || previous.selectedPageType,
                    selectedSectionName: draft.sectionName || previous.selectedSectionName,
                    syllabusTagsInput: Array.isArray(draft.syllabusTags) ? draft.syllabusTags.join(", ") : previous.syllabusTagsInput
                  }));
                }
              }
            } catch {
              /* ignore */
            }
          }
        } catch {
          setStoredToken(null);
          if (!cancelled) {
            setState((previous) => ({ ...previous, authUser: null }));
          }
        }
      }

      if (!cancelled) {
        setState((previous) => ({ ...previous, authChecking: false }));
      }

      if (!cancelled && !getStoredToken()) {
        try {
          const raw = localStorage.getItem(DRAFT_LOCAL_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const restored = restoreDraftPayload(parsed);
            if (restored) {
              setState((previous) => ({
                ...previous,
                importedDraft: restored,
                durationMinutes: parsed.durationMinutes || previous.durationMinutes,
                activeExamType: parsed.examType || previous.activeExamType,
                selectedPageType: parsed.pageType || previous.selectedPageType,
                selectedSectionName: parsed.sectionName || previous.selectedSectionName,
                syllabusTagsInput: Array.isArray(parsed.syllabusTags) ? parsed.syllabusTags.join(", ") : previous.syllabusTagsInput
              }));
            }
          }
        } catch {
          /* ignore */
        }
      }

      try {
        await loadDashboardData(stateRef.current.candidateName, { silent: true });
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({ ...previous, loading: false, error: error.message || "Unable to load dashboard" }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.activeTest || state.submission) {
      window.clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = window.setInterval(() => {
      setState((previous) => previous.timeLeft <= 1 ? { ...previous, timeLeft: 0 } : { ...previous, timeLeft: previous.timeLeft - 1 });
    }, 1000);
    return () => window.clearInterval(timerRef.current);
  }, [state.activeTest, state.submission]);

  useEffect(() => {
    if (state.activeTest && !state.submission && state.timeLeft === 0) {
      submitTest();
    }
  }, [state.activeTest, state.submission, state.timeLeft]);

  const draftStats = useMemo(() => {
    const questions = state.importedDraft?.questions || [];
    const confirmedIds = state.importedDraft?.confirmedIds || new Set();
    const confirmed = [...confirmedIds].filter((id) => questions.some((q) => q.id === id)).length;
    return {
      total: questions.length,
      confirmed,
      missingAnswers: questions.filter((q) => confirmedIds.has(q.id) && !q.correctOption).length
    };
  }, [state.importedDraft]);

  const startTest = async (testId) => {
    try {
      const test = await api.getTest(testId);
      setState((previous) => ({ ...previous, activeTest: test, currentIndex: 0, answers: {}, timeLeft: test.durationMinutes * 60, submission: null, resultFilter: "all", error: "" }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to start test" }));
    }
  };

  const loadRankings = async (testId) => {
    try {
      setState((previous) => ({ ...previous, rankingsLoading: true, error: "" }));
      const response = await api.getRankings(testId);
      setState((previous) => ({ ...previous, rankingsLoading: false, rankings: response.rankings, rankingsTest: response.test }));
    } catch (error) {
      setState((previous) => ({ ...previous, rankingsLoading: false, error: error.message || "Unable to load rankings" }));
    }
  };

  const deleteTest = async (testId) => {
    try {
      await api.deleteTest(testId);
      await loadDashboardData(stateRef.current.candidateName);
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to delete test" }));
    }
  };

  const savePreferences = async (preferredExamTypes) => {
    const normalized = sanitizeExamSelection(preferredExamTypes);
    if (!normalized.length) {
      setState((previous) => ({ ...previous, error: "Select at least one paper category before continuing." }));
      return;
    }
    setState((previous) => ({ ...previous, selectedExamTypes: normalized, activeExamType: normalized[0] }));
    if (!stateRef.current.authUser) {
      return;
    }
    try {
      const { user } = await api.updatePreferences(normalized);
      const savedPreferences = sanitizeExamSelection(user.preferredExamTypes);
      setState((previous) => ({
        ...previous,
        authUser: user,
        selectedExamTypes: savedPreferences,
        activeExamType: savedPreferences[0] || previous.activeExamType || EXAM_TYPES[0]
      }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to save preferences" }));
    }
  };

  const generateTest = async () => {
    const prompt = state.generationPrompt.trim();
    if (!prompt) {
      setState((previous) => ({ ...previous, error: "Enter a prompt to generate a test" }));
      return;
    }
    try {
      setState((previous) => ({ ...previous, generating: true, error: "" }));
      const createdTest = await api.generateTest(prompt, buildMetadataFromState(stateRef.current));
      await loadDashboardData(stateRef.current.candidateName);
      setState((previous) => ({ ...previous, generating: false }));
      await startTest(createdTest._id);
    } catch (error) {
      setState((previous) => ({ ...previous, generating: false, error: error.message || "Unable to generate test" }));
    }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setState((previous) => ({ ...previous, parsing: true, error: "", importedDraft: null }));
      const parsed = await parsePdfQuestions(file);
      const fallbackSubject = stateRef.current.selectedPageType === "sectional" ? stateRef.current.selectedSectionName.trim() || stateRef.current.activeExamType : stateRef.current.activeExamType;
      setState((previous) => ({
        ...previous,
        parsing: false,
        importedDraft: {
          title: parsed.title,
          description: `Imported from ${file.name}`,
          sourceFileName: file.name,
          questions: parsed.questions.map((question, index) => normalizeQuestion(question, index, fallbackSubject)),
          confirmedIds: new Set(),
          warnings: parsed.warnings
        }
      }));
    } catch (error) {
      setState((previous) => ({ ...previous, parsing: false, error: error.message || "Unable to parse this PDF" }));
    }
    event.target.value = "";
  };

  const updateImportedDraft = (changes) => setState((previous) => ({ ...previous, draftStatus: "", importedDraft: previous.importedDraft ? { ...previous.importedDraft, ...changes } : previous.importedDraft }));
  const addQuestionToList = (questionId) => setState((previous) => {
    if (!previous.importedDraft) return previous;
    const next = new Set(previous.importedDraft.confirmedIds);
    next.add(questionId);
    return { ...previous, draftStatus: "", importedDraft: { ...previous.importedDraft, confirmedIds: next } };
  });
  const removeQuestionFromList = (questionId) => setState((previous) => {
    if (!previous.importedDraft) return previous;
    const next = new Set(previous.importedDraft.confirmedIds);
    next.delete(questionId);
    return { ...previous, draftStatus: "", importedDraft: { ...previous.importedDraft, confirmedIds: next } };
  });
  const addImportedQuestion = () => setState((previous) => {
    if (!previous.importedDraft) return previous;
    const questions = previous.importedDraft.questions;
    const nextNumber = questions.length > 0 ? Math.max(...questions.map((q) => q.number)) + 1 : 1;
    const fallbackSubject = previous.selectedPageType === "sectional" ? previous.selectedSectionName.trim() || previous.activeExamType : previous.activeExamType;
    const newQuestion = { id: `draft-new-${Date.now()}`, number: nextNumber, prompt: "", subject: fallbackSubject, difficulty: "Mixed", correctOption: "", parserNotes: [], explanation: "", options: ["A", "B", "C", "D"].map((key) => ({ key, text: "", explanation: "" })) };
    return { ...previous, draftStatus: "", importedDraft: { ...previous.importedDraft, questions: [...questions, newQuestion] } };
  });
  const removeImportedQuestion = (questionId) => setState((previous) => {
    if (!previous.importedDraft) return previous;
    const nextConfirmed = new Set(previous.importedDraft.confirmedIds);
    nextConfirmed.delete(questionId);
    return { ...previous, draftStatus: "", importedDraft: { ...previous.importedDraft, confirmedIds: nextConfirmed, questions: previous.importedDraft.questions.filter((q) => q.id !== questionId) } };
  });
  const updateImportedQuestion = (questionId, updater) => setState((previous) => {
    if (!previous.importedDraft) return previous;
    return { ...previous, draftStatus: "", importedDraft: { ...previous.importedDraft, questions: previous.importedDraft.questions.map((question) => question.id === questionId ? updater(question) : question) } };
  });

  const buildQuestionsForImport = (questions) => questions.map((q) => ({ id: q.id, number: q.number, prompt: q.prompt, subject: q.subject, difficulty: q.difficulty, correctOption: q.correctOption, explanation: q.explanation || "", options: q.options.map((o) => ({ key: o.key, text: o.text, explanation: o.explanation || "" })) }));

  const saveImportedTest = async () => {
    const draft = state.importedDraft;
    const confirmedQuestions = [...(draft?.confirmedIds || [])].map((id) => draft?.questions.find((q) => q.id === id)).filter(Boolean);
    if (!draft || !draft.title.trim() || confirmedQuestions.length === 0) {
      setState((previous) => ({ ...previous, error: "Add at least one question to the list before saving." }));
      return;
    }
    if (confirmedQuestions.some((q) => !q.correctOption || q.options.some((o) => !o.text.trim()))) {
      setState((previous) => ({ ...previous, error: "All added questions must have 4 options and a correct answer set." }));
      return;
    }
    try {
      setState((previous) => ({ ...previous, savingImport: true, error: "" }));
      const createdTest = await api.importTest({ title: draft.title, description: draft.description, durationMinutes: Number(state.durationMinutes) || 30, ...buildMetadataFromState(stateRef.current), questions: buildQuestionsForImport(confirmedQuestions) });
      await loadDashboardData(stateRef.current.candidateName);
      try { localStorage.removeItem(DRAFT_LOCAL_KEY); } catch {}
      setState((previous) => ({ ...previous, savingImport: false, importedDraft: null }));
      await startTest(createdTest._id);
    } catch (error) {
      await persistImportDraft(draft, state.durationMinutes);
      setState((previous) => ({ ...previous, savingImport: false, error: `${error.message || "Unable to save imported test"} - your edits were saved as a draft (local storage${getStoredToken() ? " and account" : ""}).` }));
    }
  };

  const saveImportDraftManually = async () => {
    const draft = state.importedDraft;
    if (!draft) return;
    try {
      setState((previous) => ({ ...previous, savingDraft: true, error: "", draftStatus: "" }));
      const result = await persistImportDraft(draft, state.durationMinutes);
      setState((previous) => ({
        ...previous,
        draftStatus: result.savedRemote ? "Draft saved to your device and account." : "Draft saved to this device."
      }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to save draft", draftStatus: "" }));
    } finally {
      setState((previous) => ({ ...previous, savingDraft: false }));
    }
  };

  const register = async ({ email, password, displayName, preferredExamTypes }) => {
    try {
      setState((previous) => ({ ...previous, error: "" }));
      const normalized = sanitizeExamSelection(preferredExamTypes?.length ? preferredExamTypes : stateRef.current.selectedExamTypes);
      const { token, user } = await api.register({ email, password, displayName, preferredExamTypes: normalized });
      setStoredToken(token);
      const savedPreferences = sanitizeExamSelection(user.preferredExamTypes);
      setState((previous) => ({
        ...previous,
        authUser: user,
        candidateName: user.displayName || previous.candidateName,
        selectedExamTypes: savedPreferences,
        activeExamType: savedPreferences[0] || previous.activeExamType || EXAM_TYPES[0]
      }));
      await loadDashboardData("");
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Registration failed" }));
    }
  };

  const login = async ({ email, password }) => {
    try {
      setState((previous) => ({ ...previous, error: "" }));
      const { token, user } = await api.login({ email, password });
      setStoredToken(token);
      const preferred = sanitizeExamSelection(user.preferredExamTypes);
      setState((previous) => ({
        ...previous,
        authUser: user,
        candidateName: user.displayName || previous.candidateName,
        selectedExamTypes: preferred,
        activeExamType: preferred[0] || previous.activeExamType || EXAM_TYPES[0]
      }));
      await loadDashboardData("");
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Login failed" }));
    }
  };

  const logout = () => {
    setStoredToken(null);
    const name = stateRef.current.candidateName;
    setState((previous) => ({ ...previous, authUser: null, adminUsers: [] }));
    loadDashboardData(name).catch(() => {});
  };

  const selectOption = (questionId, optionKey) => setState((previous) => {
    const existing = previous.answers[questionId];
    const nextStatus = existing?.status === "review" || existing?.status === "review_answered" ? "review_answered" : "answered";
    return { ...previous, answers: buildAnswerState(previous.answers, questionId, { selectedOption: optionKey, status: nextStatus }) };
  });
  const skipQuestion = (questionId) => setState((previous) => ({ ...previous, answers: buildAnswerState(previous.answers, questionId, { selectedOption: null, status: "skipped" }) }));
  const clearResponse = (questionId) => setState((previous) => {
    const existing = previous.answers[questionId];
    const nextStatus = existing?.status === "review_answered" || existing?.status === "review" ? "review" : "skipped";
    return { ...previous, answers: buildAnswerState(previous.answers, questionId, { selectedOption: null, status: nextStatus }) };
  });
  const markForReview = (questionId) => setState((previous) => {
    const existing = previous.answers[questionId];
    return { ...previous, answers: buildAnswerState(previous.answers, questionId, { selectedOption: existing?.selectedOption || null, status: existing?.selectedOption ? "review_answered" : "review" }) };
  });

  const submitTest = async () => {
    const currentState = stateRef.current;
    if (!currentState.activeTest) return;
    try {
      const payload = { candidateName: currentState.candidateName, answers: currentState.activeTest.questions.map((question) => {
        const answer = currentState.answers[question._id];
        return { questionId: question._id, selectedOption: answer?.selectedOption || null, status: answer?.status || "skipped" };
      }) };
      const submissionResponse = await api.submitTest(currentState.activeTest._id, payload);
      const [submission, submissions, rankingResponse] = await Promise.all([
        api.getSubmission(submissionResponse.submissionId),
        api.getSubmissions(currentState.candidateName),
        api.getRankings(currentState.activeTest._id)
      ]);
      setState((previous) => ({ ...previous, submission, submissions, rankings: rankingResponse.rankings, rankingsTest: rankingResponse.test, resultFilter: "all" }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to submit test" }));
    }
  };

  const resetToLanding = async () => {
    window.clearInterval(timerRef.current);
    setState((previous) => ({ ...previous, activeTest: null, currentIndex: 0, answers: {}, timeLeft: 0, submission: null, resultFilter: "all" }));
    try {
      await loadDashboardData(stateRef.current.candidateName);
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to refresh dashboard" }));
    }
  };

  return (
    <main className="relative min-h-screen max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.22),transparent_24%),linear-gradient(145deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute right-[-5rem] top-[-7rem] h-80 w-80 rounded-full bg-slate-900/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-4rem] h-96 w-96 rounded-full bg-slate-500/10 blur-3xl" />
      {state.error ? <div className="fixed right-4 top-4 z-50 rounded-2xl border border-red-700/15 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">{state.error}</div> : null}
      {!state.activeTest ? <TestLanding tests={state.tests} submissions={state.submissions} adminUsers={state.adminUsers} loading={state.loading} authChecking={state.authChecking} authUser={state.authUser} candidateName={state.candidateName} generationPrompt={state.generationPrompt} selectedExamTypes={state.selectedExamTypes} activeExamType={state.activeExamType} selectedPageType={state.selectedPageType} selectedSectionName={state.selectedSectionName} syllabusTagsInput={state.syllabusTagsInput} generating={state.generating} parsing={state.parsing} savingImport={state.savingImport} savingDraft={state.savingDraft} draftStatus={state.draftStatus} importedDraft={state.importedDraft} durationMinutes={state.durationMinutes} draftStats={draftStats} rankings={state.rankings} rankingsTest={state.rankingsTest} rankingsLoading={state.rankingsLoading} onRegister={register} onLogin={login} onLogout={logout} onSavePreferences={savePreferences} onNameChange={(candidateName) => setState((previous) => ({ ...previous, candidateName }))} onPromptChange={(generationPrompt) => setState((previous) => ({ ...previous, generationPrompt }))} onExamTypesChange={(selectedExamTypes) => setState((previous) => ({ ...previous, selectedExamTypes: sanitizeExamSelection(selectedExamTypes) }))} onActiveExamTypeChange={(activeExamType) => setState((previous) => ({ ...previous, activeExamType }))} onPageTypeChange={(selectedPageType) => setState((previous) => ({ ...previous, draftStatus: "", selectedPageType, selectedSectionName: selectedPageType === "sectional" ? previous.selectedSectionName : "" }))} onSectionNameChange={(selectedSectionName) => setState((previous) => ({ ...previous, draftStatus: "", selectedSectionName }))} onSyllabusTagsChange={(syllabusTagsInput) => setState((previous) => ({ ...previous, draftStatus: "", syllabusTagsInput }))} onDurationChange={(durationMinutes) => setState((previous) => ({ ...previous, draftStatus: "", durationMinutes }))} onGenerate={generateTest} onPdfUpload={handlePdfUpload} onImportedDraftChange={updateImportedDraft} onImportedQuestionChange={updateImportedQuestion} onAddToList={addQuestionToList} onRemoveFromList={removeQuestionFromList} onRemoveQuestion={removeImportedQuestion} onAddQuestion={addImportedQuestion} onSaveImportedTest={saveImportedTest} onSaveImportDraft={saveImportDraftManually} onStart={startTest} onLoadRankings={loadRankings} onDeleteTest={deleteTest} onRefreshDashboard={() => loadDashboardData(state.candidateName, { silent: false })} /> : null}
      {state.activeTest && !state.submission ? <TestRunner test={state.activeTest} candidateName={state.candidateName} currentIndex={state.currentIndex} answers={state.answers} timeLeft={state.timeLeft} onSelectQuestion={(currentIndex) => setState((previous) => ({ ...previous, currentIndex }))} onSelectOption={selectOption} onSkip={skipQuestion} onMarkForReview={markForReview} onClearResponse={clearResponse} onSubmit={submitTest} /> : null}
      {state.submission ? <ResultsView submission={state.submission} activeFilter={state.resultFilter} onFilterChange={(resultFilter) => setState((previous) => ({ ...previous, resultFilter }))} onRetake={resetToLanding} onBackToDashboard={resetToLanding} /> : null}
    </main>
  );
}








