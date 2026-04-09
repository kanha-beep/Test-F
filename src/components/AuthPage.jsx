import { useState } from "react";

const cardBase = "rounded-[28px] border border-slate-900/10 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl";
const primaryButton = "inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";
const secondaryButton = "inline-flex items-center justify-center rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:opacity-40";

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

export function AuthPage({ authUser, authChecking, selectedExamTypes, onRegister, onLogin, onLogout, onSavePreferences }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  if (authChecking) return <div className={cardBase}><p className="text-sm text-slate-600">Checking session...</p></div>;
  if (authUser) {
    return <div className={`${cardBase} space-y-4`}><SectionHeader eyebrow="Auth" title="Signed in" description="Your preferences decide which exam libraries are highlighted after login." /><p className="text-sm text-slate-600">{authUser.displayName} � {authUser.email} � {authUser.role}</p><div className="flex flex-wrap gap-2">{(authUser.preferredExamTypes || []).map((exam) => <span key={exam} className="rounded-full bg-slate-900/10 px-3 py-1 text-xs text-slate-900">{exam}</span>)}</div><div className="flex flex-wrap gap-2"><button type="button" className={secondaryButton} onClick={() => onSavePreferences(selectedExamTypes)}>Save selected exam preferences</button><button type="button" className={secondaryButton} onClick={onLogout}>Log out</button></div></div>;
  }

  return (
    <div className={`${cardBase} space-y-4`}>
      <SectionHeader eyebrow="Auth" title="Sign in after exam selection" description="Choose one or more exams first, then create your account or sign in to unlock your filtered dashboard." />
      <div className="flex gap-2"> <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "login" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setMode("login")}>Log in</button><button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setMode("register")}>Register</button></div>
      {mode === "register" ? <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-3 outline-none focus:border-slate-900" placeholder="Display name" /> : null}
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-3 outline-none focus:border-slate-900" placeholder="Email" />
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-3xl border border-slate-900/10 bg-white/80 px-5 py-3 outline-none focus:border-slate-900" placeholder="Password" />
      <button type="button" className={primaryButton} onClick={() => mode === "register" ? onRegister({ email, password, displayName, preferredExamTypes: selectedExamTypes }) : onLogin({ email, password })}>{mode === "register" ? "Create account" : "Log in"}</button>
    </div>
  );
}
