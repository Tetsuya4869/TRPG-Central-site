// セッション要約 (前回のあらすじ) の生成。
// ソース整形 (純関数、テスト対象) と AI生成 (scenario-gen と同じ stream+finalMessage パターン) を分離。
import { createClient, GM_MODEL } from "./client";
import { toDisplayMessages, type StoredChatMessage } from "./display";

const MAX_SOURCE_CHARS = 24000; // 長大セッションはコンテキスト节約のため末尾優先で切り詰める

// AI GMセッションのChatMessageを要約用の平文タイムラインへ変換する
export function buildSummarySourceFromChat(messages: StoredChatMessage[]): string {
  const lines: string[] = [];
  for (const m of toDisplayMessages(messages)) {
    if (m.kind === "user") lines.push(`プレイヤー: ${m.text}`);
    else if (m.kind === "assistant") lines.push(`キーパー: ${m.text}`);
    else {
      const d = m.data;
      const tool = String(d.tool ?? "");
      if (tool === "request_skill_check") {
        lines.push(
          `[判定] ${d.character_name ?? ""} ${d.skill_name} 出目${d.roll}/${d.target} → ${d.outcome}`,
        );
      } else if (tool === "san_check") {
        lines.push(
          `[SAN] ${d.character_name ?? ""} ${d.success ? "成功" : "失敗"} SAN ${d.san_before}→${d.san_after}`,
        );
      } else if (tool === "madness_roll") {
        lines.push(`[狂気] ${d.character_name ?? ""} ${d.title}`);
      }
      // roll_dice等の汎用ロールはあらすじに不要なので省く
    }
  }
  return truncateHead(lines.join("\n"));
}

export interface TimelineDice {
  context: string | null;
  total: number;
  target: number | null;
  outcome: string | null;
  characterName: string | null;
  createdAt: Date;
}

export interface TimelineLog {
  kind: string;
  body: string;
  createdAt: Date;
}

// 人間卓の卓ログ (SessionLog + DiceRoll) を要約用タイムラインへ変換する
export function buildSummarySourceFromSessionLog(
  logs: TimelineLog[],
  rolls: TimelineDice[],
): string {
  const items: { at: number; line: string }[] = [
    ...logs.map((l) => ({
      at: l.createdAt.getTime(),
      line: `[出来事] ${l.body}`,
    })),
    ...rolls.map((r) => ({
      at: r.createdAt.getTime(),
      line: `[判定] ${r.characterName ?? ""} ${r.context ?? ""} 結果${r.total}${r.target != null ? `/${r.target}` : ""}${r.outcome ? ` → ${r.outcome}` : ""}`,
    })),
  ].sort((a, b) => a.at - b.at);
  return truncateHead(items.map((i) => i.line).join("\n"));
}

// 先頭を削って末尾 (直近の展開) を優先的に残す
function truncateHead(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return `(前半省略)\n${text.slice(text.length - MAX_SOURCE_CHARS)}`;
}

const SYSTEM = `あなたはクトゥルフ神話TRPGのセッション記録係です。渡されたセッションログから「前回のあらすじ」を日本語で書いてください。

## 出力形式
- 300〜600字の地の文。見出し・箇条書きは使わない。
- 次回のキーパー(GM)が読む前提で書く。ネタバレ配慮は不要 (判明した真相・NPCの正体も含めてよい)。
- 最後に1行、「探索者の状態:」として各探索者のHP/SAN・負傷・発狂・重要な所持品や約束事を簡潔にまとめる。
- ログに無い出来事を創作しない。`;

export async function generateSummary(sourceText: string): Promise<string> {
  const client = createClient();
  const stream = client.messages.stream({
    model: GM_MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: "user", content: `# セッションログ\n${sourceText}` }],
  });
  const message = await stream.finalMessage();
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
