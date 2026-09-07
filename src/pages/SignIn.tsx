import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function SignIn() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  // Redirect declaratively — calling navigate() in the render body updates
  // the router while React is rendering.
  if (session) return <Navigate to="/" replace />;

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    const cleanEmail = email.trim().toLowerCase();

    // 1. Normal password sign-in.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (!signInError) {
      navigate("/");
      return;
    }

    if (!/invalid login credentials/i.test(signInError.message)) {
      setError(signInError.message);
      setWorking(false);
      return;
    }

    // 2. No account (or wrong password). Only family emails may register,
    //    so check the allowlist before attempting to create an account.
    const { data: allowed } = await supabase.rpc("email_allowed", {
      check_email: cleanEmail,
    });
    if (!allowed) {
      setError(
        "This email is not on the family list. Ask the site owner to add it."
      );
      setWorking(false);
      return;
    }

    // 3. First sign-in for a family member: create the account.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email: cleanEmail,
        password,
      }
    );
    if (signUpError) {
      setError(
        /already registered/i.test(signUpError.message)
          ? "That password doesn't match this account. Use the family password, or send yourself a magic link below."
          : signUpError.message
      );
      setWorking(false);
      return;
    }
    if (signUpData.session) {
      navigate("/");
      return;
    }
    // No session and no error means one of two things, and Supabase
    // deliberately doesn't say which: either the address already has an
    // account (so the password was simply wrong), or confirmation email is
    // still switched on. Cover both rather than claiming an account was made.
    setError(
      "That didn't sign you in. If you already have an account the password was wrong — use the family password, or send yourself a magic link below. If this is your first time, check your email for a confirmation link."
    );
    setWorking(false);
  };

  const sendMagicLink = async () => {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setWorking(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setWorking(false);
    if (error) setError(error.message);
    else setLinkSent(true);
  };

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      <h1 className="mb-2 text-2xl">Sign in</h1>
      <p className="mb-6 text-ink-soft">
        Anyone can browse. Adding or editing recipes requires a family
        sign-in.
      </p>

      {linkSent ? (
        <div className="rounded-xl bg-paper-warm p-4">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-ink-soft">
            We sent a sign-in link to {email}. Open it on this device.
          </p>
        </div>
      ) : (
        <form onSubmit={signIn} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Family password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={working}>
            {working ? "Signing in…" : "Sign in"}
          </Button>
          <button
            type="button"
            onClick={sendMagicLink}
            disabled={working}
            className="w-full text-center text-sm text-accent underline"
          >
            Email me a sign-in link instead
          </button>
          <p className="text-xs text-ink-faint">
            First time here? Enter your email and the family password — your
            account is created automatically if your email is on the family
            list.
          </p>
        </form>
      )}
    </main>
  );
}
