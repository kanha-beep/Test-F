// Preserve the older landing page implementation used before the newer auth-first flow.

import { useEffect, useMemo, useState } from "react";
import { AuthPage } from "./AuthPage.jsx";
import { EXAM_DETAILS, EXAM_TYPES, PAGE_TYPES, pageTypeLabel } from "../lib/examData.js";

const POOL_PAGE_SIZE = 4;
const TEST_PAGE_SIZE = 2;
const NAV_ITEMS = [
  { key: "exams", label: "Exams" },
  { key: "library", label: "All Tests" },
  { key: "sectional", label: "Sectional" },
  { key: "pyq", label: "PYQ" },
  { key: "personal", label: "Create Test" },
  { key: "user", label: "User Dashboard" },
  { key: "ranking", label: "Ranking" },
  { key: "contact", label: "Contact" }
];

const cardBase = "rounded-[28px] border border-slate-900/10 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl";
const primaryButton = "inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";
const secondaryButton = "inline-flex items-center justify-center rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:opacity-40";
const dangerButton = "inline-flex items-center justify-center rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 transition hover:bg-rose-100";

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
  if (pageType === "pyq") return "bg-slate-200 text-slate-800";
  if (pageType === "sectional") return "bg-slate-300 text-slate-900";
  if (pageType === "custom") return "bg-slate-400 text-slate-950";
  return "bg-slate-900 text-white";
}

// Reuse one section-header layout across the landing views.
function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <span className="inline-flex text-xs font-bold uppercase tracking-[0.18em] text-slate-700">{eyebrow}</span> : null}
        <h2 className="mt-2 font-['Sora'] text-3xl font-bold tracking-[-0.04em] text-slate-900">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

// Reuse one compact stat card across dashboard-style summaries.
function StatCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-3xl border border-slate-900/10 bg-white/80 p-4">
      <strong className={`block font-['Sora'] text-3xl ${tone}`}>{value}</strong>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}

// Render one saved test card with actions for starting, ranking, or deleting.
function TestCard({ test, onStart, onLoadRankings, onDeleteTest, canDelete }) {
  return (
    <article className="rounded-3xl border border-slate-900/10 bg-white/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-slate-900/10 px-3 py-2 text-xs font-semibold text-slate-700">{test.examType || "General"}</span>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-2 text-xs font-semibold ${badgeTone(test.pageType)}`}>{pageTypeLabel(test.pageType)}</span>
          <span className="rounded-full bg-slate-900/5 px-3 py-2 text-xs font-semibold text-slate-700">{test.sourceType === "pdf" ? "User Upload" : "AI Generated"}</span>
        </div>
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-slate-900">{test.title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{test.description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-slate-900/5 px-3 py-1">{test.totalQuestions} questions</span>
        <span className="rounded-full bg-slate-900/5 px-3 py-1">{test.durationMinutes} mins</span>
        <span className="rounded-full bg-slate-900/5 px-3 py-1">{test.totalMarks} marks</span>
        {test.sectionName ? <span className="rounded-full bg-slate-900/5 px-3 py-1">{test.sectionName}</span> : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className={primaryButton} type="button" onClick={() => onStart(test._id)}>Open Test</button>
        <button className={secondaryButton} type="button" onClick={() => onLoadRankings(test._id)}>Ranking</button>
        {canDelete ? <button className={dangerButton} type="button" onClick={() => onDeleteTest(test._id)}>Delete</button> : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">{formatSavedDate(test.createdAt)}</p>
    </article>
  );
}

// Handle the ExamMultiSelector logic for this module.
function ExamMultiSelector({ selectedExamTypes, activeExamType, onToggle, onFocus }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {EXAM_TYPES.map((exam) => {
        const selected = selectedExamTypes.includes(exam);
        const active = activeExamType === exam;
        return (
          <div key={exam} className={`rounded-[28px] border p-5 ${selected ? "border-slate-900 bg-slate-100" : "border-slate-900/10 bg-white/80"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-xl text-slate-900">{exam}</strong>
                <p className="mt-2 text-sm leading-6 text-slate-600">{EXAM_DETAILS[exam]?.description}</p>
              </div>
              <input type="checkbox" checked={selected} onChange={() => onToggle(exam)} className="mt-1 h-5 w-5 accent-slate-900" />
            </div>
            <button type="button" onClick={() => onFocus(exam)} className={`mt-4 rounded-full px-3 py-2 text-xs font-semibold ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>Use as active exam</button>
          </div>
        );
      })}
    </div>
  );
}

// Paginate saved tests into a responsive two-card-per-row catalog.
function CatalogGrid({ tests, page, onPageChange, onStart, onLoadRankings, onDeleteTest, canDelete, emptyMessage }) {
  const pageCount = Math.max(1, Math.ceil(tests.length / TEST_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleTests = tests.slice(safePage * TEST_PAGE_SIZE, safePage * TEST_PAGE_SIZE + TEST_PAGE_SIZE);
  return (
    <div className="space-y-4">
      {tests.length > 0 ? <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-500">Page {safePage + 1} of {pageCount}</span><div className="flex gap-2"><button type="button" className={secondaryButton} disabled={safePage === 0} onClick={() => onPageChange(Math.max(0, safePage - 1))}>Previous</button><button type="button" className={secondaryButton} disabled={safePage >= pageCount - 1} onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}>Next</button></div></div> : null}
      {tests.length === 0 ? <p className="text-sm leading-6 text-slate-600">{emptyMessage}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">{visibleTests.map((test) => <TestCard key={test._id} test={test} onStart={onStart} onLoadRankings={onLoadRankings} onDeleteTest={onDeleteTest} canDelete={canDelete} />)}</div>
    </div>
  );
}

// Let users edit parsed or selected imported questions before saving a test.
function QuestionEditor({ question, variant, showSolutionBox, onChange, onAddToList, onRemoveFromList, onDeleteQuestion }) {
  const isPool = variant === "pool";
  return (
    <article className="rounded-[24px] border border-slate-900/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-base text-slate-900">Question {question.number}</strong>
        <div className="flex flex-wrap gap-2">
          <select value={question.correctOption} onChange={(event) => onChange(question.id, (current) => ({ ...current, correctOption: event.target.value }))} className="rounded-2xl border border-slate-900/10 bg-white px-4 py-2 text-sm"><option value="">Correct answer</option>{question.options.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}</select>
          {isPool ? <button type="button" onClick={() => onAddToList(question.id)} className={secondaryButton}>Add to list</button> : <button type="button" onClick={() => onRemoveFromList(question.id)} className={secondaryButton}>Remove</button>}
          {isPool ? <button type="button" onClick={() => onDeleteQuestion(question.id)} className={dangerButton}>Delete</button> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input value={question.subject} onChange={(event) => onChange(question.id, (current) => ({ ...current, subject: event.target.value }))} className="rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900" placeholder="Subject" />
        <input value={question.difficulty} onChange={(event) => onChange(question.id, (current) => ({ ...current, difficulty: event.target.value }))} className="rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900" placeholder="Difficulty" />
      </div>
      <textarea value={question.prompt} onChange={(event) => onChange(question.id, (current) => ({ ...current, prompt: event.target.value }))} rows={3} className="mt-3 w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900" placeholder="Question text" />
      {showSolutionBox ? <textarea value={question.explanation || ""} onChange={(event) => onChange(question.id, (current) => ({ ...current, explanation: event.target.value }))} rows={3} className="mt-3 w-full rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900" placeholder="Solution / explanation" /> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {question.options.map((option, index) => <div key={option.key} className="rounded-2xl border border-slate-900/10 bg-slate-100 p-3 text-sm"><span className="mb-2 block font-semibold text-slate-900">{option.key}</span><textarea value={option.text} onChange={(event) => onChange(question.id, (current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) }))} rows={2} className="w-full rounded-2xl border border-slate-900/10 bg-white px-3 py-3 outline-none focus:border-slate-900" placeholder={`Option ${option.key} text`} />{showSolutionBox ? <textarea value={option.explanation || ""} onChange={(event) => onChange(question.id, (current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? { ...item, explanation: event.target.value } : item) }))} rows={3} className="mt-3 w-full rounded-2xl border border-slate-900/10 bg-white px-3 py-3 outline-none focus:border-slate-900" placeholder={`Option ${option.key} explanation`} /> : null}</div>)}
      </div>
    </article>
  );
}

// Handle AI generation, PDF upload, and imported-question editing for the active exam.
function UploadBuilder(props) {
  const { activeExamType, selectedPageType, selectedSectionName, importedDraft, parsing, generating, savingImport, savingDraft, durationMinutes, generationPrompt, syllabusTagsInput, draftStats, authUser, importExplanationMode, onPromptChange, onPageTypeChange, onImportExplanationModeChange, onSectionNameChange, onSyllabusTagsChange, onDurationChange, onGenerate, onPdfUpload, onImportedDraftChange, onImportedQuestionChange, onAddToList, onRemoveFromList, onRemoveQuestion, onAddQuestion, onSaveImportedTest, onSaveImportDraft } = props;
  const [poolPage, setPoolPage] = useState(0);
  const poolQuestions = importedDraft ? importedDraft.questions.filter((question) => !importedDraft.confirmedIds.has(question.id)) : [];
  const selectedQuestions = importedDraft ? [...importedDraft.confirmedIds].map((id) => importedDraft.questions.find((question) => question.id === id)).filter(Boolean) : [];
  const effectiveExplanationMode = importedDraft?.explanationMode || importExplanationMode;
  const poolPageCount = Math.max(1, Math.ceil(poolQuestions.length / POOL_PAGE_SIZE) || 1);
  const safePoolPage = Math.min(poolPage, poolPageCount - 1);
  const poolSlice = poolQuestions.slice(safePoolPage * POOL_PAGE_SIZE, (safePoolPage + 1) * POOL_PAGE_SIZE);

  useEffect(() => { setPoolPage((current) => Math.min(current, Math.max(0, poolPageCount - 1))); }, [poolPageCount, poolQuestions.length]);

  return (
    <div className="space-y-6">
      <div className={cardBase}>
        <SectionHeader eyebrow="Personal Test" title={`Create a personal ${activeExamType} test`} description="After login, users can create their own papers and those tests stay saved in the shared database for future use." />
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-slate-900">Page type</label>
            <select value={selectedPageType} onChange={(event) => onPageTypeChange(event.target.value)} className="mt-2 w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900">{PAGE_TYPES.map((pageType) => <option key={pageType.value} value={pageType.value}>{pageType.label}</option>)}</select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900">Section name</label>
            <input value={selectedSectionName} onChange={(event) => onSectionNameChange(event.target.value)} className="mt-2 w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Optional section name" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900">Duration</label>
            <input type="number" min="1" value={durationMinutes} onChange={(event) => onDurationChange(event.target.value)} className="mt-2 w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" />
          </div>
        </div>
        <input value={syllabusTagsInput} onChange={(event) => onSyllabusTagsChange(event.target.value)} className="mt-4 w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Syllabus tags, comma separated" />
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <textarea value={generationPrompt} onChange={(event) => onPromptChange(event.target.value)} rows={5} className="rounded-[28px] border border-slate-900/10 bg-white/80 px-6 py-4 text-slate-900 outline-none focus:border-slate-900" placeholder={`Prepare a ${activeExamType} test`} />
          <div className="flex flex-col gap-3"><button className={primaryButton} onClick={onGenerate} type="button" disabled={generating}>{generating ? "Generating..." : "Generate Test"}</button><label className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-900/20 bg-slate-100 px-4 py-5 text-center transition hover:border-slate-900/40 hover:bg-slate-100"><span className="text-base font-semibold text-slate-900">{parsing && effectiveExplanationMode === "without-explanation" ? "Reading PDF..." : "Upload PDF Without Explanation"}</span><input type="file" accept="application/pdf" className="hidden" onChange={(event) => { onImportExplanationModeChange("without-explanation"); onPdfUpload(event, "without-explanation"); }} disabled={parsing} /></label><label className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-900/20 bg-slate-100 px-4 py-5 text-center transition hover:border-slate-900/40 hover:bg-slate-100"><span className="text-base font-semibold text-slate-900">{parsing && effectiveExplanationMode === "with-solution" ? "Reading PDF..." : "Upload PDF With Solution"}</span><input type="file" accept="application/pdf" className="hidden" onChange={(event) => { onImportExplanationModeChange("with-solution"); onPdfUpload(event, "with-solution"); }} disabled={parsing} /></label></div>
        </div>
      </div>

      {importedDraft ? <div className={`${cardBase} space-y-5`}><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Detected" value={draftStats.total} /><StatCard label="In list" value={draftStats.confirmed} tone="text-slate-700" /><StatCard label="Missing answers" value={draftStats.missingAnswers} /></div><div className="grid gap-4 md:grid-cols-2"><input value={importedDraft.title} onChange={(event) => onImportedDraftChange({ title: event.target.value })} className="rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Paper title" /><input value={importedDraft.description} onChange={(event) => onImportedDraftChange({ description: event.target.value })} className="rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Description" /></div><div className="flex flex-wrap gap-2"><button type="button" className={effectiveExplanationMode === "without-explanation" ? primaryButton : secondaryButton} onClick={() => onImportExplanationModeChange("without-explanation")}>Without Explanation</button><button type="button" className={effectiveExplanationMode === "with-solution" ? primaryButton : secondaryButton} onClick={() => onImportExplanationModeChange("with-solution")}>With Solution</button></div><div className="grid gap-4 lg:grid-cols-2">{poolSlice.map((question) => <QuestionEditor key={question.id} variant="pool" question={question} showSolutionBox={effectiveExplanationMode === "with-solution"} onChange={onImportedQuestionChange} onAddToList={onAddToList} onRemoveFromList={onRemoveFromList} onDeleteQuestion={onRemoveQuestion} />)}</div>{poolQuestions.length > POOL_PAGE_SIZE ? <div className="flex justify-between"><button type="button" className={secondaryButton} disabled={safePoolPage === 0} onClick={() => setPoolPage((current) => Math.max(0, current - 1))}>Previous page</button><button type="button" className={secondaryButton} disabled={safePoolPage >= poolPageCount - 1} onClick={() => setPoolPage((current) => Math.min(poolPageCount - 1, current + 1))}>Next page</button></div> : null}<button className={secondaryButton} onClick={onAddQuestion} type="button">Add Blank Question</button><div className="grid gap-4 lg:grid-cols-2">{selectedQuestions.map((question) => <QuestionEditor key={`selected-${question.id}`} variant="selected" question={question} showSolutionBox={effectiveExplanationMode === "with-solution"} onChange={onImportedQuestionChange} onAddToList={onAddToList} onRemoveFromList={onRemoveFromList} onDeleteQuestion={onRemoveQuestion} />)}</div><div className="flex flex-wrap gap-2"><button className={secondaryButton} onClick={onSaveImportDraft} type="button" disabled={savingDraft}>{savingDraft ? "Saving draft..." : "Save draft"}</button><button className={primaryButton} onClick={onSaveImportedTest} type="button" disabled={savingImport || draftStats.confirmed === 0}>{savingImport ? "Saving..." : `Save to ${activeExamType}`}</button></div><p className="text-xs text-slate-500">{authUser ? "This personal test draft stays attached to your account only." : "Sign in to attach test creation to your account."}</p></div> : null}
    </div>
  );
}

// Show the leaderboard for the currently selected test.
function RankingBoard({ rankingsTest, rankings, rankingsLoading }) {
  return (
    <div className={cardBase}>
      <SectionHeader eyebrow="Ranking" title={rankingsTest ? `${rankingsTest.title} leaderboard` : "Select a test to view ranks"} description="Every user who submits a test gets ranked on this board." />
      {rankingsLoading ? <p className="mt-4 text-sm text-slate-600">Loading ranking board...</p> : null}
      {!rankingsLoading && rankings.length === 0 ? <p className="mt-4 text-sm text-slate-600">No rankings loaded yet.</p> : null}
      <div className="mt-5 grid gap-3">{rankings.map((item) => <div key={item.submissionId} className="rounded-3xl border border-slate-900/10 bg-white/80 p-4"><div className="flex items-center justify-between gap-3"><div><strong className="text-slate-900">#{item.rank} {item.candidateName}</strong><p className="text-xs text-slate-500">{formatSavedDate(item.submittedAt)}</p></div><div className="flex items-center gap-3"><div className="text-right"><strong className="block font-['Sora'] text-2xl text-slate-900">{formatScore(item.score)}</strong><span className="text-xs text-slate-500">score</span></div>{item.contactEmail ? <a href={`mailto:${item.contactEmail}?subject=${encodeURIComponent(`Discussion on ${rankingsTest?.title || "test"}`)}`} className={secondaryButton}>Email Rank 1</a> : null}</div></div></div>)}</div>
    </div>
  );
}
// Handle the TestLanding logic for this module.
export function TestLanding({ tests, submissions, adminUsers, loading, authChecking, authUser, candidateName, generationPrompt, selectedExamTypes, activeExamType, selectedPageType, selectedSectionName, syllabusTagsInput, importExplanationMode, generating, parsing, savingImport, savingDraft, importedDraft, durationMinutes, draftStats, rankings, rankingsTest, rankingsLoading, onRegister, onLogin, onLogout, onSavePreferences, onNameChange, onPromptChange, onExamTypesChange, onActiveExamTypeChange, onPageTypeChange, onImportExplanationModeChange, onSectionNameChange, onSyllabusTagsChange, onDurationChange, onGenerate, onPdfUpload, onImportedDraftChange, onImportedQuestionChange, onAddToList, onRemoveFromList, onRemoveQuestion, onAddQuestion, onSaveImportedTest, onSaveImportDraft, onStart, onLoadRankings, onDeleteTest, onRefreshDashboard }) {
  const [activePage, setActivePage] = useState("auth");
  const [pageIndex, setPageIndex] = useState(0);
  const [libraryExamFilter, setLibraryExamFilter] = useState("all");
  const [contactStatus, setContactStatus] = useState("");
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleExam = (exam) => {
    const next = selectedExamTypes.includes(exam) ? selectedExamTypes.filter((item) => item !== exam) : [...selectedExamTypes, exam];
    onExamTypesChange(next.length ? next : [exam]);
    onActiveExamTypeChange(exam);
    if (!authUser) {
      setActivePage("auth");
    }
  };

  const preferredExamTypes = authUser?.preferredExamTypes?.length ? authUser.preferredExamTypes : selectedExamTypes;
  const visibleTests = tests.filter((test) => preferredExamTypes.includes(test.examType));
  const fullTests = visibleTests.filter((test) => test.pageType === "full-test" || test.pageType === "custom");
  const filteredLibraryTests = libraryExamFilter === "all" ? fullTests : fullTests.filter((test) => test.examType === libraryExamFilter);
  const sectionalTests = visibleTests.filter((test) => test.pageType === "sectional");
  const pyqTests = visibleTests.filter((test) => test.pageType === "pyq");
  const personalTests = tests.filter((test) => String(test.ownerUserId || "") === String(authUser?._id || ""));
  const bestScore = submissions.reduce((best, item) => Math.max(best, scorePercent(item)), 0);
  const improvementAreas = submissions.length ? submissions.slice(0, 5).map((item) => `${item.test?.title || "Test"}: ${scorePercent(item)}%`) : [];

  const navItems = authUser
    ? NAV_ITEMS.concat(authUser.role === "admin" ? [{ key: "admin", label: "Admin" }] : [])
    : [{ key: "auth", label: "Auth" }];

  useEffect(() => {
    setPageIndex(0);
  }, [activePage, activeExamType, tests.length, libraryExamFilter]);

  useEffect(() => {
    if (libraryExamFilter === "all") {
      return;
    }

    if (!preferredExamTypes.includes(libraryExamFilter)) {
      setLibraryExamFilter(preferredExamTypes[0] || "all");
    }
  }, [libraryExamFilter, preferredExamTypes]);

  useEffect(() => {
    if (!authUser) {
      setActivePage("auth");
      setMobileNavOpen(false);
      return;
    }

    if (authUser.role === "admin") {
      setActivePage("admin");
      setMobileNavOpen(false);
      return;
    }

    setActivePage("exams");
    setMobileNavOpen(false);
  }, [authUser]);

  const renderExams = () => <div className="space-y-6"><div className={cardBase}><SectionHeader eyebrow="Exam Selection" title="Choose one or more exams first" description="Start here. Pick the categories you care about, then the app will guide you into auth and a filtered dashboard." action={<button className={secondaryButton} type="button" onClick={onRefreshDashboard}>Refresh</button>} /><div className="mt-5"><ExamMultiSelector selectedExamTypes={selectedExamTypes} activeExamType={activeExamType} onToggle={toggleExam} onFocus={onActiveExamTypeChange} /></div></div><div className="grid gap-4 md:grid-cols-4"><StatCard label="Selected exams" value={selectedExamTypes.length} /><StatCard label="Saved tests" value={visibleTests.length} /><StatCard label="Sectional tests" value={sectionalTests.length} tone="text-slate-700" /><StatCard label="PYQ sets" value={pyqTests.length} tone="text-slate-700" /></div></div>;

  const renderLibrary = () => <div className="space-y-6"><div className={cardBase}><SectionHeader eyebrow="Filtered Library" title={`${activeExamType} tests for this user`} description="After login, users can sort the test bank around their preferred exams and choose what they want to attempt next." /><div className="mt-5 flex flex-wrap gap-3">{["all", ...preferredExamTypes].map((exam) => <button key={exam} type="button" onClick={() => setLibraryExamFilter(exam)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${libraryExamFilter === exam ? "bg-slate-900 text-white" : "border border-slate-900/10 bg-white text-slate-700 hover:bg-slate-100"}`}>{exam === "all" ? "All exams" : exam}</button>)}</div><div className="mt-5 grid gap-4 md:grid-cols-3"><StatCard label="Preferred exams" value={preferredExamTypes.length} /><StatCard label="Available filtered tests" value={filteredLibraryTests.length} /><StatCard label="Best score" value={`${bestScore}%`} tone="text-slate-700" /></div></div><div className={cardBase}><CatalogGrid tests={filteredLibraryTests} page={pageIndex} onPageChange={setPageIndex} onStart={onStart} onLoadRankings={onLoadRankings} onDeleteTest={onDeleteTest} canDelete={Boolean(authUser?.role === "admin")} emptyMessage="No filtered tests yet for the selected exams." /></div></div>;

  const renderSectional = () => <div className={cardBase}><SectionHeader eyebrow="Sectional" title="Sectional tests" description="Focused section-wise practice based on the logged-in user's preferred exams." /><div className="mt-5"><CatalogGrid tests={sectionalTests} page={pageIndex} onPageChange={setPageIndex} onStart={onStart} onLoadRankings={onLoadRankings} onDeleteTest={onDeleteTest} canDelete={Boolean(authUser?.role === "admin")} emptyMessage="No sectional tests available for this user's selected exams." /></div></div>;

  const renderPyq = () => <div className={cardBase}><SectionHeader eyebrow="PYQ" title="Previous year question sets" description="Only the PYQs matching the user's selected exam categories are shown here." /><div className="mt-5"><CatalogGrid tests={pyqTests} page={pageIndex} onPageChange={setPageIndex} onStart={onStart} onLoadRankings={onLoadRankings} onDeleteTest={onDeleteTest} canDelete={Boolean(authUser?.role === "admin")} emptyMessage="No PYQ sets available for this user's selected exams." /></div></div>;

  const renderUserDashboard = () => <div className="space-y-6"><div className={cardBase}><SectionHeader eyebrow="User Dashboard" title="Performance analysis and improvement board" description="After submission, the user dashboard shows attempts, ranking snapshots, and simple improvement signals." /><div className="mt-5 grid gap-4 md:grid-cols-4"><StatCard label="Attempts" value={submissions.length} /><StatCard label="Best score" value={`${bestScore}%`} tone="text-slate-700" /><StatCard label="Preferred exams" value={preferredExamTypes.join(", ")} /><StatCard label="Personal tests" value={personalTests.length} tone="text-slate-700" /></div></div><div className={cardBase}><SectionHeader title="Recent submissions" description="Ranks shown here come from the ranking board for the test that was attempted." /><div className="mt-5 grid gap-4 lg:grid-cols-2">{submissions.map((submission) => <div key={submission._id} className="rounded-3xl border border-slate-900/10 bg-white/80 p-4"><h4 className="text-lg font-semibold text-slate-900">{submission.test?.title || "Saved Attempt"}</h4><p className="mt-1 text-sm text-slate-600">{submission.candidateName}</p><p className="mt-2 text-xs text-slate-500">{formatSavedDate(submission.submittedAt)}</p><div className="mt-4 flex items-center justify-between"><span className="rounded-full bg-slate-900/10 px-3 py-1 text-xs font-semibold text-slate-800">{scorePercent(submission)}%</span><span className="text-xs text-slate-500">Rank {submission.rankingSnapshot?.rank || "-"}/{submission.rankingSnapshot?.totalParticipants || 0}</span></div></div>)}</div></div><div className={cardBase}><SectionHeader title="Improvement board" description="A quick summary of the latest test outcomes." /><div className="mt-4 grid gap-3">{improvementAreas.length ? improvementAreas.map((item) => <div key={item} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{item}</div>) : <p className="text-sm text-slate-600">No attempts yet.</p>}</div></div></div>;

  const renderAdminDashboard = () => <div className="space-y-6"><div className={cardBase}><SectionHeader eyebrow="Admin Dashboard" title="Admin-only user and test management" description="Admins can manage all users and all tests. Regular users only see learner-focused pages and cannot edit tests." action={<button className={secondaryButton} type="button" onClick={onRefreshDashboard}>Refresh data</button>} /><div className="mt-5 grid gap-4 md:grid-cols-4"><StatCard label="Users" value={adminUsers.length} /><StatCard label="Tests" value={tests.length} /><StatCard label="Uploads" value={tests.filter((test) => test.sourceType === "pdf").length} /><StatCard label="Admins" value={adminUsers.filter((user) => user.role === "admin").length} /></div></div><div className={cardBase}><SectionHeader title="Manage users" description="Users and their preferred exam categories." /><div className="mt-5 grid gap-3">{adminUsers.map((user) => <div key={user._id} className="rounded-3xl border border-slate-900/10 bg-white/80 p-4"><div className="flex items-center justify-between gap-3"><div><strong className="text-slate-900">{user.displayName}</strong><p className="text-xs text-slate-500">{user.email}</p></div><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{user.role}</span></div><div className="mt-3 flex flex-wrap gap-2">{(user.preferredExamTypes || []).map((exam) => <span key={`${user._id}-${exam}`} className="rounded-full bg-slate-900/10 px-3 py-1 text-xs text-slate-900">{exam}</span>)}</div></div>)}</div></div><div className={cardBase}><SectionHeader title="Manage tests" description="Delete is currently admin-only." /><div className="mt-5"><CatalogGrid tests={tests} page={pageIndex} onPageChange={setPageIndex} onStart={onStart} onLoadRankings={onLoadRankings} onDeleteTest={onDeleteTest} canDelete emptyMessage="No tests found." /></div></div></div>;

  return (
    <section className="relative z-10 space-y-8">
      <div className={`${cardBase} sticky top-4 z-20 p-4`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold tracking-[0.28em] text-white">G E S T</div>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-900/10 bg-white text-slate-900 lg:hidden"
              onClick={() => setMobileNavOpen((current) => !current)}
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <span className="text-lg font-semibold">{mobileNavOpen ? "X" : "="}</span>
            </button>
          </div>
          <div className={`${mobileNavOpen ? "flex" : "hidden"} flex-col gap-3 lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:self-stretch lg:flex-1`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {navItems.map((item) => <button key={item.key} type="button" onClick={() => { setActivePage(item.key); setMobileNavOpen(false); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activePage === item.key ? "bg-slate-900 text-white" : "bg-white/80 text-slate-700 hover:bg-slate-100"}`}>{item.label}</button>)}
            </div>
            {authUser ? <button type="button" className={secondaryButton} onClick={() => { setMobileNavOpen(false); onLogout(); }}>Log out</button> : null}
          </div>
        </div>
      </div>

      {activePage === "exams" ? renderExams() : null}
      {activePage === "auth" ? <AuthPage authUser={authUser} authChecking={authChecking} selectedExamTypes={selectedExamTypes} onRegister={onRegister} onLogin={onLogin} onLogout={onLogout} onSavePreferences={onSavePreferences} /> : null}
      {activePage === "library" ? renderLibrary() : null}
      {activePage === "sectional" ? renderSectional() : null}
      {activePage === "pyq" ? renderPyq() : null}
      {activePage === "personal" ? <UploadBuilder activeExamType={activeExamType} selectedPageType={selectedPageType} selectedSectionName={selectedSectionName} importedDraft={importedDraft} parsing={parsing} generating={generating} savingImport={savingImport} savingDraft={savingDraft} durationMinutes={durationMinutes} generationPrompt={generationPrompt} syllabusTagsInput={syllabusTagsInput} draftStats={draftStats} authUser={authUser} importExplanationMode={importExplanationMode} onPromptChange={onPromptChange} onPageTypeChange={onPageTypeChange} onImportExplanationModeChange={onImportExplanationModeChange} onSectionNameChange={onSectionNameChange} onSyllabusTagsChange={onSyllabusTagsChange} onDurationChange={onDurationChange} onGenerate={onGenerate} onPdfUpload={onPdfUpload} onImportedDraftChange={onImportedDraftChange} onImportedQuestionChange={onImportedQuestionChange} onAddToList={onAddToList} onRemoveFromList={onRemoveFromList} onRemoveQuestion={onRemoveQuestion} onAddQuestion={onAddQuestion} onSaveImportedTest={onSaveImportedTest} onSaveImportDraft={onSaveImportDraft} /> : null}
      {activePage === "user" ? renderUserDashboard() : null}
      {activePage === "ranking" ? <RankingBoard rankingsTest={rankingsTest} rankings={rankings} rankingsLoading={rankingsLoading} /> : null}
      {activePage === "admin" && authUser?.role === "admin" ? renderAdminDashboard() : null}
      {activePage === "contact" ? <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]"><div className={`${cardBase} space-y-4`}><SectionHeader eyebrow="Contact" title="Stay connected" description="Dedicated contact page kept inside the current single-app structure." /><input value={candidateName} onChange={(event) => onNameChange(event.target.value)} className="w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Your display name" /></div><div className={`${cardBase} space-y-4`}><input value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Name" /><input value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Email" /><textarea rows={5} value={contactForm.message} onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))} className="w-full rounded-[28px] border border-slate-900/10 bg-white/80 px-5 py-4 outline-none focus:border-slate-900" placeholder="Message" /><button type="button" className={primaryButton} onClick={() => setContactStatus("Message draft saved locally in the form.")}>Save Message Draft</button>{contactStatus ? <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-900">{contactStatus}</p> : null}</div></div> : null}
    </section>
  );
}














