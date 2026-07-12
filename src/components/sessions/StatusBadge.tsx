const styles: Record<string, string> = {
  RECRUITING: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  ONGOING: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  FINISHED: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
};

export const STATUS_LABELS: Record<string, string> = {
  RECRUITING: "募集中",
  ONGOING: "進行中",
  FINISHED: "終了",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${styles[status] ?? ""}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
