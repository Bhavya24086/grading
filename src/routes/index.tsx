import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, FileCheck2, GraduationCap, ClipboardList } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: role === "teacher" ? "/teacher" : "/student" });
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      <main className="flex-1">
        <section className="container mx-auto px-6 pt-24 pb-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/50 text-xs font-medium text-muted-foreground mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Online assignment platform
            </div>
            <h1 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight">
              The modern way to <em className="text-accent">submit</em> and{" "}
              <em className="text-accent">grade</em> coursework.
            </h1>
            <p className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Scholar is a quiet, focused workspace for students and teachers — submit
              files, leave feedback, track deadlines, and never lose a paper to email
              again.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-6 text-base">
                  Get started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-secondary/30">
          <div className="container mx-auto px-6 py-24">
            <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
              {[
                {
                  icon: ClipboardList,
                  title: "Post assignments",
                  body: "Teachers upload prompts and supporting files with clear deadlines and point values.",
                },
                {
                  icon: FileCheck2,
                  title: "Submit your work",
                  body: "Students upload PDFs and documents directly. Late submissions are flagged automatically.",
                },
                {
                  icon: GraduationCap,
                  title: "Grade and review",
                  body: "Leave a grade and written feedback. Students see results the moment they're ready.",
                },
              ].map((f) => (
                <div key={f.title} className="bg-background p-10">
                  <f.icon className="h-7 w-7 text-accent mb-6" strokeWidth={1.5} />
                  <h3 className="font-display text-2xl mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Scholar. An academic submission platform.
        </div>
      </footer>
    </div>
  );
}
