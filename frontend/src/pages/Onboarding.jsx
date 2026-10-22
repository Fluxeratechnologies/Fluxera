import React, { useState } from "react";
import { API_BASE, apiPost } from "../api";

function sdkFor(key) {
  return {
    node: `const fluxera = require('@fluxera/sdk')('${key}')`,
    python: `import fluxera\nfluxera.init('${key}')`,
  };
}

function existingMint(session) {
  if (!session || session.isDemo || !session.apiKey?.startsWith("fx_")) return null;
  return { key: session.apiKey, company: session.company || "Your institute", ...sdkFor(session.apiKey) };
}

export function Onboarding({ onLogin, go, initialEmail = "", session }) {
  const [email, setEmail] = useState(initialEmail);
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [minted, setMinted] = useState(() => existingMint(session));
  const [copied, setCopied] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!email.includes("@")) {
      setErr("Enter a valid email address.");
      return;
    }
    if (!company.trim()) {
      setErr("Enter an institute or organization name.");
      return;
    }
    setLoading(true);
    try {
      const r = await apiPost("/api/signup", null, { email, company: company.trim() });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) throw new Error(j.error || "This email already has an institute. Sign in with your fx_ key.");
      if (!r.ok) throw new Error(j.error || "Couldn't create the institute.");
      const key = j.customer?.api_key;
      if (!key) throw new Error("Signup did not return an institute key.");
      const next = { email: j.customer.email, company: j.customer.company, apiKey: key, isDemo: false };
      onLogin(next);
      setMinted({
        key,
        company: j.customer.company,
        node: j.sdk_config?.node || sdkFor(key).node,
        python: j.sdk_config?.python || sdkFor(key).python,
      });
    } catch (e) {
      const offline = e instanceof TypeError && /fetch|network|load/i.test(e.message || "");
      setErr(offline ? "Couldn't reach " + API_BASE : e.message);
    }
    setLoading(false);
  }

  async function copy() {
    if (!minted?.key) return;
    try {
      await navigator.clipboard.writeText(minted.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Couldn't copy to clipboard. Select the key and copy it.");
    }
  }

  if (minted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-8 pt-24">
        <div className="relative z-10 max-w-xl w-full glass-card p-8 sm:p-10 rounded-3xl shadow-card-glass border border-rosebrand-100 bg-white text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              Institute activated
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Your Fluxera key is ready
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
            <strong className="text-slate-800">{minted.company}</strong> has one key. It signs in to this dashboard and authenticates the SDK. Fluxera does not rotate it.
          </p>

          <label className="block text-xs font-semibold text-slate-700 mb-2">Institute API key</label>
          <div className="flex gap-2 mb-6 flex-wrap sm:flex-nowrap">
            <input
              readOnly
              value={minted.key}
              className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono bg-slate-50 text-slate-900 select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className="glass-pill px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-700 hover:bg-white border border-slate-200 cursor-pointer"
            >
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-700 mb-2">SDK</p>
          <div className="space-y-3 mb-8">
            <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">{minted.node}</pre>
            <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">{minted.python}</pre>
          </div>

          <button
            type="button"
            onClick={() => go("overview")}
            className="shimmer-btn text-white text-sm font-semibold px-7 py-3 rounded-full inline-flex items-center justify-center shadow-glow-rose cursor-pointer border-0 w-full"
          >
            Open dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-8 pt-24">
      <div className="relative z-10 w-full max-w-md glass-card p-8 sm:p-10 rounded-3xl shadow-card-glass border border-rosebrand-100 bg-white text-left">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rosebrand-600 to-rosebrand-400 flex items-center justify-center text-white shadow-md mb-6 font-mono font-bold">
          fx
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Create an institute</h1>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          One Fluxera key per institute. Use it to sign in and to wrap your API calls.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@institute.edu"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-rosebrand-400 focus:outline-none focus:ring-2 focus:ring-rosebrand-100 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Institute name</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Somaiya"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-rosebrand-400 focus:outline-none focus:ring-2 focus:ring-rosebrand-100 bg-white"
            />
          </div>

          {err && (
            <p className="text-xs text-rosebrand-700 bg-rosebrand-50 p-3 rounded-xl border border-rosebrand-200">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="shimmer-btn text-white text-sm font-semibold py-3 rounded-full mt-2 cursor-pointer border-0 shadow-glow-rose disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create institute and get key"}
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-5">
          Already have a key?{" "}
          <button
            type="button"
            onClick={() => go(session?.isDemo ? "settings" : "overview")}
            className="font-semibold text-slate-900 cursor-pointer bg-transparent border-0 p-0 text-xs"
          >
            {session?.isDemo ? "Paste it in settings" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
