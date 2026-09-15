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
  // Six of the seven people on the family list have never made an account,
  // and the thing standing in the way is a shared password somebody has to
  // be told out of band. The emailed link needs nothing anyone has to
  // remember, so it leads; the password is still here for whoever knows it.
  const [usePassword, setUsePassword] = useState(false);

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
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Enter your email first.");
      return;
    }
    setWorking(true);
    setError(null);

    // The allowlist check is not optional here. signInWithOtp creates an
    // account for an unknown address by default, and this path used to skip
    // the check the password path does — so anyone at all could make an
    // account on the family's project, and make it send them email. They
    // could never write anything (is_family gates every write policy on the
    // allowlist), but accounts for people outside the family are explicitly
    // not something this site does.
    const { data: allowed, error: checkError } = await supabase.rpc(
      "email_allowed",
      { check_email: cleanEmail }
    );
    if (checkError || !allowed) {
      setWorking(false);
      setError(
        checkError
          ? checkError.message
          : "This email is not on the family list. Ask Sahil to add it."
      );
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
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
        <div className="rounded-xl border border-accent/25 bg-accent-soft p-4">
          <p className="font-medium text-accent-dark">Check your email</p>
          <p className="mt-1 text-sm text-ink-soft">
            We sent a sign-in link to <strong>{email.trim()}</strong>. Open it
            on this device and you're in — there's no password to set.
          </p>
          <button
            type="button"
            onClick={() => setLinkSent(false)}
            className="mt-3 inline-flex min-h-6 items-center text-sm text-accent-dark underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (usePassword) signIn(e);
            else sendMagicLink();
          }}
          className="space-y-4"
        >
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

          {usePassword && (
            <div>
              <Label htmlFor="password">Family password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={working}>
            {working
              ? usePassword
                ? "Signing in…"
                : "Sending…"
              : usePassword
                ? "Sign in"
                : "Email me a sign-in link"}
          </Button>

          {!usePassword && (
            <p className="text-sm text-ink-soft">
              No password needed. We'll email you a link that signs you in —
              works the first time too, as long as your address is on the
              family list.
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setUsePassword(!usePassword);
              setError(null);
            }}
            className="min-h-6 w-full text-center text-sm text-accent-dark underline"
          >
            {usePassword
              ? "Email me a link instead"
              : "I know the family password"}
          </button>
        </form>
      )}
    </main>
  );
}
