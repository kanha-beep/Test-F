import { useEffect, useMemo, useRef, useState } from "react";
import { TestLanding } from "./components/TestLanding.jsx";
import { TestRunner } from "./components/TestRunner.jsx";
import { ResultsView } from "./components/ResultsView.jsx";
import { parsePdfQuestions } from "./lib/pdfParser.js";
import { api } from "./lib/api.js";

function normalizeQuestion(question, index) {
  const keys = ["A", "B", "C", "D"];
  const optionMap = new Map((question.options || []).map((option) => [String(option.key).toUpperCase(), option.text || ""]));

  return {
    id: question.id || `draft-${index + 1}`,
    number: question.number || index + 1,
    prompt: question.prompt || "",
    correctOption: (question.correctOption || "").toUpperCase(),
    parserNotes: question.parserNotes || [],
    options: keys.map((key) => ({ key, text: optionMap.get(key) || "" }))
  };
}

const initialState = {
  tests: [],
  submissions: [],
  loading: true,
  error: "",
  candidateName: "",
  generationPrompt: "Prepare a 10-question test on presidents topic with mixed difficulty and clear explanations.",
  generating: false,
  parsing: false,
  savingImport: false,
  importedDraft: null,
  durationMinutes: 30,
  activeTest: null,
  currentIndex: 0,
  answers: {},
  timeLeft: 0,
  submission: null,
  resultFilter: "all"
};

function buildAnswerState(previous, questionId, nextAnswer) {
  return {
    ...previous,
    [questionId]: {
      ...(previous[questionId] || {}),
      ...nextAnswer
    }
  };
}

export default function App() {
  const [state, setState] = useState(initialState);
  const timerRef = useRef(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadDashboardData = async (candidateName = "") => {
    const [tests, submissions] = await Promise.all([api.getTests(), api.getSubmissions(candidateName.trim())]);

    setState((previous) => ({
      ...previous,
      tests,
      submissions,
      loading: false
    }));
  };

  useEffect(() => {
    loadDashboardData().catch((error) => {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error.message || "Unable to load dashboard"
      }));
    });
  }, []);

  useEffect(() => {
    if (!state.activeTest || state.submission) {
      window.clearInterval(timerRef.current);
      return undefined;
    }

    timerRef.current = window.setInterval(() => {
      setState((previous) => {
        if (previous.timeLeft <= 1) {
          window.clearInterval(timerRef.current);
          return {
            ...previous,
            timeLeft: 0
          };
        }

        return {
          ...previous,
          timeLeft: previous.timeLeft - 1
        };
      });
    }, 1000);

    return () => window.clearInterval(timerRef.current);
  }, [state.activeTest, state.submission]);

  useEffect(() => {
    if (!state.activeTest || state.submission || state.timeLeft !== 0) {
      return;
    }

    submitTest();
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
      setState((previous) => ({
        ...previous,
        activeTest: test,
        currentIndex: 0,
        answers: {},
        timeLeft: test.durationMinutes * 60,
        submission: null,
        resultFilter: "all",
        error: ""
      }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to start test" }));
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
      const createdTest = await api.generateTest(prompt);
      await loadDashboardData(stateRef.current.candidateName);
      setState((previous) => ({ ...previous, generating: false }));
      await startTest(createdTest._id);
    } catch (error) {
      setState((previous) => ({
        ...previous,
        generating: false,
        error: error.message || "Unable to generate test"
      }));
    }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setState((previous) => ({ ...previous, parsing: true, error: "", importedDraft: null }));
      const parsed = await parsePdfQuestions(file);

      setState((previous) => ({
        ...previous,
        parsing: false,
        importedDraft: {
          title: parsed.title,
          description: `Imported from ${file.name}`,
          sourceFileName: file.name,
          questions: parsed.questions.map((question, index) => normalizeQuestion(question, index)),
          confirmedIds: new Set(),
          warnings: parsed.warnings
        }
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        parsing: false,
        error: error.message || "Unable to parse this PDF"
      }));
    }

    event.target.value = "";
  };

  const updateImportedDraft = (changes) => {
    setState((previous) => ({
      ...previous,
      importedDraft: previous.importedDraft ? { ...previous.importedDraft, ...changes } : previous.importedDraft
    }));
  };

  const toggleConfirmed = (questionId) => {
    setState((previous) => {
      if (!previous.importedDraft) return previous;
      const next = new Set(previous.importedDraft.confirmedIds);
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      return { ...previous, importedDraft: { ...previous.importedDraft, confirmedIds: next } };
    });
  };

  const addImportedQuestion = () => {
    setState((previous) => {
      if (!previous.importedDraft) return previous;
      const questions = previous.importedDraft.questions;
      const nextNumber = questions.length > 0 ? Math.max(...questions.map((q) => q.number)) + 1 : 1;
      const newQuestion = {
        id: `draft-new-${Date.now()}`,
        number: nextNumber,
        prompt: "",
        correctOption: "",
        parserNotes: [],
        options: ["A", "B", "C", "D"].map((key) => ({ key, text: "" }))
      };
      return {
        ...previous,
        importedDraft: { ...previous.importedDraft, questions: [...questions, newQuestion] }
      };
    });
  };

  const removeImportedQuestion = (questionId) => {
    setState((previous) => {
      if (!previous.importedDraft) return previous;
      return {
        ...previous,
        importedDraft: {
          ...previous.importedDraft,
          questions: previous.importedDraft.questions.filter((q) => q.id !== questionId)
        }
      };
    });
  };

  const updateImportedQuestion = (questionId, updater) => {
    setState((previous) => {
      if (!previous.importedDraft) {
        return previous;
      }

      return {
        ...previous,
        importedDraft: {
          ...previous.importedDraft,
          questions: previous.importedDraft.questions.map((question) =>
            question.id === questionId ? updater(question) : question
          )
        }
      };
    });
  };

  const saveImportedTest = async () => {
    const draft = state.importedDraft;
    const confirmedQuestions = draft?.questions.filter((q) => draft.confirmedIds.has(q.id)) || [];

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
      const createdTest = await api.importTest({
        title: draft.title,
        description: draft.description,
        durationMinutes: Number(state.durationMinutes) || 30,
        questions: confirmedQuestions
      });

      await loadDashboardData(stateRef.current.candidateName);
      setState((previous) => ({
        ...previous,
        savingImport: false,
        importedDraft: null
      }));
      await startTest(createdTest._id);
    } catch (error) {
      setState((previous) => ({
        ...previous,
        savingImport: false,
        error: error.message || "Unable to save imported test"
      }));
    }
  };

  const selectOption = (questionId, optionKey) => {
    setState((previous) => {
      const existing = previous.answers[questionId];
      const nextStatus =
        existing?.status === "review" || existing?.status === "review_answered" ? "review_answered" : "answered";

      return {
        ...previous,
        answers: buildAnswerState(previous.answers, questionId, {
          selectedOption: optionKey,
          status: nextStatus
        })
      };
    });
  };

  const skipQuestion = (questionId) => {
    setState((previous) => ({
      ...previous,
      answers: buildAnswerState(previous.answers, questionId, {
        selectedOption: null,
        status: "skipped"
      })
    }));
  };

  const clearResponse = (questionId) => {
    setState((previous) => {
      const existing = previous.answers[questionId];
      const nextStatus = existing?.status === "review_answered" || existing?.status === "review" ? "review" : "skipped";

      return {
        ...previous,
        answers: buildAnswerState(previous.answers, questionId, {
          selectedOption: null,
          status: nextStatus
        })
      };
    });
  };

  const markForReview = (questionId) => {
    setState((previous) => {
      const existing = previous.answers[questionId];
      return {
        ...previous,
        answers: buildAnswerState(previous.answers, questionId, {
          selectedOption: existing?.selectedOption || null,
          status: existing?.selectedOption ? "review_answered" : "review"
        })
      };
    });
  };

  const submitTest = async () => {
    const currentState = stateRef.current;

    if (!currentState.activeTest) {
      return;
    }

    try {
      const payload = {
        candidateName: currentState.candidateName,
        answers: currentState.activeTest.questions.map((question) => {
          const answer = currentState.answers[question._id];
          return {
            questionId: question._id,
            selectedOption: answer?.selectedOption || null,
            status: answer?.status || "skipped"
          };
        })
      };

      const submissionResponse = await api.submitTest(currentState.activeTest._id, payload);
      const submission = await api.getSubmission(submissionResponse.submissionId);
      const submissions = await api.getSubmissions(currentState.candidateName);

      setState((previous) => ({
        ...previous,
        submission,
        submissions,
        resultFilter: "all"
      }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to submit test" }));
    }
  };

  const resetToLanding = async () => {
    window.clearInterval(timerRef.current);
    setState((previous) => ({
      ...previous,
      activeTest: null,
      currentIndex: 0,
      answers: {},
      timeLeft: 0,
      submission: null,
      resultFilter: "all"
    }));

    try {
      await loadDashboardData(stateRef.current.candidateName);
    } catch (error) {
      setState((previous) => ({ ...previous, error: error.message || "Unable to refresh dashboard" }));
    }
  };

  return (
    <main className="relative min-h-screen max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(196,102,31,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(20,92,82,0.18),transparent_22%),linear-gradient(145deg,#f8f2ea_0%,#efe3d1_100%)] px-4 py-6 text-stone-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute right-[-5rem] top-[-7rem] h-80 w-80 rounded-full bg-amber-700/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-4rem] h-96 w-96 rounded-full bg-emerald-800/15 blur-3xl" />

      {state.error && (
        <div className="fixed right-4 top-4 z-50 rounded-2xl border border-red-700/15 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
          {state.error}
        </div>
      )}

      {!state.activeTest && (
        <TestLanding
          tests={state.tests}
          submissions={state.submissions}
          loading={state.loading}
          candidateName={state.candidateName}
          generationPrompt={state.generationPrompt}
          generating={state.generating}
          parsing={state.parsing}
          savingImport={state.savingImport}
          importedDraft={state.importedDraft}
          durationMinutes={state.durationMinutes}
          draftStats={draftStats}
          onNameChange={(candidateName) => setState((previous) => ({ ...previous, candidateName }))}
          onPromptChange={(generationPrompt) => setState((previous) => ({ ...previous, generationPrompt }))}
          onDurationChange={(durationMinutes) => setState((previous) => ({ ...previous, durationMinutes }))}
          onGenerate={generateTest}
          onPdfUpload={handlePdfUpload}
          onImportedDraftChange={updateImportedDraft}
          onImportedQuestionChange={updateImportedQuestion}
          onToggleConfirmed={toggleConfirmed}
          onAddQuestion={addImportedQuestion}
          onSaveImportedTest={saveImportedTest}
          onStart={startTest}
          onRefreshDashboard={() => loadDashboardData(state.candidateName)}
        />
      )}

      {state.activeTest && !state.submission && (
        <TestRunner
          test={state.activeTest}
          candidateName={state.candidateName}
          currentIndex={state.currentIndex}
          answers={state.answers}
          timeLeft={state.timeLeft}
          onSelectQuestion={(currentIndex) => setState((previous) => ({ ...previous, currentIndex }))}
          onSelectOption={selectOption}
          onSkip={skipQuestion}
          onMarkForReview={markForReview}
          onClearResponse={clearResponse}
          onSubmit={submitTest}
        />
      )}

      {state.submission && (
        <ResultsView
          submission={state.submission}
          activeFilter={state.resultFilter}
          onFilterChange={(resultFilter) => setState((previous) => ({ ...previous, resultFilter }))}
          onRetake={resetToLanding}
        />
      )}
    </main>
  );
}
