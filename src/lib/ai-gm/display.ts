// 保存済みChatMessage(Anthropic content blocks)を画面表示用に変換する。
// contentJson自体はAPI返送用に無加工で保持し、表示はここで抽出する二層構造。
import type { ChatMessage } from "@prisma/client";

export type DisplayMessage =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; data: Record<string, unknown> };

interface ContentBlock {
  type: string;
  text?: string;
  content?: unknown;
}

export function toDisplayMessages(messages: ChatMessage[]): DisplayMessage[] {
  const display: DisplayMessage[] = [];

  for (const message of messages) {
    let blocks: ContentBlock[];
    try {
      const parsed = JSON.parse(message.contentJson);
      blocks = Array.isArray(parsed) ? parsed : [{ type: "text", text: String(parsed) }];
    } catch {
      continue;
    }

    if (message.role === "user") {
      for (const block of blocks) {
        if (block.type === "text" && block.text) {
          display.push({ kind: "user", text: block.text });
        } else if (block.type === "tool_result" && typeof block.content === "string") {
          // ツール実行結果はダイスカードとして表示
          try {
            display.push({ kind: "tool", data: JSON.parse(block.content) });
          } catch {
            // 表示できない結果はスキップ
          }
        }
      }
    } else {
      const text = blocks
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text)
        .join("\n");
      if (text) display.push({ kind: "assistant", text });
      // tool_useブロックは対応するtool_resultカードで表現されるためスキップ
    }
  }

  return display;
}
