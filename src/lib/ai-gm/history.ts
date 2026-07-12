// 会話履歴の補正ユーティリティ。
import type Anthropic from "@anthropic-ai/sdk";

// 前ターンがAPI呼び出し前に失敗するとuser発言だけが残り、再送でuserロールが
// 連続しうる。API送信用に連続userを1メッセージへ結合する (永続化データは変えない)。
export function mergeConsecutiveUserTurns(
  history: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  const merged: Anthropic.MessageParam[] = [];
  for (const message of history) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === "user" && message.role === "user") {
      const toBlocks = (c: Anthropic.MessageParam["content"]) =>
        Array.isArray(c) ? c : [{ type: "text" as const, text: c }];
      prev.content = [...toBlocks(prev.content), ...toBlocks(message.content)];
    } else {
      merged.push({ ...message });
    }
  }
  return merged;
}
