import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function SignIn() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    navigate("/");
    return null;
  }

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      <h1 className="mb-2 text-2xl">Sign in</h1>
      <p className="mb-6 text-ink-soft">
        Anyone can browse. Adding or editing recipes requires a family
        sign-in — enter your email and we send a magic link.
      </p>

      {sent ? (
        <div className="rounded-xl bg-paper-warm p-4">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-ink-soft">
            We sent a sign-in link to {email}. Open it on this device.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="space-y-4">
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
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={sending}>
            {sending ? "Sending…" : "Send magic link"}
          </Button>
          <p className="text-xs text-ink-faint">
            Note: only email addresses on the family list can add or edit
            recipes after signing in.
          </p>
        </form>
      )}
    </main>
  );
}
