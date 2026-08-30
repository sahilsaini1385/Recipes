import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-sm px-4 pt-14">
        <h1 className="text-center font-serif text-3xl font-semibold">
          Sign in
        </h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          We&rsquo;ll email you a magic link — no password needed.
        </p>
        {sent ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-paper-deep bg-white p-6 text-center shadow-card">
            <MailCheck className="text-accent" size={28} />
            <p className="font-medium">Check your email</p>
            <p className="text-sm text-ink-soft">
              Open the link we sent to <strong>{email}</strong> on this device.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-3 rounded-2xl border border-paper-deep bg-white p-5 shadow-card"
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Email me a sign-in link"
              )}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-ink-soft hover:text-ink">
            ← Back home
          </Link>
        </p>
      </main>
    </div>
  );
}
