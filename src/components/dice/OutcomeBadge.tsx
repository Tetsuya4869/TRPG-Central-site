const styles: Record<string, string> = {
  CRITICAL: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  SUCCESS: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  FAILURE: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
  FUMBLE: "bg-red-500/20 text-red-300 border-red-500/50",
};

const labels: Record<string, string> = {
  CRITICAL: "クリティカル!",
  SUCCESS: "成功",
  FAILURE: "失敗",
  FUMBLE: "ファンブル!",
};

export function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${styles[outcome] ?? ""}`}
    >
      {labels[outcome] ?? outcome}
    </span>
  );
}
