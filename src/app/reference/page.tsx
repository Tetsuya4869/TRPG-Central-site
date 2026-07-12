"use client";

// CoC 6版/7版のルール早見表。プレイ中に参照する要点のみの静的チートシート。
import { useState } from "react";
import type { Edition } from "@/lib/coc";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-2">
      <h2 className="font-semibold text-emerald-300">{title}</h2>
      <div className="text-sm text-zinc-300 space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-800/60 pb-1 last:border-0">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Reference6() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="技能判定 (1d100)">
        <Row label="成功" value="出目 ≦ 技能値" />
        <Row label="クリティカル" value="01〜05" />
        <Row label="ファンブル" value="96〜00" />
        <Row label="アイデア" value="INT×5" />
        <Row label="幸運" value="POW×5" />
        <Row label="知識" value="EDU×5" />
        <Row label="対抗ロール" value="(能力差×5)+50 を1d100で" />
      </Card>
      <Card title="SANチェック">
        <Row label="判定" value="1d100 ≦ 現在SAN で成功" />
        <Row label="減少表記" value="成功時/失敗時 (例 0/1d4)" />
        <Row label="一時的狂気" value="一度に5以上失いアイデア成功" />
        <Row label="不定の狂気" value="1時間内にSANの1/5を喪失" />
        <Row label="永久的狂気" value="SANが0になった" />
        <Row label="回復" value="シナリオクリア報酬・精神分析など" />
      </Card>
      <Card title="戦闘">
        <Row label="行動順" value="DEXの高い順" />
        <Row label="回避" value="DEX×2 (1ラウンド1回)" />
        <Row label="応急手当" value="成功で1d3回復" />
        <Row label="医学" value="成功で2d3回復 (時間がかかる)" />
        <Row label="気絶" value="HPが2以下でCON×5" />
        <Row label="死亡" value="HPが-2以下" />
        <Row label="ダメージボーナス" value="STR+SIZ (25〜32: +1d4、33〜40: +1d6)" />
      </Card>
      <Card title="成長・その他">
        <Row label="成長チェック" value="1d100 > 現在値で +1d10" />
        <Row label="クトゥルフ神話技能" value="SAN上限 = 99 - 神話技能" />
        <Row label="正気度の上限" value="現在SANは99を超えない" />
        <Row label="マーシャルアーツ" value="成功でこぶし等のダメージ2倍" />
        <Row label="ショック" value="1回で現在HPの半分 → CON×5" />
      </Card>
    </div>
  );
}

function Reference7() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="技能判定と成功度 (1d100)">
        <Row label="クリティカル" value="01" />
        <Row label="イクストリーム" value="≦ 技能値の1/5" />
        <Row label="ハード" value="≦ 技能値の1/2" />
        <Row label="レギュラー" value="≦ 技能値" />
        <Row label="ファンブル" value="技能値50未満: 96〜00 / 50以上: 00" />
        <Row label="プッシュロール" value="失敗後、代償リスクを負って1回だけ再挑戦" />
        <Row label="対抗判定" value="互いに判定し成功度で比較" />
      </Card>
      <Card title="ボーナス・ペナルティダイス">
        <Row label="ボーナス" value="十の位を複数振り低い方を採用 (最大2個)" />
        <Row label="ペナルティ" value="十の位を複数振り高い方を採用 (最大2個)" />
        <Row label="例" value="奇襲・準備万端 → ボーナス / 暗闇・遠距離 → ペナルティ" />
        <Row label="幸運の消費" value="出目を1点1点で下げて成功にできる (任意ルール)" />
      </Card>
      <Card title="SANチェックと狂気">
        <Row label="判定" value="1d100 ≦ 現在SAN で成功" />
        <Row label="一時的狂気" value="一度に5以上失う → 狂気の発作" />
        <Row label="不定の狂気" value="1日にSANの1/5を喪失" />
        <Row label="発作 (リアルタイム)" value="1d10表、持続1d10ラウンド" />
        <Row label="潜在的狂気" value="発作後。再度SANを失うと再発の恐れ" />
      </Card>
      <Card title="戦闘">
        <Row label="行動順" value="DEXの高い順" />
        <Row label="応戦" value="近接攻撃には応戦(反撃)か回避を選べる" />
        <Row label="回避" value="DEX/2 (何回でも)" />
        <Row label="応急手当" value="成功で1d3回復" />
        <Row label="医学" value="成功で1d3回復+瀕死の安定化" />
        <Row label="重傷" value="1回で最大HPの半分 → 転倒しCON判定" />
        <Row label="瀕死" value="HP0で重傷あり → 毎ラウンドCON判定" />
        <Row label="ビルド/DB" value="STR+SIZ 125〜164: +1d4 / 165〜204: +1d6" />
      </Card>
    </div>
  );
}

export default function ReferencePage() {
  const [edition, setEdition] = useState<Edition>("6");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">📖 ルール早見表</h1>
        <div className="flex rounded border border-zinc-700 overflow-hidden">
          {(["6", "7"] as const).map((ed) => (
            <button
              key={ed}
              onClick={() => setEdition(ed)}
              className={`px-4 py-1.5 text-sm font-semibold ${
                edition === ed
                  ? "bg-emerald-600/30 text-emerald-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {ed}版
            </button>
          ))}
        </div>
      </div>
      {edition === "6" ? <Reference6 /> : <Reference7 />}
      <p className="text-xs text-zinc-600">
        プレイ中によく使う要点のみの要約です。詳細・例外はルールブックを参照してください。
      </p>
    </div>
  );
}
