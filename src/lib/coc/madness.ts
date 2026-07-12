// 狂気表。SANを大きく失った探索者の一時的な狂気/狂気の発作をロールする。
// 6版: 一時的狂気 (1d10表 + 持続1d10ラウンド or 1d10×10分)
// 7版: 狂気の発作・リアルタイム (1d10表 + 持続1d10ラウンド)
// 表の内容はルールブックの雰囲気に沿った汎用的な要約 (原文の転載ではない)。
import { rollDie, type Rng } from "@/lib/dice";
import type { Edition } from "@/lib/coc";

export interface MadnessEntry {
  title: string;
  description: string;
}

export interface MadnessResult {
  edition: Edition;
  roll: number; // 1d10
  entry: MadnessEntry;
  durationRoll: number; // 1d10
  durationText: string;
}

// 6版: 一時的狂気の例 (1d10)
const MADNESS_TABLE_6: MadnessEntry[] = [
  {
    title: "気絶",
    description: "その場に崩れ落ちて意識を失う。持続時間が過ぎるか、揺り起こされるまで目覚めない。",
  },
  {
    title: "悲鳴・絶叫",
    description: "叫び続ける。隠密は不可能になり、周囲の注意を引いてしまう。",
  },
  {
    title: "逃走",
    description: "恐怖の対象から全力で逃げ出す。仲間を置き去りにしてでも、その場から離れようとする。",
  },
  {
    title: "身体的ヒステリー",
    description: "視力や聴力の喪失、腕が動かないなど、肉体に異常が現れる (器質的損傷はない)。",
  },
  {
    title: "パニック・興奮",
    description: "支離滅裂にわめき、手近なものを振り回す。説得はほぼ通じない。",
  },
  {
    title: "硬直",
    description: "その場に立ちすくみ、一切の行動ができなくなる。",
  },
  {
    title: "強迫行動",
    description: "手を洗い続ける、数を数え続けるなど、無意味な行動を繰り返す。",
  },
  {
    title: "幻覚",
    description: "実在しないものが見え、聞こえる。幻覚を現実と信じて行動してしまう。",
  },
  {
    title: "一時的健忘",
    description: "直前の出来事や自分が誰かを忘れる。重要な手がかりの記憶も失われるかもしれない。",
  },
  {
    title: "恐怖症の発現",
    description: "目撃したものに関連する恐怖症を発症する。対象を前にすると行動が大きく制限される。",
  },
];

// 7版: 狂気の発作 (リアルタイム・1d10)
const MADNESS_TABLE_7: MadnessEntry[] = [
  {
    title: "健忘",
    description: "直近の記憶を失う。気づけば見知らぬ場所に立っている。",
  },
  {
    title: "身体的症状",
    description: "心因性の失明・失聴・麻痺など。肉体は無傷なのに感覚や自由を失う。",
  },
  {
    title: "暴力",
    description: "見境のない暴力衝動が爆発する。敵味方の区別なく暴れ回る。",
  },
  {
    title: "パラノイア",
    description: "全員が自分を騙している、監視されている、という強烈な妄想に取り憑かれる。",
  },
  {
    title: "重要人物への執着",
    description: "その場にいる誰かを、人生で重要な別の人物と思い込み、その人物として扱う。",
  },
  {
    title: "気絶",
    description: "意識を失ってその場に倒れ込む。",
  },
  {
    title: "逃走衝動",
    description: "何としてもその場から逃げ出そうとする。乗り物を奪ってでも遠くへ。",
  },
  {
    title: "身体的ヒステリー",
    description: "泣き叫ぶ、笑い続けるなど、感情の暴走が止まらなくなる。",
  },
  {
    title: "恐怖症",
    description: "新しい恐怖症を獲得する。原因が実在しなくても、そこにあると思い込んで行動する。",
  },
  {
    title: "マニア",
    description: "新しいマニア(偏執)を獲得する。特定の物や行動に異常に固執し始める。",
  },
];

export function madnessTableFor(edition: Edition): MadnessEntry[] {
  return edition === "7" ? MADNESS_TABLE_7 : MADNESS_TABLE_6;
}

export function rollMadness(edition: Edition, rng: Rng = Math.random): MadnessResult {
  const roll = rollDie(10, rng);
  const entry = madnessTableFor(edition)[roll - 1];
  const durationRoll = rollDie(10, rng);
  const durationText =
    edition === "7"
      ? `${durationRoll}ラウンド (発作終了後は潜在的狂気)`
      : `${durationRoll}ラウンド / 長引く場合は${durationRoll}0分`;
  return { edition, roll, entry, durationRoll, durationText };
}
