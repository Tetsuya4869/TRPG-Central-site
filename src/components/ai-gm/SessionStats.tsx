"use client";

// プレイ統計ビュー。外部ライブラリなしのインラインSVG。
// 系列色はdatavizバリデータ検証済み (zinc-900面・CVD分離・コントラスト全PASS)。
import { useCallback, useEffect, useState } from "react";

const SERIES = ["#3987e5", "#199e70", "#c98500", "#9085e9"];
const GRID = "#3f3f46"; // zinc-700
const TEXT = "#a1a1aa"; // zinc-400

interface SanPoint {
  index: number;
  san: number;
}

interface SessionStatsData {
  summary: {
    totalChecks: number;
    successes: number;
    criticals: number;
    fumbles: number;
  };
  histogram: number[];
  sanSeries: { characterId: string; name: string; points: SanPoint[] }[];
  skillStats: { name: string; tries: number; successes: number }[];
}

function SanLineChart({ series }: { series: SessionStatsData["sanSeries"] }) {
  const active = series.filter((s) => s.points.length > 0);
  if (active.length === 0) {
    return (
      <p className="text-xs text-zinc-600">
        このセッションにはSANチェックの記録がありません
      </p>
    );
  }
  const W = 420;
  const H = 150;
  const PAD = { l: 30, r: 8, t: 8, b: 20 };
  const maxX = Math.max(...active.map((s) => s.points.length));
  const allSan = active.flatMap((s) => s.points.map((p) => p.san));
  const yMax = Math.max(...allSan) + 5;
  const yMin = Math.max(0, Math.min(...allSan) - 5);
  const x = (i: number) =>
    PAD.l + ((W - PAD.l - PAD.r) * (maxX <= 1 ? 0.5 : (i - 1) / (maxX - 1)));
  const y = (san: number) =>
    PAD.t + (H - PAD.t - PAD.b) * (1 - (san - yMin) / Math.max(1, yMax - yMin));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="SAN推移">
        {/* 目盛り (控えめなグリッド) */}
        {[yMin, Math.round((yMin + yMax) / 2), yMax].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="0.5" />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill={TEXT}>
              {v}
            </text>
          </g>
        ))}
        {active.map((s, si) => {
          const color = SERIES[si % SERIES.length];
          const path = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.index)},${y(p.san)}`)
            .join(" ");
          return (
            <g key={s.characterId}>
              <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              {s.points.map((p) => (
                <circle key={p.index} cx={x(p.index)} cy={y(p.san)} r="3" fill={color} stroke="#18181b" strokeWidth="1.5">
                  <title>{`${s.name}: SANチェック${p.index}回目 → SAN ${p.san}`}</title>
                </circle>
              ))}
              {/* 直接ラベル (最終点の横) */}
              <text
                x={x(s.points[s.points.length - 1].index) - 6}
                y={y(s.points[s.points.length - 1].san) - 6}
                fontSize="8"
                fill={TEXT}
                textAnchor="end"
              >
                {s.name} {s.points[s.points.length - 1].san}
              </text>
            </g>
          );
        })}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="8" fill={TEXT}>
          SANチェック回数 →
        </text>
      </svg>
      {active.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-1">
          {active.map((s, si) => (
            <span key={s.characterId} className="flex items-center gap-1 text-xs text-zinc-400">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: SERIES[si % SERIES.length] }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Histogram({ data }: { data: number[] }) {
  const W = 420;
  const H = 130;
  const PAD = { l: 8, r: 8, t: 12, b: 18 };
  const max = Math.max(1, ...data);
  const barW = (W - PAD.l - PAD.r) / 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="出目分布">
      {data.map((count, i) => {
        const h = ((H - PAD.t - PAD.b) * count) / max;
        const bx = PAD.l + i * barW;
        const by = H - PAD.b - h;
        return (
          <g key={i}>
            <rect
              x={bx + 2}
              y={by}
              width={barW - 4}
              height={h}
              rx="3"
              fill="#3987e5"
            >
              <title>{`${i * 10 + 1}〜${(i + 1) * 10}: ${count}回`}</title>
            </rect>
            {count > 0 && (
              <text x={bx + barW / 2} y={by - 3} textAnchor="middle" fontSize="8" fill={TEXT}>
                {count}
              </text>
            )}
            <text
              x={bx + barW / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize="7"
              fill={TEXT}
            >
              {(i + 1) * 10}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SkillBars({ skills }: { skills: SessionStatsData["skillStats"] }) {
  if (skills.length === 0) {
    return <p className="text-xs text-zinc-600">技能判定の記録がありません</p>;
  }
  return (
    <div className="space-y-1.5">
      {skills.map((s) => {
        const rate = s.tries > 0 ? s.successes / s.tries : 0;
        return (
          <div key={s.name} className="flex items-center gap-2 text-xs">
            <span className="w-24 truncate text-zinc-400">{s.name}</span>
            <span
              className="h-3 flex-1 rounded-sm bg-zinc-800 overflow-hidden"
              title={`${s.name}: ${s.successes}/${s.tries} 成功`}
            >
              <span
                className="block h-full rounded-sm"
                style={{ width: `${rate * 100}%`, background: "#199e70" }}
              />
            </span>
            <span className="w-20 text-right font-mono text-zinc-400">
              {Math.round(rate * 100)}% ({s.successes}/{s.tries})
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SessionStats({ sessionId }: { sessionId: string }) {
  const [stats, setStats] = useState<SessionStatsData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/ai-gm/sessions/${sessionId}/stats`);
    if (!res.ok) {
      setError("統計の取得に失敗しました");
      return;
    }
    setStats(await res.json());
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-xs text-red-300">{error}</p>;
  if (!stats) return <p className="text-xs text-zinc-500">読み込み中…</p>;

  const rate =
    stats.summary.totalChecks > 0
      ? Math.round((stats.summary.successes / stats.summary.totalChecks) * 100)
      : 0;

  return (
    <div className="space-y-5 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      {/* サマリー */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["判定回数", stats.summary.totalChecks],
          ["成功率", stats.summary.totalChecks > 0 ? `${rate}%` : "-"],
          ["クリティカル", stats.summary.criticals],
          ["ファンブル", stats.summary.fumbles],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-2">
            <div className="text-lg font-bold">{value}</div>
            <div className="text-xs text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 mb-1">🧠 SAN推移</h3>
        <SanLineChart series={stats.sanSeries} />
      </div>

      {stats.summary.totalChecks > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 mb-1">
            🎲 出目分布 (1d100判定)
          </h3>
          <Histogram data={stats.histogram} />
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 mb-1">📊 技能別成績</h3>
        <SkillBars skills={stats.skillStats} />
      </div>
    </div>
  );
}
