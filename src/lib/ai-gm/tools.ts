// AI GMが使うツール群。すべてサーバー側で実行し、結果をDiceRollに記録する。
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { rollDice } from "@/lib/dice";
import { skillCheck, sanCheck } from "@/lib/coc6/check";
import type { AiGmState } from "@/lib/coc6/types";

export const GM_TOOLS: Anthropic.Tool[] = [
  {
    name: "roll_dice",
    description:
      "任意のダイスをロールする。ダメージロール(例: 1d6+1)、ランダムな展開の決定、能力値×5のような目標値なしのロールに使う。技能判定には request_skill_check を、SANチェックには san_check を使うこと。ダイスの結果を勝手に決めてはならず、必ずこのツールを使う。",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "ダイス式 (例: 1d100, 3d6, 1d6+1)",
        },
        reason: {
          type: "string",
          description: "何のためのロールか (例: ナイフのダメージ)",
        },
      },
      required: ["expression", "reason"],
    },
  },
  {
    name: "request_skill_check",
    description:
      "探索者の技能判定・能力値ロールを行う。プレイヤーが技能を使う行動を宣言したとき(目星で調べる、聞き耳を立てる、図書館で調べ物をする、説得を試みる等)に必ず使う。1d100をロールし、01-05クリティカル / 96-00ファンブル / 出目≦目標値で成功を自動判定する。目標値は探索者シートの技能値を使うこと。",
    input_schema: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          description: "技能名 (例: 目星, 聞き耳, 図書館)",
        },
        target_value: {
          type: "integer",
          description: "目標値 = 探索者のその技能の現在値 (1-100)",
        },
        reason: {
          type: "string",
          description: "判定の状況説明",
        },
      },
      required: ["skill_name", "target_value", "reason"],
    },
  },
  {
    name: "san_check",
    description:
      "SANチェック(正気度ロール)を行う。探索者が恐ろしいもの・神話的存在・死体などを目撃したときに必ず使う。現在SAN値に対して1d100をロールし、成功/失敗に応じた減少値を自動でロールしてSAN値を更新する。減少値は '0' や '1' のような定数、または '1d4' のようなダイス式で指定する。",
    input_schema: {
      type: "object",
      properties: {
        loss_on_success: {
          type: "string",
          description: "成功時のSAN減少 (例: '0', '1', '1d2')",
        },
        loss_on_failure: {
          type: "string",
          description: "失敗時のSAN減少 (例: '1', '1d4', '1d10')",
        },
        reason: {
          type: "string",
          description: "SANチェックの原因 (例: 腐乱死体を目撃した)",
        },
      },
      required: ["loss_on_success", "loss_on_failure", "reason"],
    },
  },
];

export interface ToolExecutionResult {
  resultForModel: string; // tool_result として返すJSON文字列
  display: Record<string, unknown>; // SSEでクライアントに送る演出用データ
  newState?: AiGmState; // san_check等で状態が変わった場合
}

export async function executeGmTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { aiGmSessionId: string; state: AiGmState },
): Promise<ToolExecutionResult> {
  switch (name) {
    case "roll_dice": {
      const expression = String(input.expression ?? "1d100");
      const reason = String(input.reason ?? "");
      const result = rollDice(expression);
      await prisma.diceRoll.create({
        data: {
          expression: result.expression,
          rolls: JSON.stringify(result.rolls),
          total: result.total,
          context: reason,
          source: "AI_GM",
          aiGmSessionId: ctx.aiGmSessionId,
        },
      });
      const payload = {
        tool: "roll_dice",
        expression: result.expression,
        rolls: result.rolls,
        total: result.total,
        reason,
      };
      return { resultForModel: JSON.stringify(payload), display: payload };
    }

    case "request_skill_check": {
      const skillName = String(input.skill_name ?? "判定");
      const target = Math.max(1, Math.min(100, Number(input.target_value) || 50));
      const reason = String(input.reason ?? "");
      const result = skillCheck(target);
      await prisma.diceRoll.create({
        data: {
          expression: "1d100",
          rolls: JSON.stringify([result.roll]),
          total: result.roll,
          target,
          outcome: result.outcome,
          context: `${skillName}: ${reason}`,
          skillName,
          source: "AI_GM",
          aiGmSessionId: ctx.aiGmSessionId,
        },
      });
      const payload = {
        tool: "request_skill_check",
        skill_name: skillName,
        roll: result.roll,
        target,
        outcome: result.outcome,
        reason,
      };
      return { resultForModel: JSON.stringify(payload), display: payload };
    }

    case "san_check": {
      const lossOnSuccess = String(input.loss_on_success ?? "0");
      const lossOnFailure = String(input.loss_on_failure ?? "1");
      const reason = String(input.reason ?? "");
      const result = sanCheck(ctx.state.san, lossOnSuccess, lossOnFailure);
      const newState: AiGmState = { ...ctx.state, san: result.sanAfter };
      await prisma.diceRoll.create({
        data: {
          expression: "1d100",
          rolls: JSON.stringify([result.roll]),
          total: result.roll,
          target: result.target,
          outcome: result.success ? "SUCCESS" : "FAILURE",
          context: `SANチェック: ${reason} (減少 ${result.loss})`,
          source: "AI_GM",
          aiGmSessionId: ctx.aiGmSessionId,
        },
      });
      const payload = {
        tool: "san_check",
        roll: result.roll,
        target: result.target,
        success: result.success,
        loss: result.loss,
        loss_expression: result.lossExpression,
        san_before: ctx.state.san,
        san_after: result.sanAfter,
        reason,
      };
      return {
        resultForModel: JSON.stringify(payload),
        display: payload,
        newState,
      };
    }

    default:
      return {
        resultForModel: JSON.stringify({ error: `不明なツール: ${name}` }),
        display: { tool: name, error: "unknown tool" },
      };
  }
}
