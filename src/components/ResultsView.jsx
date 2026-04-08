// Show evaluated answers, scoring analysis, and post-test actions after submission.

import { useState } from "react";

const filterOptions = [
  { key: "all", label: "All" },
  { key: "correct", label: "Correct" },
  { key: "incorrect", label: "Incorrect" },
  { key: "skipped", label: "Skipped" },
  { key: "review", label: "Review" }
];

// Handle the matchesFilter logic for this module.
function matchesFilter(answer, activeFilter) {
  if (activeFilter === "all") {
    return true;
  }

  if (activeFilter === "correct") {
    return answer.status === "correct" || answer.status === "review_correct";
  }

  if (activeFilter === "incorrect") {
    return answer.status === "incorrect" || answer.status === "review_incorrect";
  }

  if (activeFilter === "review") {
    return answer.status.startsWith("review");
  }

  return answer.status === activeFilter;
}

// Handle the badgeLabel logic for this module.
function badgeLabel(status) {
  switch (status) {
    case "review_correct":
      return "Review + Correct";
    case "review_incorrect":
      return "Review + Incorrect";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// Handle the badgeClasses logic for this module.
function badgeClasses(status) {
  switch (status) {
    case "correct":
    case "review_correct":
      return "bg-slate-900 text-white";
    case "incorrect":
    case "review_incorrect":
      return "bg-slate-700 text-white";
    case "review":
      return "bg-slate-300 text-slate-900";
    default:
      return "bg-slate-200 text-slate-700";
  }
}

// Format numeric score values so whole numbers and decimals display cleanly.
function formatScore(value) {
  return Number.isInteger(value) ? String(value) : Number(value || 0).toFixed(2);
}

// Handle the isGenericOverallExplanation logic for this module.
function isGenericOverallExplanation(text) {
  const t = String(text || "").trim().toLowerCase();
  return (
    t === "imported from pdf." ||
    t === "imported from pdf" ||
    t === "imported from source document." ||
    t === "generated from prompt." ||
    t === "generated from prompt"
  );
}

const panel = "rounded-[28px] border border-slate-900/10 bg-white/80 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl";
const primaryButton =
  "inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0";
const secondaryButton =
  "inline-flex items-center justify-center rounded-2xl border border-slate-900/10 bg-white px-5 py-4 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0";

// Render the post-submission analysis dashboard and answer review list.
export function ResultsView({ submission, activeFilter, onFilterChange, onRetake, onBackToDashboard }) {
  const [isRetaking, setIsRetaking] = useState(false);
  const filteredAnswers = submission.evaluatedAnswers.filter((answer) => matchesFilter(answer, activeFilter));

  const handleRetake = async () => {
    setIsRetaking(true);
    try {
      await onRetake();
    } finally {
      setIsRetaking(false);
    }
  };

  const handleBackToDashboard = async () => {
    setIsRetaking(true);
    try {
      await onBackToDashboard();
    } finally {
      setIsRetaking(false);
    }
  };

  return (
    <section className="relative z-10 grid gap-5">
      <div className={`${panel} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
        <div>
          <span className="inline-flex text-xs font-bold uppercase tracking-[0.18em] text-slate-700">Result Analysis</span>
          <h1 className="mt-2 font-['Sora'] text-4xl font-bold tracking-[-0.05em] text-slate-900 md:text-5xl">
            {submission.test.title}
          </h1>
          <p className="mt-3 text-lg leading-8 text-slate-600">
            Score <strong>{formatScore(submission.score)}</strong> out of {formatScore(submission.test.totalMarks)} for {submission.candidateName}.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Marking scheme: +{formatScore(submission.test.positiveMarks)} and {formatScore(submission.test.negativeMarks)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className={secondaryButton} onClick={handleBackToDashboard} type="button" disabled={isRetaking}>
            {isRetaking ? "Go to Dashboard..." : "Go to Dashboard"}
          </button>
          <button className={primaryButton} onClick={handleRetake} type="button" disabled={isRetaking}>
            {isRetaking ? "Take Another Attempt..." : "Take Another Attempt"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-slate-900/10 bg-slate-900 p-6">
          <span className="text-sm text-slate-100">Correct</span>
          <strong className="mt-2 block font-['Sora'] text-4xl text-slate-900">{submission.summary.correct}</strong>
        </div>
        <div className="rounded-[28px] border border-slate-900/10 bg-slate-700 p-6">
          <span className="text-sm text-slate-100">Incorrect</span>
          <strong className="mt-2 block font-['Sora'] text-4xl text-slate-900">{submission.summary.incorrect}</strong>
        </div>
        <div className="rounded-[28px] border border-slate-900/10 bg-slate-200 p-6">
          <span className="text-sm text-slate-700">Skipped</span>
          <strong className="mt-2 block font-['Sora'] text-4xl text-slate-900">{submission.summary.skipped}</strong>
        </div>
        <div className="rounded-[28px] border border-slate-900/10 bg-slate-300 p-6">
          <span className="text-sm text-slate-700">Review</span>
          <strong className="mt-2 block font-['Sora'] text-4xl text-slate-900">{submission.summary.review}</strong>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {filterOptions.map((filter) => (
          <button
            key={filter.key}
            className={`rounded-full border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
              activeFilter === filter.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-900/10 bg-white/80 text-slate-700"
            }`}
            onClick={() => onFilterChange(filter.key)}
            type="button"
            disabled={isRetaking}
          >
            {activeFilter === filter.key && isRetaking ? `${filter.label}...` : filter.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredAnswers.map((answer) => (
          <article className={panel} key={answer.questionId}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Question {answer.questionNumber}</h3>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${badgeClasses(answer.status)}`}>
                  {badgeLabel(answer.status)}
                </span>
                <span className="inline-flex rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                  {formatScore(answer.marksAwarded)} marks
                </span>
              </div>
            </div>
            <p className="mt-4 text-lg leading-8 text-slate-800">{answer.prompt}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {answer.options.map((option) => {
                const isSelected = answer.selectedOption === option.key;
                const isCorrect = answer.correctOption === option.key;
                const optionExplanation = option.explanation?.trim();

                return (
                  <div
                    className={`flex min-w-[220px] flex-1 flex-col gap-2 rounded-3xl border px-4 py-4 ${
                      isCorrect
                        ? "border-slate-900/20 bg-slate-100"
                        : isSelected
                          ? "border-slate-700/30 bg-slate-200"
                          : "border-slate-900/10 bg-white/80"
                    }`}
                    key={option.key}
                  >
                    <div className="flex items-start gap-3">
                      <strong className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900/10 text-slate-900">
                        {option.key}
                      </strong>
                      <span className="text-sm leading-6 text-slate-700">{option.text}</span>
                    </div>
                    {optionExplanation ? (
                      <div className="rounded-2xl bg-slate-900/5 px-3 py-2 text-xs leading-5 text-slate-700">
                        <span className="font-semibold text-slate-900">Explanation: </span>
                        {optionExplanation}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-6 text-sm text-slate-600">
              <p>
                Your answer: <strong className="text-slate-900">{answer.selectedOption || "Not answered"}</strong>
              </p>
              <p>
                Correct option: <strong className="text-slate-900">{answer.correctOption}</strong>
              </p>
            </div>
            {answer.explanation?.trim() && !isGenericOverallExplanation(answer.explanation) ? (
              <p className="mt-4 rounded-3xl bg-slate-100 px-4 py-4 text-sm leading-7 text-slate-900">
                <span className="font-semibold text-slate-950">Question explanation: </span>
                {answer.explanation}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}



