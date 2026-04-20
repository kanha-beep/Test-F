// Coordinate the auth-first landing flow, exam hub, leaderboard, and notes experience.

import { useEffect, useMemo, useState } from "react";
import { EXAM_DETAILS, EXAM_TYPES, PAGE_TYPES, pageTypeLabel } from "../lib/examData.js";

// Show two saved-test cards per catalog page so the layout stays compact.
const TEST_PAGE_SIZE = 2;
// Limit the imported-question pool page size to keep the editor manageable.
const POOL_PAGE_SIZE = 4;
// Keep notes under a stable local-storage key.
const NOTES_KEY = "gest_user_notes";
// Define the authenticated navbar options in one shared array.
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "exams", label: "All Exams" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "notes", label: "Notes" }
];

const cardBase = "rounded-[28px] border border-stone-900/10 bg-white/75 p-6 shadow-[0_24px_60px_rgba(80,46,11,0.10)] backdrop-blur-xl";
const primaryButton = "inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-700 to-orange-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(196,102,31,0.28)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";
const secondaryButton = "inline-flex items-center justify-center rounded-2xl border border-stone-900/10 bg-white/85 px-4 py-3 text-sm font-semibold text-stone-900 transition hover:-translate-y-0.5 disabled:opacity-40";
const dangerButton = "inline-flex items-center justify-center rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-40";

// Reuse one section-header layout across the landing views.
function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <span className="inline-flex text-xs font-bold uppercase tracking-[0.18em] text-amber-800">{eyebrow}</span> : null}
        <h2 className="mt-2 font-['Sora'] text-3xl font-bold tracking-[-0.04em] text-stone-900">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

// Reuse one compact stat card across dashboard-style summaries.
function StatCard({ label, value, tone = "text-stone-900" }) {
  return (
    <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
      <strong className={`block font-['Sora'] text-3xl ${tone}`}>{value}</strong>
      <span className="text-sm text-stone-500">{label}</span>
    </div>
  );
}

// Format stored timestamps for cards, rankings, and history views.
function formatSavedDate(value) {
  return value ? new Date(value).toLocaleString() : "Saved test";
}

// Format numeric score values so whole numbers and decimals display cleanly.
function formatScore(score) {
  return Number.isInteger(score) ? String(score) : Number(score || 0).toFixed(2);
}

// Convert raw scores into percentages for dashboard improvement metrics.
function scorePercent(submission) {
  const total = submission?.test?.totalMarks || 0;
  return total ? Math.round((submission.score / total) * 100) : 0;
}

// Choose badge colors based on the test page type.
function badgeTone(pageType) {
  if (pageType === "pyq") return "bg-rose-500/10 text-rose-800";
  if (pageType === "sectional") return "bg-sky-500/10 text-sky-800";
  if (pageType === "custom") return "bg-violet-500/10 text-violet-800";
  return "bg-emerald-900/10 text-emerald-800";
}

// Render the pre-login authentication panel and sign-in/register actions.
function AuthPanel({ authUser, authChecking, onRegister, onLogin, onLogout }) {
  const [mode, setMode] = useState("login");
  const [authPending, setAuthPending] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleAuthSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();

    if (mode === "register" && !trimmedDisplayName) {
      setAuthMessage("Display name is required to create an account.");
      return;
    }

    if (!trimmedEmail || !password) {
      setAuthMessage(mode === "register" ? "Email, password, and display name are required." : "Email and password are required.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setAuthMessage("Password must be at least 6 characters.");
      return;
    }

    setAuthMessage("");
    setAuthPending(true);
    try {
      if (mode === "register") {
        await onRegister({ email: trimmedEmail, password, displayName: trimmedDisplayName });
        return;
      }
      await onLogin({ email: trimmedEmail, password });
    } finally {
      setAuthPending(false);
    }
  };

  const handleLogout = async () => {
    setAuthPending(true);
    try {
      await onLogout();
    } finally {
      setAuthPending(false);
    }
  };

  if (authChecking) {
    return <div className={cardBase}><p className="text-sm text-stone-600">Checking session...</p></div>;
  }

  if (authUser) {
    return <div className={`${cardBase} space-y-4`}><SectionHeader eyebrow="Auth" title="Signed in" description="Now pick your exams and continue to the dashboard." /><p className="text-sm text-stone-600">{authUser.displayName} � {authUser.email}</p><button type="button" className={secondaryButton} onClick={handleLogout} disabled={authPending}>{authPending ? "Log out..." : "Log out"}</button></div>;
  }

  return (
    <div className={`${cardBase} space-y-4`}>
      <SectionHeader eyebrow="Welcome" title="Sign in to continue" description="This software now opens with auth first. After auth, you choose exams and then land on the dashboard." />
      <div className="flex gap-2">
        <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "login" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`} onClick={() => { setMode("login"); setAuthMessage(""); }}>Log in</button>
        <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`} onClick={() => { setMode("register"); setAuthMessage(""); }}>Register</button>
      </div>
      {mode === "register" ? <input value={displayName} onChange={(event) => { setDisplayName(event.target.value); if (authMessage) setAuthMessage(""); }} className="w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-3 outline-none focus:border-amber-600" placeholder="Display name" /> : null}
      <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); if (authMessage) setAuthMessage(""); }} className="w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-3 outline-none focus:border-amber-600" placeholder="Email" />
      <input type="password" value={password} onChange={(event) => { setPassword(event.target.value); if (authMessage) setAuthMessage(""); }} className="w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-3 outline-none focus:border-amber-600" placeholder="Password" />
      {authMessage ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{authMessage}</p> : null}
      <button type="button" className={primaryButton} onClick={handleAuthSubmit} disabled={authPending}>{authPending ? `${mode === "register" ? "Create account" : "Log in"}...` : mode === "register" ? "Create account" : "Log in"}</button>
    </div>
  );
}

// Let the user choose one or more exams before entering the dashboard.
function ExamSelector({ selectedExamTypes, activeExamType, onToggleExam, onSetActive, onContinue }) {
  const [isContinuing, setIsContinuing] = useState(false);

  const handleContinue = async () => {
    setIsContinuing(true);
    try {
      await onContinue();
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <div className={`${cardBase} space-y-5`}>
      <SectionHeader eyebrow="Exam Setup" title="Choose your exams" description="Select one or more exams, then continue to your dashboard." action={<button type="button" className={primaryButton} onClick={handleContinue} disabled={isContinuing}>{isContinuing ? "Continue..." : "Continue"}</button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EXAM_TYPES.map((exam) => {
          const selected = selectedExamTypes.includes(exam);
          return (
            <div key={exam} className={`rounded-[28px] border p-5 ${selected ? "border-amber-700 bg-amber-50/80" : "border-stone-900/10 bg-white/70"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-xl text-stone-900">{exam}</strong>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{EXAM_DETAILS[exam]?.description}</p>
                </div>
                <input type="checkbox" checked={selected} onChange={() => onToggleExam(exam)} className="mt-1 h-5 w-5 accent-amber-700" />
              </div>
              <button type="button" onClick={() => onSetActive(exam)} className={`mt-4 rounded-full px-3 py-2 text-xs font-semibold ${activeExamType === exam ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}>Use as current exam</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Render one saved test card with actions for starting, ranking, or deleting.
function TestCard({ test, onStart, onLoadRankings, onDeleteTest, canDelete }) {
  const [pendingAction, setPendingAction] = useState("");

  const runAction = async (actionKey, action) => {
    setPendingAction(actionKey);
    try {
      await action();
    } finally {
      setPendingAction("");
    }
  };

  return (
    <article className="rounded-3xl border border-stone-900/10 bg-white/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-amber-700/10 px-3 py-2 text-xs font-semibold text-amber-800">{test.examType || "General"}</span>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-2 text-xs font-semibold ${badgeTone(test.pageType)}`}>{pageTypeLabel(test.pageType)}</span>
          <span className="rounded-full bg-stone-900/5 px-3 py-2 text-xs font-semibold text-stone-700">{test.sourceType === "pdf" ? "PDF Upload" : "AI Test"}</span>
        </div>
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-stone-900">{test.title}</h3>
      <p className="mt-2 text-sm leading-7 text-stone-600">{test.description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
        <span className="rounded-full bg-stone-900/5 px-3 py-1">{test.totalQuestions} questions</span>
        <span className="rounded-full bg-stone-900/5 px-3 py-1">{test.durationMinutes} mins</span>
        <span className="rounded-full bg-stone-900/5 px-3 py-1">{test.totalMarks} marks</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className={primaryButton} type="button" onClick={() => runAction("start", () => onStart(test._id))} disabled={Boolean(pendingAction)}>{pendingAction === "start" ? "Start Test..." : "Start Test"}</button>
        <button className={secondaryButton} type="button" onClick={() => runAction("ranking", () => onLoadRankings(test._id))} disabled={Boolean(pendingAction)}>{pendingAction === "ranking" ? "View Ranking..." : "View Ranking"}</button>
        {canDelete ? <button className={dangerButton} type="button" onClick={() => runAction("delete", () => onDeleteTest(test._id))} disabled={Boolean(pendingAction)}>{pendingAction === "delete" ? "Delete..." : "Delete"}</button> : null}
      </div>
      <p className="mt-3 text-xs text-stone-500">{formatSavedDate(test.createdAt)}</p>
    </article>
  );
}

// Paginate saved tests into a responsive two-card-per-row catalog.
function CatalogGrid({ tests, page, onPageChange, onStart, onLoadRankings, onDeleteTest, canDelete, emptyMessage }) {
  const pageCount = Math.max(1, Math.ceil(tests.length / TEST_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleTests = tests.slice(safePage * TEST_PAGE_SIZE, safePage * TEST_PAGE_SIZE + TEST_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {tests.length > 0 ? <div className="flex items-center justify-between gap-3"><span className="text-sm text-stone-500">Page {safePage + 1} of {pageCount}</span><div className="flex gap-2"><button type="button" className={secondaryButton} disabled={safePage === 0} onClick={() => onPageChange(Math.max(0, safePage - 1))}>Previous</button><button type="button" className={secondaryButton} disabled={safePage >= pageCount - 1} onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}>Next</button></div></div> : null}
      {tests.length === 0 ? <p className="text-sm leading-6 text-stone-600">{emptyMessage}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">{visibleTests.map((test) => <TestCard key={test._id} test={test} onStart={onStart} onLoadRankings={onLoadRankings} onDeleteTest={onDeleteTest} canDelete={canDelete} />)}</div>
    </div>
  );
}

// Let users edit parsed or selected imported questions before saving a test.
function QuestionEditor({ question, variant, onChange, onAddToList, onRemoveFromList, onDeleteQuestion }) {
  const isPool = variant === "pool";
  return (
    <article className="rounded-[24px] border border-stone-900/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-base text-stone-900">Question {question.number}</strong>
        <div className="flex flex-wrap gap-2">
          <select value={question.correctOption} onChange={(event) => onChange(question.id, (current) => ({ ...current, correctOption: event.target.value }))} className="rounded-2xl border border-stone-900/10 bg-white px-4 py-2 text-sm"><option value="">Correct answer</option>{question.options.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}</select>
          {isPool ? <button type="button" className={secondaryButton} onClick={() => onAddToList(question.id)}>Add to list</button> : <button type="button" className={secondaryButton} onClick={() => onRemoveFromList(question.id)}>Remove</button>}
          {isPool ? <button type="button" className={dangerButton} onClick={() => onDeleteQuestion(question.id)}>Delete</button> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input value={question.subject} onChange={(event) => onChange(question.id, (current) => ({ ...current, subject: event.target.value }))} className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-amber-600" placeholder="Subject" />
        <input value={question.difficulty} onChange={(event) => onChange(question.id, (current) => ({ ...current, difficulty: event.target.value }))} className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-amber-600" placeholder="Difficulty" />
      </div>
      <textarea value={question.prompt} onChange={(event) => onChange(question.id, (current) => ({ ...current, prompt: event.target.value }))} rows={3} className="mt-3 w-full rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-amber-600" placeholder="Question text" />
      <div className="mt-3 grid gap-3 md:grid-cols-2">{question.options.map((option, index) => <div key={option.key} className="rounded-2xl border border-stone-900/10 bg-stone-50 p-3 text-sm"><span className="mb-2 block font-semibold text-stone-900">{option.key}</span><textarea value={option.text} onChange={(event) => onChange(question.id, (current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) }))} rows={2} className="w-full rounded-2xl border border-stone-900/10 bg-white px-3 py-3 outline-none focus:border-amber-600" /></div>)}</div>
    </article>
  );
}

// Handle AI generation, PDF upload, and imported-question editing for the active exam.
function UploadBuilder({ activeExamType, selectedPageType, selectedSectionName, importedDraft, parsing, generating, savingImport, savingDraft, draftStatus, durationMinutes, generationPrompt, syllabusTagsInput, draftStats, onPromptChange, onPageTypeChange, onSectionNameChange, onSyllabusTagsChange, onDurationChange, onGenerate, onPdfUpload, onImportedDraftChange, onImportedQuestionChange, onAddToList, onRemoveFromList, onRemoveQuestion, onAddQuestion, onSaveImportedTest, onSaveImportDraft }) {
  const [poolPage, setPoolPage] = useState(0);
  const poolQuestions = importedDraft ? importedDraft.questions.filter((question) => !importedDraft.confirmedIds.has(question.id)) : [];
  const selectedQuestions = importedDraft ? [...importedDraft.confirmedIds].map((id) => importedDraft.questions.find((question) => question.id === id)).filter(Boolean) : [];
  const poolPageCount = Math.max(1, Math.ceil(poolQuestions.length / POOL_PAGE_SIZE) || 1);
  const safePoolPage = Math.min(poolPage, poolPageCount - 1);
  const poolSlice = poolQuestions.slice(safePoolPage * POOL_PAGE_SIZE, (safePoolPage + 1) * POOL_PAGE_SIZE);

  useEffect(() => {
    setPoolPage((current) => Math.min(current, Math.max(0, poolPageCount - 1)));
  }, [poolPageCount, poolQuestions.length]);

  return (
    <div className="space-y-6">
      <div className={cardBase}>
        <SectionHeader eyebrow="Create Test" title={`Create a ${activeExamType} test`} description="You can use AI or upload a test PDF to turn it into a saved practice paper." />
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-stone-900">Page type</label>
            <select value={selectedPageType} onChange={(event) => onPageTypeChange(event.target.value)} className="mt-2 w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600">{PAGE_TYPES.map((pageType) => <option key={pageType.value} value={pageType.value}>{pageType.label}</option>)}</select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900">Section name</label>
            <input value={selectedSectionName} onChange={(event) => onSectionNameChange(event.target.value)} className="mt-2 w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600" placeholder="Optional section name" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900">Duration</label>
            <input type="number" min="1" value={durationMinutes} onChange={(event) => onDurationChange(event.target.value)} className="mt-2 w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600" />
          </div>
        </div>
        <input value={syllabusTagsInput} onChange={(event) => onSyllabusTagsChange(event.target.value)} className="mt-4 w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600" placeholder="Syllabus tags, comma separated" />
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <textarea value={generationPrompt} onChange={(event) => onPromptChange(event.target.value)} rows={5} className="rounded-[28px] border border-stone-900/10 bg-white/80 px-6 py-4 text-stone-900 outline-none focus:border-amber-600" placeholder={`Prepare a ${activeExamType} test`} />
          <div className="flex flex-col gap-3"><button className={primaryButton} onClick={onGenerate} type="button" disabled={generating}>{generating ? "Create with AI..." : "Create with AI"}</button><label className={`flex flex-col items-center justify-center rounded-[28px] border border-dashed border-amber-700/30 bg-amber-50/60 px-4 py-5 text-center transition ${parsing ? "cursor-wait opacity-70" : "cursor-pointer hover:border-amber-700/60 hover:bg-amber-50"}`}><span className="text-base font-semibold text-stone-900">{parsing ? "Upload Test PDF..." : "Upload Test PDF"}</span><input type="file" accept="application/pdf" className="hidden" onChange={onPdfUpload} disabled={parsing} /></label></div>
        </div>
      </div>

      {importedDraft ? <div className={`${cardBase} space-y-5`}><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Detected" value={draftStats.total} /><StatCard label="In list" value={draftStats.confirmed} tone="text-emerald-700" /><StatCard label="Missing answers" value={draftStats.missingAnswers} /></div><div className="grid gap-4 md:grid-cols-2"><input value={importedDraft.title} onChange={(event) => onImportedDraftChange({ title: event.target.value })} className="rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600" placeholder="Paper title" /><input value={importedDraft.description} onChange={(event) => onImportedDraftChange({ description: event.target.value })} className="rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600" placeholder="Description" /></div><div className="grid gap-4 lg:grid-cols-2">{poolSlice.map((question) => <QuestionEditor key={question.id} variant="pool" question={question} onChange={onImportedQuestionChange} onAddToList={onAddToList} onRemoveFromList={onRemoveFromList} onDeleteQuestion={onRemoveQuestion} />)}</div>{poolQuestions.length > POOL_PAGE_SIZE ? <div className="flex justify-between"><button type="button" className={secondaryButton} disabled={safePoolPage === 0} onClick={() => setPoolPage((current) => Math.max(0, current - 1))}>Previous page</button><button type="button" className={secondaryButton} disabled={safePoolPage >= poolPageCount - 1} onClick={() => setPoolPage((current) => Math.min(poolPageCount - 1, current + 1))}>Next page</button></div> : null}<button className={secondaryButton} type="button" onClick={onAddQuestion}>Add Blank Question</button><div className="grid gap-4 lg:grid-cols-2">{selectedQuestions.map((question) => <QuestionEditor key={`selected-${question.id}`} variant="selected" question={question} onChange={onImportedQuestionChange} onAddToList={onAddToList} onRemoveFromList={onRemoveFromList} onDeleteQuestion={onRemoveQuestion} />)}</div><div className="flex flex-wrap gap-2"><button className={secondaryButton} onClick={onSaveImportDraft} type="button" disabled={savingDraft}>{savingDraft ? "Save draft..." : "Save draft"}</button><button className={primaryButton} onClick={onSaveImportedTest} type="button" disabled={savingImport || draftStats.confirmed === 0}>{savingImport ? `Save ${activeExamType} test...` : `Save ${activeExamType} test`}</button></div>{draftStatus ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{draftStatus}</p> : null}</div> : null}
    </div>
  );
}

// Show the leaderboard for the currently selected test.
function RankingBoard({ tests, rankingsTest, rankings, rankingsLoading, onLoadRankings }) {
  return (
    <div className={cardBase}>
      <SectionHeader eyebrow="Leaderboard" title={rankingsTest ? `${rankingsTest.title} leaderboard` : "Choose a test to view the leaderboard"} description="Ranks update whenever a user submits that test." />
      <div className="mt-5 flex flex-wrap gap-2">{tests.slice(0, 12).map((test) => <button key={test._id} type="button" className={secondaryButton} onClick={() => onLoadRankings(test._id)} disabled={rankingsLoading}>{rankingsLoading && rankingsTest?._id === test._id ? `${test.title}...` : test.title}</button>)}</div>
      {rankingsLoading ? <p className="mt-4 text-sm text-stone-600">Loading leaderboard...</p> : null}
      {!rankingsLoading && rankings.length === 0 ? <p className="mt-4 text-sm text-stone-600">No leaderboard data loaded yet. Use a test card's ranking button.</p> : null}
      <div className="mt-5 grid gap-3">{rankings.map((item) => <div key={item.submissionId} className="rounded-3xl border border-stone-900/10 bg-white/70 p-4"><div className="flex items-center justify-between gap-3"><div><strong className="text-stone-900">#{item.rank} {item.candidateName}</strong><p className="text-xs text-stone-500">{formatSavedDate(item.submittedAt)}</p></div><div className="text-right"><strong className="block font-['Sora'] text-2xl text-stone-900">{formatScore(item.score)}</strong><span className="text-xs text-stone-500">score</span></div></div></div>)}</div>
    </div>
  );
}

// Coordinate the logged-in landing experience across dashboard, exams, leaderboard, and notes.
export function TestFlowLanding({ tests, submissions, adminUsers, loading, authChecking, authUser, candidateName, generationPrompt, selectedExamTypes, activeExamType, selectedPageType, selectedSectionName, syllabusTagsInput, generating, parsing, savingImport, savingDraft, draftStatus, importedDraft, durationMinutes, draftStats, rankings, rankingsTest, rankingsLoading, onRegister, onLogin, onLogout, onSavePreferences, onNameChange, onPromptChange, onExamTypesChange, onActiveExamTypeChange, onPageTypeChange, onSectionNameChange, onSyllabusTagsChange, onDurationChange, onGenerate, onPdfUpload, onImportedDraftChange, onImportedQuestionChange, onAddToList, onRemoveFromList, onRemoveQuestion, onAddQuestion, onSaveImportedTest, onSaveImportDraft, onStart, onLoadRankings, onDeleteTest }) {
  const [activePage, setActivePage] = useState("auth");
  const [pageIndex, setPageIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const preferredExams = authUser?.preferredExamTypes?.length ? authUser.preferredExamTypes : selectedExamTypes;
  const activeExamTests = useMemo(() => tests.filter((test) => test.examType === activeExamType), [tests, activeExamType]);
  const preparedTests = useMemo(() => activeExamTests.filter((test) => test.pageType === "full-test" || test.pageType === "custom"), [activeExamTests]);
  const bestScore = submissions.reduce((best, item) => Math.max(best, scorePercent(item)), 0);

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(NOTES_KEY) || "");
    } catch {
      setNotes("");
    }
  }, []);

  useEffect(() => {
    if (!authUser) {
      setActivePage("auth");
      setMobileNavOpen(false);
      return;
    }
    if (!authUser.preferredExamTypes?.length) {
      setActivePage("setup");
      setMobileNavOpen(false);
      return;
    }
    setActivePage("dashboard");
    setMobileNavOpen(false);
  }, [authUser]);

  useEffect(() => {
    setPageIndex(0);
  }, [activePage, activeExamType, tests.length]);

  const handleToggleExam = (exam) => {
    const next = selectedExamTypes.includes(exam) ? selectedExamTypes.filter((item) => item !== exam) : [...selectedExamTypes, exam];
    onExamTypesChange(next.length ? next : [exam]);
    onActiveExamTypeChange(exam);
  };

  const saveExamSelection = async () => {
    await onSavePreferences(selectedExamTypes);
    setActivePage("dashboard");
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      localStorage.setItem(NOTES_KEY, notes);
    } catch {
      // Notes remain in component state if storage fails.
    } finally {
      setNotesSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutPending(true);
    try {
      await onLogout();
    } finally {
      setLogoutPending(false);
    }
  };

  if (!authUser) {
    return <AuthPanel authUser={authUser} authChecking={authChecking} onRegister={onRegister} onLogin={onLogin} onLogout={onLogout} />;
  }

  if (activePage === "setup") {
    return <ExamSelector selectedExamTypes={selectedExamTypes} activeExamType={activeExamType} onToggleExam={handleToggleExam} onSetActive={onActiveExamTypeChange} onContinue={saveExamSelection} />;
  }

  return (
    <section className="relative z-10 space-y-8">
      <div className={`${cardBase} sticky top-4 z-20 p-4`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/85 text-stone-900 lg:hidden"
              onClick={() => setMobileNavOpen((current) => !current)}
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <span className="text-lg font-semibold">{mobileNavOpen ? "X" : "="}</span>
            </button>
            <button type="button" className="hidden lg:inline-flex" aria-hidden="true" />
          </div>
          <div className={`${mobileNavOpen ? "flex" : "hidden"} flex-col gap-3 lg:flex lg:flex-row lg:items-center lg:justify-between`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{NAV_ITEMS.map((item) => <button key={item.key} type="button" onClick={() => { setActivePage(item.key); setMobileNavOpen(false); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activePage === item.key ? "bg-stone-900 text-white" : "bg-white/70 text-stone-700 hover:bg-stone-100"}`}>{item.label}</button>)}</div>
            <button type="button" className={secondaryButton} onClick={handleLogout} disabled={logoutPending}>{logoutPending ? "Log out..." : "Log out"}</button>
          </div>
        </div>
      </div>

      {activePage === "dashboard" ? <div className="space-y-6"><div className={cardBase}><SectionHeader eyebrow="Dashboard" title="Your common dashboard" description="Users and admins both land here after auth and exam selection. Admins simply see extra admin insights below." /><div className="mt-5 grid gap-4 md:grid-cols-4"><StatCard label="Current exam" value={activeExamType} /><StatCard label="Preferred exams" value={preferredExams.length} /><StatCard label="Attempts" value={submissions.length} /><StatCard label="Best score" value={`${bestScore}%`} tone="text-emerald-700" /></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{preferredExams.map((exam) => <button key={exam} type="button" onClick={() => { onActiveExamTypeChange(exam); setActivePage("exams"); }} className="rounded-[28px] border border-stone-900/10 bg-white/70 p-5 text-left transition hover:-translate-y-0.5"><strong className="text-xl text-stone-900">{exam}</strong><p className="mt-2 text-sm leading-6 text-stone-600">{EXAM_DETAILS[exam]?.description}</p><span className="mt-4 inline-flex rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">Open {exam}</span></button>)}</div>{authUser.role === "admin" ? <div className={cardBase}><SectionHeader eyebrow="Admin View" title="Admin insights" description="Admin uses the same dashboard flow, but sees extra platform data here." /><div className="mt-5 grid gap-4 md:grid-cols-3"><StatCard label="Users" value={adminUsers.length} /><StatCard label="All tests" value={tests.length} /><StatCard label="PDF uploads" value={tests.filter((test) => test.sourceType === "pdf").length} /></div></div> : null}</div> : null}

      {activePage === "exams" ? <div className="space-y-6"><div className={cardBase}><SectionHeader eyebrow="Exam Hub" title={`${activeExamType} options`} description="Choose a prepared test, create one using AI, or upload a test PDF to generate a new saved paper." /><div className="mt-5 flex flex-wrap gap-2">{EXAM_TYPES.map((exam) => <button key={exam} type="button" onClick={() => onActiveExamTypeChange(exam)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeExamType === exam ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}>{exam}</button>)}</div></div><div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"><div className={`${cardBase} space-y-5`}><SectionHeader title="Already prepared tests" description="These are saved tests already available for the current exam." /><CatalogGrid tests={preparedTests} page={pageIndex} onPageChange={setPageIndex} onStart={onStart} onLoadRankings={onLoadRankings} onDeleteTest={onDeleteTest} canDelete={authUser.role === "admin"} emptyMessage={`No prepared ${activeExamType} tests yet.`} /></div><UploadBuilder activeExamType={activeExamType} selectedPageType={selectedPageType} selectedSectionName={selectedSectionName} importedDraft={importedDraft} parsing={parsing} generating={generating} savingImport={savingImport} savingDraft={savingDraft} draftStatus={draftStatus} durationMinutes={durationMinutes} generationPrompt={generationPrompt} syllabusTagsInput={syllabusTagsInput} draftStats={draftStats} onPromptChange={onPromptChange} onPageTypeChange={onPageTypeChange} onSectionNameChange={onSectionNameChange} onSyllabusTagsChange={onSyllabusTagsChange} onDurationChange={onDurationChange} onGenerate={onGenerate} onPdfUpload={onPdfUpload} onImportedDraftChange={onImportedDraftChange} onImportedQuestionChange={onImportedQuestionChange} onAddToList={onAddToList} onRemoveFromList={onRemoveFromList} onRemoveQuestion={onRemoveQuestion} onAddQuestion={onAddQuestion} onSaveImportedTest={onSaveImportedTest} onSaveImportDraft={onSaveImportDraft} /></div></div> : null}

      {activePage === "leaderboard" ? <RankingBoard tests={tests} rankingsTest={rankingsTest} rankings={rankings} rankingsLoading={rankingsLoading} onLoadRankings={onLoadRankings} /> : null}

      {activePage === "notes" ? <div className={cardBase}><SectionHeader eyebrow="Notes" title="Your notes section" description="Keep revision notes directly inside the software." action={<button type="button" className={primaryButton} onClick={saveNotes} disabled={notesSaving}>{notesSaving ? "Save Notes..." : "Save Notes"}</button>} /><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={14} className="mt-5 w-full rounded-[28px] border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600" placeholder="Write your exam notes here..." /></div> : null}
    </section>
  );
}


