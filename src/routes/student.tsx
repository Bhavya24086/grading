import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, Clock, Award, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, dueStatus } from "@/lib/utils-format";

export const Route = createFileRoute("/student")({
  component: StudentDashboard,
});

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_points: number;
  file_url: string | null;
  file_name: string | null;
}

interface Submission {
  id: string;
  assignment_id: string;
  file_name: string;
  file_url: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  graded_at: string | null;
}

function StudentDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submitting, setSubmitting] = useState<Assignment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && role === "teacher") navigate({ to: "/teacher" });
  }, [user, role, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const [a, s] = await Promise.all([
      supabase.from("assignments").select("*").order("due_date", { ascending: true }),
      supabase.from("submissions").select("*").eq("student_id", user.id),
    ]);
    if (a.data) setAssignments(a.data);
    if (s.data) setSubmissions(s.data as Submission[]);
    setDataLoading(false);
  }, [user]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const submissionFor = (aid: string) => submissions.find((s) => s.assignment_id === aid);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!submitting || !user) return;
    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return toast.error("Please select a file");
    if (file.size > 20 * 1024 * 1024) return toast.error("File must be under 20 MB");

    setUploading(true);
    const path = `${user.id}/${submitting.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("submissions").upload(path, file);
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }

    const existing = submissionFor(submitting.id);
    const payload = {
      assignment_id: submitting.id,
      student_id: user.id,
      file_url: path,
      file_name: file.name,
      submitted_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("submissions").update(payload).eq("id", existing.id)
      : await supabase.from("submissions").insert(payload);

    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted!");
    setSubmitting(null);
    loadData();
  };

  const downloadAssignment = async (a: Assignment) => {
    if (!a.file_url) return;
    const { data } = await supabase.storage.from("assignments").createSignedUrl(a.file_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const downloadSubmission = async (s: Submission) => {
    const { data } = await supabase.storage.from("submissions").createSignedUrl(s.file_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const graded = submissions.filter((s) => s.grade !== null);
  const avgGrade = graded.length
    ? (graded.reduce((sum, s) => {
        const a = assignments.find((x) => x.id === s.assignment_id);
        return sum + (a ? (Number(s.grade) / a.max_points) * 100 : 0);
      }, 0) / graded.length).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-6 py-10 max-w-6xl">
        <div className="mb-10">
          <h1 className="font-display text-5xl mb-2">My coursework</h1>
          <p className="text-muted-foreground">Track deadlines, submit work, and see your grades.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <StatCard icon={FileText} label="Assignments" value={assignments.length} />
          <StatCard icon={CheckCircle2} label="Submitted" value={submissions.length} />
          <StatCard icon={Award} label="Average" value={avgGrade === "—" ? "—" : `${avgGrade}%`} />
        </div>

        <div className="space-y-3">
          {assignments.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              No assignments yet. Check back soon.
            </Card>
          )}
          {assignments.map((a) => {
            const sub = submissionFor(a.id);
            const status = dueStatus(a.due_date);
            return (
              <Card key={a.id} className="p-6 hover:shadow-[var(--shadow-card)] transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-display text-2xl">{a.title}</h3>
                      {sub?.grade !== null && sub?.grade !== undefined ? (
                        <Badge className="bg-success text-success-foreground">Graded</Badge>
                      ) : sub ? (
                        <Badge variant="secondary">Submitted</Badge>
                      ) : (
                        <Badge variant={status.tone === "late" ? "destructive" : status.tone === "soon" ? "default" : "outline"}>
                          <Clock className="h-3 w-3 mr-1" /> {status.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{a.description}</p>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Due {formatDateTime(a.due_date)}</span>
                      <span>{a.max_points} pts</span>
                      {sub && <span>Submitted {formatDateTime(sub.submitted_at)}</span>}
                    </div>

                    {sub?.grade !== null && sub?.grade !== undefined && (
                      <div className="mt-4 p-4 rounded-md bg-secondary/60 border border-border">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="font-display text-3xl text-accent">{Number(sub.grade)}</span>
                          <span className="text-muted-foreground">/ {a.max_points}</span>
                        </div>
                        {sub.feedback && (
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            <span className="font-medium">Feedback: </span>{sub.feedback}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 md:items-end shrink-0">
                    {a.file_url && (
                      <Button variant="outline" size="sm" onClick={() => downloadAssignment(a)}>
                        <Download className="h-4 w-4 mr-1.5" />
                        Brief
                      </Button>
                    )}
                    {sub && (
                      <Button variant="ghost" size="sm" onClick={() => downloadSubmission(sub)}>
                        <FileText className="h-4 w-4 mr-1.5" />
                        My file
                      </Button>
                    )}
                    {(!sub || sub.grade === null) && (
                      <Button size="sm" onClick={() => setSubmitting(a)}>
                        <Upload className="h-4 w-4 mr-1.5" />
                        {sub ? "Resubmit" : "Submit"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      <Dialog open={!!submitting} onOpenChange={(o) => !o && setSubmitting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Submit assignment</DialogTitle>
            <DialogDescription>{submitting?.title}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Upload file (PDF, DOCX — max 20MB)</Label>
              <Input id="file" name="file" type="file" required accept=".pdf,.doc,.docx,.txt,.zip,.png,.jpg,.jpeg" />
            </div>
            <Button type="submit" className="w-full" disabled={uploading}>
              {uploading ? "Uploading…" : "Submit work"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number | string }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className="h-11 w-11 rounded-md bg-accent/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-2xl">{value}</div>
      </div>
    </Card>
  );
}
