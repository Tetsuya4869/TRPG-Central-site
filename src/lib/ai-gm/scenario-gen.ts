// AIシナリオ自動生成。生成物は単一テキスト(そのままAI GMのsystem promptに渡る)なので
// structured outputは使わず、「1行目にタイトル」という出力規約+軽量パースで扱う。
import { createClient, GM_MODEL } from "./client";
import { SKILL_DEFS } from "@/lib/coc6/skills";

export interface ScenarioGenParams {
  theme: string;
  setting?: string;
  horrorLevel?: "低" | "中" | "高";
  notes?: string;
}

const SKILL_NAMES = SKILL_DEFS.map((d) => d.name).join("、");

const SYSTEM = `あなたはクトゥルフ神話TRPG(6版)のシナリオライターです。AIキーパーがそのまま進行に使える、1〜2時間のソロプレイ向けシナリオを書いてください。

## 出力形式 (厳守)
1行目: 「タイトル: ○○」
以降、次のセクションを順に書く:

【導入】プレイヤーに読み上げられる導入。探索者がこの事件に関わる理由を含める。
【真相】キーパーだけが知る事件の真相。神話的存在や怪異の正体。
【NPC】主要NPC 2〜4名。名前・立場・口調・知っていること。
【手がかり】5〜8個。各手がかりに入手場所と、必要な技能判定を明記する。技能名は次のCoC6版の正式名称から選ぶ: ${SKILL_NAMES}
【SANチェック】発生する場面と減少値を「成功時/失敗時」の形式で書く (例: 0/1d2、1/1d4+1、1d10/1d100)。
【結末分岐】2〜3個の結末 (真相解明、脱出、失敗など) と、それぞれの条件。

## 制約
- 全体で1500〜2500字。
- 探索者1人でクリア可能な難度にする。戦闘は回避可能な設計にする。
- 手がかりが1つ失敗しても詰まないよう、重要情報には複数の入手経路を用意する。`;

export async function generateScenario(
  params: ScenarioGenParams,
): Promise<{ title: string; content: string }> {
  const client = createClient();
  const userLines = [
    `テーマ: ${params.theme}`,
    params.setting && `舞台: ${params.setting}`,
    params.horrorLevel && `ホラー度: ${params.horrorLevel}`,
    params.notes && `追加要望: ${params.notes}`,
  ].filter(Boolean);

  // 生成は数十秒かかりうるためストリーミングで呼びHTTPタイムアウトを回避
  const stream = client.messages.stream({
    model: GM_MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: userLines.join("\n") }],
  });
  const message = await stream.finalMessage();

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // 1行目の「タイトル: ○○」を抽出。失敗したらテーマから代替
  const match = text.match(/^\s*タイトル[::]\s*(.+)$/m);
  const title = match?.[1]?.trim() || `${params.theme}のシナリオ`;
  const content = match
    ? text.replace(/^\s*タイトル[::].+\n?/, "").trim()
    : text;

  return { title, content };
}
