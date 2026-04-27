export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function dueStatus(due: string): { label: string; tone: "ok" | "soon" | "late" } {
  const now = Date.now();
  const dueMs = new Date(due).getTime();
  const diff = dueMs - now;
  if (diff < 0) return { label: "Past due", tone: "late" };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return { label: "Due today", tone: "soon" };
  if (days < 3) return { label: `${days}d left`, tone: "soon" };
  return { label: `${days}d left`, tone: "ok" };
}
