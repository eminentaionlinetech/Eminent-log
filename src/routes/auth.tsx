import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: s.mode === "register" || s.mode === "forgot" ? s.mode : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Log in or register — EMINENT LOG" },
      { name: "description", content: "Log in to EMINENT LOG or create a free account to start learning." },
      { property: "og:title", content: "Log in or register — EMINENT LOG" },
      { property: "og:description", content: "Create a free EMINENT LOG account." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);
const pwSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(initial ?? "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => setMode(initial ?? "login"), [initial]);
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(fd.get("email"));
    if (!email.success) return setError(email.error.issues[0].message);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice("If an account exists for that email, a password reset link is on its way.");
        return;
      }
      const pw = pwSchema.safeParse(fd.get("password"));
      if (!pw.success) return setError(pw.error.issues[0].message);
      if (mode === "register") {
        const name = z.string().trim().min(1, "Enter your name").max(100).safeParse(fd.get("full_name"));
        if (!name.success) return setError(name.error.issues[0].message);
        const { data, error } = await supabase.auth.signUp({
          email: email.data,
          password: pw.data,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.data } },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your email to confirm your account, then log in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: pw.data });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) setError("Google sign-in failed. Please try again.");
  }

  const title = mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back";

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6">
      <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "register" ? "Start learning on EMINENT LOG." : mode === "forgot" ? "We'll email you a reset link." : "Log in to continue learning."}
        </p>

        {mode !== "forgot" && (
          <>
            <Button type="button" variant="outline" className="mt-6 h-11 w-full" onClick={google}>
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          </>
        )}

        <form onSubmit={onSubmit} className={mode === "forgot" ? "mt-6 space-y-4" : "space-y-4"} noValidate>
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" autoComplete="name" required maxLength={100} className="h-11" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button type="button" className="text-xs font-medium text-primary" onClick={() => setMode("forgot")}>Forgot password?</button>
                )}
              </div>
              <Input id="password" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required className="h-11" />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="rounded-md bg-accent p-3 text-sm text-accent-foreground">{notice}</p>}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Log in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "register" ? (
            <>Already have an account? <Link to="/auth" className="font-medium text-primary">Log in</Link></>
          ) : mode === "forgot" ? (
            <button className="font-medium text-primary" onClick={() => setMode("login")}>Back to log in</button>
          ) : (
            <>New to EMINENT LOG? <Link to="/auth" search={{ mode: "register" }} className="font-medium text-primary">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
