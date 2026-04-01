function formatScore(value) {
  return Number.isInteger(value) ? String(value) : Number(value || 0).toFixed(2);
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getPaletteStatus(answer) {
  if (!answer) {
    return "bg-white/80 text-stone-700";
  }

  if (answer.status === "review" || answer.status === "review_answered") {
    return "bg-violet-500/20 text-violet-900";
  }

  if (answer.selectedOption) {
    return "bg-emerald-500/20 text-emerald-900";
  }

  return "bg-stone-400/30 text-stone-800";
}

const panel = "rounded-[28px] border border-stone-900/10 bg-white/70 p-6 shadow-[0_30px_70px_rgba(80,46,11,0.12)] backdrop-blur-xl";
const pill = "inline-flex rounded-full bg-emerald-900/10 px-3 py-2 text-xs font-semibold text-emerald-800";
const ghostButton =
  "inline-flex items-center justify-center rounded-2xl border border-stone-900/10 bg-white/80 px-5 py-4 text-sm font-semibold text-stone-900 transition hover:-translate-y-0.5";
const reviewButton =
  "inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-700 to-fuchsia-500 px-5 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5";
const primaryButton =
  "inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-700 to-orange-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(196,102,31,0.28)] transition hover:-translate-y-0.5";

export function TestRunner({
  test,
  candidateName,
  currentIndex,
  answers,
  timeLeft,
  onSelectQuestion,
  onSelectOption,
  onSkip,
  onMarkForReview,
  onClearResponse,
  onSubmit
}) {
  const question = test.questions[currentIndex];
  const answer = answers[question._id];
  const selectedOption = answer?.selectedOption || null;

  const answeredCount = Object.values(answers).filter((item) => item?.selectedOption).length;
  const reviewCount = Object.values(answers).filter(
    (item) => item?.status === "review" || item?.status === "review_answered"
  ).length;

  return (
    <section className="relative z-10 grid grid-cols-1 gap-6 xl:grid-cols-[330px_1fr]">
      <aside className="grid gap-5 self-start xl:sticky xl:top-6">
        <div className={panel}>
          <span className="inline-flex text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Candidate</span>
          <h3 className="mt-2 text-2xl font-bold text-stone-900">{candidateName || "Guest Candidate"}</h3>
          <div className="mt-5 rounded-3xl bg-gradient-to-br from-amber-700/15 to-emerald-800/10 p-5">
            <span className="block text-sm text-stone-600">Time left</span>
            <strong className="mt-1 block font-['Sora'] text-4xl font-bold text-stone-900">{formatTime(timeLeft)}</strong>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
              <strong className="block font-['Sora'] text-3xl text-stone-900">{answeredCount}</strong>
              <span className="text-sm text-stone-500">Answered</span>
            </div>
            <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
              <strong className="block font-['Sora'] text-3xl text-stone-900">{reviewCount}</strong>
              <span className="text-sm text-stone-500">Review</span>
            </div>
            <div className="rounded-3xl border border-stone-900/10 bg-white/70 p-4">
              <strong className="block font-['Sora'] text-3xl text-stone-900">{test.totalMarks}</strong>
              <span className="text-sm text-stone-500">Total marks</span>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            Scoring: +{formatScore(test.positiveMarks)} for correct and {formatScore(test.negativeMarks)} for incorrect.
          </p>
        </div>

        <div className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-stone-900">Question Palette</h3>
            <span className="text-sm text-stone-500">{test.totalQuestions} total</span>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {test.questions.map((item, index) => (
              <button
                key={item._id}
                className={`aspect-square rounded-2xl border text-sm font-bold transition hover:-translate-y-0.5 ${
                  currentIndex === index ? "border-amber-700" : "border-transparent"
                } ${getPaletteStatus(answers[item._id])}`}
                onClick={() => onSelectQuestion(index)}
                type="button"
              >
                {item.number}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="grid gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Question {question.number}</span>
            <h2 className="mt-2 font-['Sora'] text-3xl font-bold tracking-[-0.04em] text-stone-900">{question.subject}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={pill}>{question.difficulty}</span>
            <span className={pill}>Single Correct</span>
          </div>
        </div>

        <div className={panel}>
          <p className="text-2xl font-semibold leading-[1.55] text-stone-900">{question.prompt}</p>
          <div className="mt-6 grid gap-4">
            {question.options.map((option) => (
              <button
                key={option.key}
                className={`flex items-start gap-4 rounded-[22px] border px-5 py-4 text-left transition hover:-translate-y-0.5 ${
                  selectedOption === option.key
                    ? "border-amber-700 bg-amber-700/10"
                    : "border-stone-900/10 bg-white/80"
                }`}
                onClick={() => onSelectOption(question._id, option.key)}
                type="button"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-900/10 font-bold text-stone-900">
                  {option.key}
                </span>
                <span className="text-base leading-7 text-stone-700">{option.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={ghostButton} onClick={() => onClearResponse(question._id)} type="button">
            Clear Response
          </button>
          <button className={ghostButton} onClick={() => onSkip(question._id)} type="button">
            Skip
          </button>
          <button className={reviewButton} onClick={() => onMarkForReview(question._id)} type="button">
            Mark for Review
          </button>
          <button className={primaryButton} onClick={onSubmit} type="button">
            Submit Test
          </button>
        </div>
      </div>
    </section>
  );
}
