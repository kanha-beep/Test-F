import { useEffect, useState } from "react";

const cardBase =
  "rounded-[28px] border border-stone-900/10 bg-white/70 p-6 shadow-[0_30px_70px_rgba(80,46,11,0.12)] backdrop-blur-xl";

const primaryButton =
  "inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-700 to-orange-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(196,102,31,0.28)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";

const secondaryButton =
  "inline-flex items-center justify-center rounded-2xl border border-stone-900/10 bg-white/80 px-4 py-3 text-sm font-semibold text-stone-900 transition hover:-translate-y-0.5 disabled:opacity-40";

function formatSavedDate(value) {
  if (!value) {
    return "Saved test";
  }

  return new Date(value).toLocaleString();
}

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}

function scorePercent(submission) {
  const total = submission?.test?.totalMarks || 0;
  if (!total) {
    return 0;
  }
  return Math.round((submission.score / total) * 100);
}

function QuestionEditor({ question, onChange, onAdd, isAdded }) {
  return (
    <article className={`rounded-[24px] border p-4 transition ${isAdded ? "border-emerald-400/40 bg-emerald-50/60" : "border-stone-900/10 bg-white/70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <strong className="text-base text-stone-900">Question {question.number}</strong>
          {isAdded && <span className="rounded-full bg-emerald-700/10 px-2 py-0.5 text-xs font-semibold text-emerald-800">Added</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={question.correctOption}
            onChange={(event) => onChange(question.id, (current) => ({ ...current, correctOption: event.target.value }))}
            className="rounded-2xl border border-stone-900/10 bg-white px-4 py-2 text-sm"
          >
            <option value="">Correct answer</option>
            {question.options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.key}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAdd(question.id)}
            className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
              isAdded
                ? "border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "border border-amber-700/20 bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
          >
            {isAdded ? "✓ Added" : "+ Add to list"}
          </button>
        </div>
      </div>

      <textarea
        value={question.prompt}
        onChange={(event) => onChange(question.id, (current) => ({ ...current, prompt: event.target.value }))}
        rows={3}
        className="mt-3 w-full rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-amber-600"
      />

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {question.options.map((option, index) => (
          <label key={option.key} className="rounded-2xl border border-stone-900/10 bg-stone-50 p-3 text-sm">
            <span className="mb-2 block font-semibold text-stone-900">{option.key}</span>
            <textarea
              value={option.text}
              onChange={(event) =>
                onChange(question.id, (current) => ({
                  ...current,
                  options: current.options.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, text: event.target.value } : item
                  )
                }))
              }
              rows={2}
              className="w-full rounded-2xl border border-stone-900/10 bg-white px-3 py-3 outline-none focus:border-amber-600"
            />
          </label>
        ))}
      </div>

      {question.parserNotes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {question.parserNotes.map((note) => (
            <span key={note} className="rounded-full bg-amber-700/10 px-3 py-1 text-xs text-amber-900">
              {note}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function TestLanding({
  tests,
  submissions,
  loading,
  candidateName,
  generationPrompt,
  generating,
  parsing,
  savingImport,
  importedDraft,
  durationMinutes,
  draftStats,
  onNameChange,
  onPromptChange,
  onDurationChange,
  onGenerate,
  onPdfUpload,
  onImportedDraftChange,
  onImportedQuestionChange,
  onToggleConfirmed,
  onAddQuestion,
  onSaveImportedTest,
  onStart,
  onRefreshDashboard
}) {
  const [savedTestIndex, setSavedTestIndex] = useState(0);
  const latestTest = tests[0];

  useEffect(() => {
    if (tests.length === 0) {
      setSavedTestIndex(0);
      return;
    }

    setSavedTestIndex((current) => Math.min(current, tests.length - 1));
  }, [tests]);

  const currentSavedTest = tests[savedTestIndex] || null;
  const bestScore = submissions.reduce((best, item) => Math.max(best, scorePercent(item)), 0);

  return (
    <section className="relative z-10 grid min-h-[calc(100vh-4rem)] grid-cols-1 items-start gap-8 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-6">
        <div>
          <span className="inline-flex text-xs font-bold uppercase tracking-[0.18em] text-amber-800">MCQ Test Platform</span>
          <h1 className="mt-3 max-w-5xl font-['Outfit'] text-5xl font-black leading-[0.95] tracking-[-0.06em] text-stone-900 sm:text-6xl lg:text-7xl">
            Create papers from prompts or uploaded PDFs, save them in MongoDB, and show them in one dashboard.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-stone-600">
            Prompt generation stays available. PDF import now builds a question paper from the document structure, lets you correct it, and saves it as a normal test.
          </p>
        </div>

        <div className={`${cardBase} space-y-4`}>
          <div className="space-y-2">
            <label htmlFor="candidateName" className="block text-sm font-semibold text-stone-900">
              Candidate name
            </label>
            <input
              id="candidateName"
              value={candidateName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-3xl border border-stone-900/10 bg-white/80 px-6 py-4 text-stone-900 outline-none placeholder:text-stone-400 focus:border-amber-600"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div>
              <label className="block text-sm font-semibold text-stone-900">Prompt generation</label>
              <textarea
                value={generationPrompt}
                onChange={(event) => onPromptChange(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-[28px] border border-stone-900/10 bg-white/80 px-6 py-4 text-stone-900 outline-none placeholder:text-stone-400 focus:border-amber-600"
                placeholder="Prepare a test on presidents topic with medium difficulty questions"
              />
            </div>
            <div className="flex flex-col gap-3">
              <label className="block text-sm font-semibold text-stone-900">Duration</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(event) => onDurationChange(event.target.value)}
                className="rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600"
              />
              <button className={primaryButton} onClick={onGenerate} type="button" disabled={generating}>
                {generating ? "Generating..." : "Generate Test"}
              </button>
              <button className={secondaryButton} onClick={onRefreshDashboard} type="button">
                Refresh Dashboard
              </button>
            </div>
          </div>
        </div>

        <div className={`${cardBase} space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-['Sora'] text-2xl font-bold tracking-[-0.04em] text-stone-900">Import From PDF</h2>
              <p className="mt-1 text-sm text-stone-500">Upload, review extracted structure, save to DB, then open the saved paper.</p>
            </div>
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">+2 / -1/3</span>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-amber-700/30 bg-amber-50/60 px-6 py-8 text-center transition hover:border-amber-700/60 hover:bg-amber-50">
            <span className="text-lg font-semibold text-stone-900">{parsing ? "Reading PDF..." : "Upload MCQ PDF"}</span>
            <span className="mt-2 text-sm leading-6 text-stone-600">
              Supports structures like `1.`, `Q1`, `(1)`, `(A)`, `A.`, `A)`, and separate answer keys.
            </span>
            <input type="file" accept="application/pdf" className="hidden" onChange={onPdfUpload} disabled={parsing} />
          </label>

          {importedDraft && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
                  <strong className="block font-['Sora'] text-3xl text-stone-900">{draftStats.total}</strong>
                  <span className="text-sm text-stone-500">Detected</span>
                </div>
                <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
                  <strong className="block font-['Sora'] text-3xl text-emerald-700">{draftStats.confirmed}</strong>
                  <span className="text-sm text-stone-500">Added to list</span>
                </div>
                <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
                  <strong className="block font-['Sora'] text-3xl text-stone-900">{draftStats.missingAnswers}</strong>
                  <span className="text-sm text-stone-500">Missing answers</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-stone-900">Paper title</label>
                  <input
                    value={importedDraft.title}
                    onChange={(event) => onImportedDraftChange({ title: event.target.value })}
                    className="mt-2 w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-900">Description</label>
                  <input
                    value={importedDraft.description}
                    onChange={(event) => onImportedDraftChange({ description: event.target.value })}
                    className="mt-2 w-full rounded-3xl border border-stone-900/10 bg-white/80 px-5 py-4 outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              {importedDraft.warnings.length > 0 && (
                <div className="grid gap-2">
                  {importedDraft.warnings.map((warning) => (
                    <div key={warning} className="rounded-2xl border border-amber-700/10 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-4">
                {importedDraft.questions.map((question) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    onChange={onImportedQuestionChange}
                    onAdd={onToggleConfirmed}
                    isAdded={importedDraft.confirmedIds.has(question.id)}
                  />
                ))}
              </div>

              <button className={secondaryButton} onClick={onAddQuestion} type="button">
                + Add Blank Question
              </button>

              <button className={primaryButton} onClick={onSaveImportedTest} type="button" disabled={savingImport || draftStats.confirmed === 0}>
                {savingImport ? "Saving..." : `Save ${draftStats.confirmed} Question${draftStats.confirmed !== 1 ? "s" : ""} To DB`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {latestTest && (
          <div className={cardBase}>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex rounded-full bg-amber-700/10 px-3 py-2 text-xs font-semibold text-amber-800">
                Latest Ready Test
              </span>
              <span className="inline-flex rounded-full bg-emerald-900/10 px-3 py-2 text-xs font-semibold text-emerald-800">
                {latestTest.sourceType === "pdf" ? "PDF" : "Prompt"}
              </span>
            </div>
            <h2 className="mt-5 font-['Sora'] text-3xl font-bold tracking-[-0.04em] text-stone-900">{latestTest.title}</h2>
            <p className="mt-3 text-base leading-7 text-stone-600">{latestTest.description}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
                <strong className="block font-['Sora'] text-3xl text-stone-900">{latestTest.totalQuestions}</strong>
                <span className="text-sm text-stone-500">Questions</span>
              </div>
              <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
                <strong className="block font-['Sora'] text-3xl text-stone-900">{latestTest.totalMarks}</strong>
                <span className="text-sm text-stone-500">Total marks</span>
              </div>
              <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
                <strong className="block font-['Sora'] text-3xl text-stone-900">{latestTest.durationMinutes}</strong>
                <span className="text-sm text-stone-500">Minutes</span>
              </div>
            </div>
            <button className={`${primaryButton} mt-6`} onClick={() => onStart(latestTest._id)} type="button">
              Start Latest Test
            </button>
          </div>
        )}

        <div className={cardBase}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-['Sora'] text-2xl font-bold tracking-[-0.04em] text-stone-900">Marks Dashboard</h3>
              <p className="mt-1 text-sm text-stone-500">Saved attempts from prompt and PDF papers.</p>
            </div>
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">{submissions.length}</span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
              <strong className="block font-['Sora'] text-3xl text-stone-900">{submissions.length}</strong>
              <span className="text-sm text-stone-500">Attempts</span>
            </div>
            <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
              <strong className="block font-['Sora'] text-3xl text-stone-900">{bestScore}%</strong>
              <span className="text-sm text-stone-500">Best score</span>
            </div>
            <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
              <strong className="block font-['Sora'] text-3xl text-stone-900">{candidateName?.trim() || "All"}</strong>
              <span className="text-sm text-stone-500">Candidate filter</span>
            </div>
          </div>

          {!loading && submissions.length === 0 && (
            <p className="mt-4 text-sm leading-6 text-stone-600">No saved marks yet. Submit a test and the results will appear here.</p>
          )}

          <div className="mt-5 grid gap-3">
            {submissions.map((submission) => (
              <div key={submission._id} className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-stone-900">{submission.test?.title || "Saved Attempt"}</h4>
                    <p className="mt-1 text-sm text-stone-600">{submission.candidateName}</p>
                    <p className="mt-2 text-xs text-stone-500">{formatSavedDate(submission.submittedAt)}</p>
                  </div>
                  <div className="rounded-3xl bg-emerald-900/10 px-4 py-3 text-right">
                    <strong className="block font-['Sora'] text-2xl text-stone-900">
                      {formatScore(submission.score)}/{submission.test?.totalMarks || 0}
                    </strong>
                    <span className="text-xs font-semibold text-emerald-800">{scorePercent(submission)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-['Sora'] text-2xl font-bold tracking-[-0.04em] text-stone-900">Saved Tests</h3>
              <p className="mt-1 text-sm text-stone-500">Prompt-created and PDF-created papers live together here.</p>
            </div>
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">{tests.length}</span>
          </div>

          {loading && <p className="mt-4 text-stone-500">Loading saved tests...</p>}
          {!loading && tests.length === 0 && (
            <p className="mt-4 text-sm leading-6 text-stone-600">No saved tests yet. Generate or import one to see it here.</p>
          )}

          {currentSavedTest && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  className={secondaryButton}
                  onClick={() => setSavedTestIndex((current) => Math.max(current - 1, 0))}
                  type="button"
                  disabled={savedTestIndex === 0}
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-stone-600">
                  Test {savedTestIndex + 1} of {tests.length}
                </span>
                <button
                  className={secondaryButton}
                  onClick={() => setSavedTestIndex((current) => Math.min(current + 1, tests.length - 1))}
                  type="button"
                  disabled={savedTestIndex === tests.length - 1}
                >
                  Next
                </button>
              </div>

              <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-amber-700/10 px-3 py-2 text-xs font-semibold text-amber-800">
                    {formatSavedDate(currentSavedTest.createdAt)}
                  </span>
                  <span className="rounded-full bg-emerald-900/10 px-3 py-2 text-xs font-semibold text-emerald-800">
                    {currentSavedTest.sourceType === "pdf" ? "PDF Import" : "Prompt Generation"}
                  </span>
                </div>
                <h4 className="mt-4 text-2xl font-semibold text-stone-900">{currentSavedTest.title}</h4>
                <p className="mt-2 text-sm leading-7 text-stone-600">{currentSavedTest.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
                  <span className="rounded-full bg-stone-900/5 px-3 py-1">{currentSavedTest.totalQuestions} questions</span>
                  <span className="rounded-full bg-stone-900/5 px-3 py-1">{currentSavedTest.totalMarks} marks</span>
                  <span className="rounded-full bg-stone-900/5 px-3 py-1">+{currentSavedTest.positiveMarks} / {currentSavedTest.negativeMarks}</span>
                </div>
                <button className={`${primaryButton} mt-5`} onClick={() => onStart(currentSavedTest._id)} type="button">
                  Open Test
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
