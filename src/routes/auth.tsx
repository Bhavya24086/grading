import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
  role: z.enum(["student", "teacher"]),
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password required"),
  role: z.enum(["student", "teacher"]),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: role === "teacher" ? "/teacher" : "/student" });
    }
  }, [user, role, loading, navigate]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      password: fd.get("password"),
      role: fd.get("role"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName, role: parsed.data.role },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created! Redirecting…");
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      role: fd.get("role"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user!.id)
      .maybeSingle();
    const actualRole = (roleRow?.role as "student" | "teacher" | undefined) ?? "student";
    if (actualRole !== parsed.data.role) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error(`This account is registered as a ${actualRole}. Please switch tabs.`);
      return;
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-sidebar-foreground" style={{ background: "var(--gradient-hero)" }}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-md bg-sidebar-foreground/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl">Scholar</span>
        </Link>
        <div>
          <h2 className="font-display text-5xl leading-tight max-w-md">
            "A well-graded paper is a conversation, not a verdict."
          </h2>
          <p className="mt-4 text-sidebar-foreground/70 text-sm">— A teacher, somewhere</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50 uppercase tracking-widest">
          Online submissions · Real feedback
        </p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl">Scholar</span>
          </Link>

          <h1 className="font-display text-4xl mb-2">Welcome</h1>
          <p className="text-muted-foreground mb-8">Sign in or create an account to continue.</p>

          <Tabs defaultValue="signup">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Sign in as…</Label>
                  <RadioGroup name="role" defaultValue="student" className="grid grid-cols-2 gap-2">
                    <Label htmlFor="l-student" className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5">
                      <RadioGroupItem id="l-student" value="student" />
                      <span className="text-sm">Student</span>
                    </Label>
                    <Label htmlFor="l-teacher" className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5">
                      <RadioGroupItem id="l-teacher" value="teacher" />
                      <span className="text-sm">Teacher</span>
                    </Label>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input id="signup-name" name="fullName" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label>I am a…</Label>
                  <RadioGroup name="role" defaultValue="student" className="grid grid-cols-2 gap-2">
                    <Label htmlFor="r-student" className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5">
                      <RadioGroupItem id="r-student" value="student" />
                      <span className="text-sm">Student</span>
                    </Label>
                    <Label htmlFor="r-teacher" className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5">
                      <RadioGroupItem id="r-teacher" value="teacher" />
                      <span className="text-sm">Teacher</span>
                    </Label>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
