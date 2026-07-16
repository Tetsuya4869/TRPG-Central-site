// AI NPCジェネレータ。役どころを指定して、名前・口調・秘密・簡易ステータス付きの
// NPC資料を生成する。scenario-gen.ts と同じ「1行目にタイトル」の出力規約+軽量パース。
import { createClient, GM_MODEL } from "./client";

export interface NpcGenParams {
  role: string; // 役どころ (例: 怪しい骨董屋の主人)
  tone?: string; // 雰囲気の指定 (例: コミカル、不気味)
  scenarioContext?: string; // シナリオ本文の抜粋 (整合性のため)
}

const SYSTEM = `あなたはクトゥルフ神話TRPGのシナリオライターです。キーパーがそのまま使えるNPC資料を1人分、日本語で書いてください。

## 出力形式 (厳守)
1行目: 「名前: ○○」(フルネーム。時代・舞台に合った自然な名前)
以降、次の項目を順に書く:

【立場・役どころ】シナリオ中での役割。
【外見】一目でわかる特徴を2〜3点。
【口調・話し方】一人称、語尾、口癖。セリフ例を1つ。
【知っていること】探索者に話せる情報。
【秘密】キーパーだけが知る裏側 (神話との関わり、隠している事実など。なければ「特になし」)。
【簡易ステータス】STR/CON/DEX/POW/HPと、主要技能2〜3個 (値付き)。戦闘しないNPCなら省略可。

## 制約
- 全体で300〜600字。
- シナリオ文脈が与えられた場合はそれに矛盾しないこと。`;

export async function generateNpc(
  params: NpcGenParams,
): Promise<{ name: string; content: string }> {
  const client = createClient();
  const userLines = [
    `役どころ: ${params.role}`,
    params.tone && `雰囲気: ${params.tone}`,
    params.scenarioContext &&
      `\n# シナリオ文脈 (冒頭抜粋)\n${params.scenarioContext}`,
  ].filter(Boolean);

  const stream = client.messages.stream({
    model: GM_MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: "user", content: userLines.join("\n") }],
  });
  const message = await stream.finalMessage();

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // 1行目の「名前: ○○」を抽出。失敗したら役どころを名前代わりに
  const match = text.match(/^\s*名前[::]\s*(.+)$/m);
  const name = match?.[1]?.trim().slice(0, 100) || params.role.slice(0, 100);
  const content = match
    ? text.replace(/^\s*名前[::].+\n?/, "").trim()
    : text;

  return { name, content };
}
