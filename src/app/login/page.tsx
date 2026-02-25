"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Invalid username or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="font-display text-2xl font-semibold text-gradient mb-1.5"
          >
            Nifty Breakout Scanner
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Sign in to continue
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--surface-border)",
            boxShadow:
              "0 4px 32px -4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Username */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: "var(--surface-overlay)",
                border: "1px solid var(--surface-border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--surface-border)")
              }
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: "var(--surface-overlay)",
                border: "1px solid var(--surface-border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--surface-border)")
              }
            />
          </div>

          {/* Error */}
          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{
                color: "var(--danger)",
                background: "var(--danger-muted)",
                border: "1px solid rgba(255, 71, 87, 0.2)",
              }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200"
            style={{
              background: loading ? "var(--accent-dim)" : "var(--accent)",
              color: "#08090d",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
