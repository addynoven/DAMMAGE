"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    let res: Response;
    let data: { error?: string } = {};

    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      data = await res.json();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email, password, callbackUrl: "/" });
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">

        <div className="mb-10">
          <h1 className="font-display text-[48px] font-black italic text-mint-fg uppercase leading-none tracking-tight mb-2">
            DAMMAGE
          </h1>
          <p className="text-[11px] font-light text-secondary-text uppercase tracking-[1.9px]">
            Create your account
          </p>
        </div>

        <div className="bg-surface-slate border border-image-frame rounded-[20px] p-8 flex flex-col gap-6">

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 border border-image-frame rounded-[12px] px-4 py-3 text-[13px] font-semibold text-foreground hover:bg-foreground/5 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-image-frame" />
            <span className="text-[11px] text-secondary-text uppercase tracking-[1.5px]">or</span>
            <div className="flex-1 h-px bg-image-frame" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
                className="bg-canvas border border-image-frame rounded-[10px] px-4 py-3 text-[13px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="bg-canvas border border-image-frame rounded-[10px] px-4 py-3 text-[13px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 chars, include a number or symbol"
                className="bg-canvas border border-image-frame rounded-[10px] px-4 py-3 text-[13px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat your password"
                className="bg-canvas border border-image-frame rounded-[10px] px-4 py-3 text-[13px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint transition-colors"
              />
            </div>

            {error && (
              <p className="text-[12px] text-destructive font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-mint text-black font-bold text-[13px] uppercase tracking-[0.12em] px-4 py-3 rounded-[12px] hover:bg-foreground hover:text-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-secondary-text mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-mint-fg hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
