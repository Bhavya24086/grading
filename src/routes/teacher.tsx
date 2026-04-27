import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, FileText, Users, ClipboardCheck, Download, Trash2, Pencil } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils-format";

export const Route = createFileRoute("/teacher")({
  component: TeacherDashboard,
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

interface SubmissionWithStudent {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string;
  file_name: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  student_name?: string;
  student_email?: string;
}

const assignmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  due_date: z.string().min(1),
  max_points: z.number().int().min(1).max(1000),
});

function TeacherDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [grading, setGrading] = useState<{ submission: SubmissionWithStudent; assignment: Assignment } | null>(null);
  const [viewing, setViewing] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && role === "student") navigate({ to: "/student" });
  }, [user, role, loading, navigate]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const [a, s, p] = await Promise.all([
      supabase.from("assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("submissions").select("*").order("submitted_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    if (a.data) setAssignments(a.data);
    if (s.data && p.data) {
      const profMap = new Map(p.data.map((x) => [x.id, x]));
      setSubmissions(
        s.data.map((sub) => ({
          ...sub,
          student_name: profMap.get(sub.student_id)?.full_name,
          student_email: profMap.get(sub.student_id)?.email,
        })) as SubmissionWithStudent[]
      );
    }
    setDataLoading(false);
  }, []);

  useEffect(() => { if (user && role === "teacher") loadData(); }, [user, role, loadData]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = assignmentSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description"),
      due_date: fd.get("due_date"),
      max_points: Number(fd.get("max_points")),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setBusy(true);
    let file_url: string | null = null;
    let file_name: string | null = null;
    const file = (fd.get("file") as File) || null;
    if (file && file.size > 0) {
      if (file.size > 20 * 1024 * 1024) {
        setBusy(false);
        return toast.error("File too large (max 20MB)");
      }
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("assignments").upload(path, file);
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
      file_url = path;
      file_name = file.name;
    }

    const { error } = await supabase.from("assignments").insert({
      ...parsed.data,
      due_date: new Date(parsed.data.due_date).toISOString(),
      file_url,
      file_name,
      created_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Assignment posted");
    setCreating(false);
    loadData();
  };

  const handleGrade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!grading || !user) return;
    const fd = new FormData(e.currentTarget);
    const grade = Number(fd.get("grade"));
    const feedback = String(fd.get("feedback") || "").trim().slice(0, 2000);
    if (Number.isNaN(grade) || grade < 0 || grade > grading.assignment.max_points) {
      return toast.error(`Grade must be 0-${grading.assignment.max_points}`);
    }
    setBusy(true);
    const { error } = await supabase
      .from("submissions")
      .update({ grade, feedback, graded_at: new Date().toISOString(), graded_by: user.id })
      .eq("id", grading.submission.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Graded");
    setGrading(null);
    loadData();
  };

  const deleteAssignment = async (id: string) => {
    if (!confirm("Delete this assignment and all its submissions?")) return;
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadData();
  };

  const downloadFile = async (bucket: "assignments" | "submissions", path: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
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

  const ungraded = submissions.filter((s) => s.grade === null);
  const submissionsFor = (aid: string) => submissions.filter((s) => s.assignment_id === aid);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-6 py-10 max-w-6xl">
        <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
          <div>
            <h1 className="font-display text-5xl mb-2">Teaching dashboard</h1>
            <p className="text-muted-foreground">Post assignments and grade student work.</p>
          </div>
          <Button onClick={() => setCreating(true)} size="lg">
            <Plus className="h-4 w-4 mr-1.5" /> New assignment
          </Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <StatCard icon={FileText} label="Assignments" value={assignments.length} />
          <StatCard icon={Users} label="Submissions" value={submissions.length} />
          <StatCard icon={ClipboardCheck} label="Awaiting grade" value={ungraded.length} accent={ungraded.length > 0} />
        </div>

        <h2 className="font-display text-3xl mb-4">Assignments</h2>
        <div className="space-y-3">
          {assignments.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              No assignments yet. Click "New assignment" to create one.
            </Card>
          )}
          {assignments.map((a) => {
            const subs = submissionsFor(a.id);
            const ungradedCount = subs.filter((s) => s.grade === null).length;
            return (
              <Card key={a.id} className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-display text-2xl">{a.title}</h3>
                      <Badge variant="outline">{a.max_points} pts</Badge>
                      {ungradedCount > 0 && <Badge>{ungradedCount} to grade</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{a.description}</p>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                      <span>Due {formatDateTime(a.due_date)}</span>
                      <span>{subs.length} submission{subs.length !== 1 && "s"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setViewing(a)}>
                      <Pencil className="h-4 w-4 mr-1.5" /> Submissions
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteAssignment(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Create assignment dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">New assignment</DialogTitle>
            <DialogDescription>Post a brief, set a deadline, and let students submit.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={4} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due date</Label>
                <Input id="due_date" name="due_date" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_points">Max points</Label>
                <Input id="max_points" name="max_points" type="number" defaultValue={100} min={1} max={1000} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Brief file (optional)</Label>
              <Input id="file" name="file" type="file" accept=".pdf,.doc,.docx,.txt" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Posting…" : "Post assignment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* View submissions dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{viewing?.title}</DialogTitle>
            <DialogDescription>Submissions ({viewing ? submissionsFor(viewing.id).length : 0})</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {viewing && submissionsFor(viewing.id).length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No submissions yet.</p>
            )}
            {viewing && submissionsFor(viewing.id).map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.student_name || s.student_email || "Student"}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(s.submitted_at)}</div>
                    <div className="text-xs text-muted-foreground truncate mt-1">{s.file_name}</div>
                    {s.grade !== null && (
                      <div className="mt-2 text-sm">
                        <span className="text-accent font-medium">{Number(s.grade)} / {viewing.max_points}</span>
                        {s.feedback && <span className="text-muted-foreground"> — {s.feedback}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => downloadFile("submissions", s.file_url)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => setGrading({ submission: s, assignment: viewing })}>
                      {s.grade !== null ? "Edit" : "Grade"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade dialog */}
      <Dialog open={!!grading} onOpenChange={(o) => !o && setGrading(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Grade submission</DialogTitle>
            <DialogDescription>
              {grading?.submission.student_name} — {grading?.assignment.title}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGrade} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grade">Grade (out of {grading?.assignment.max_points})</Label>
              <Input
                id="grade" name="grade" type="number" step="0.5" min={0}
                max={grading?.assignment.max_points}
                defaultValue={grading?.submission.grade ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea id="feedback" name="feedback" rows={5} maxLength={2000} defaultValue={grading?.submission.feedback ?? ""} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Save grade"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof FileText; label: string; value: number | string; accent?: boolean }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-md flex items-center justify-center ${accent ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent"}`}>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-2xl">{value}</div>
      </div>
    </Card>
  );
}
