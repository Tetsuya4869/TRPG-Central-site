// AI GMが使うツール群。すべてサーバー側で実行し、結果をDiceRollに記録する。
// 複数探索者対応: 判定系ツールは character_name で対象メンバーを指定する。
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { rollDice } from "@/lib/dice";
import { skillCheck, sanCheck } from "@/lib/coc6/check";
import type { AiGmState } from "@/lib/coc6/types";

export interface MemberContext {
  memberId: string;
  characterId: string;
  name: string;
  state: AiGmState;
}

export interface GmToolContext {
  aiGmSessionId: string;
  members: MemberContext[];
}

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
        character_name: {
          type: "string",
          description:
            "ロールの対象となる探索者の名前 (ダメージ等、特定の探索者に関するロールの場合のみ)",
        },
      },
      required: ["expression", "reason"],
    },
  },
  {
    name: "request_skill_check",
    description:
      "探索者の技能判定・能力値ロールを行う。プレイヤーが技能を使う行動を宣言したとき(目星で調べる、聞き耳を立てる、図書館で調べ物をする、説得を試みる等)に必ず使う。1d100をロールし、01-05クリティカル / 96-00ファンブル / 出目≦目標値で成功を自動判定する。目標値は判定する探索者のシートの技能値を使うこと。",
    input_schema: {
      type: "object",
      properties: {
        character_name: {
          type: "string",
          description:
            "判定する探索者の名前。シート記載の名前を一字一句正確に指定する",
        },
        skill_name: {
          type: "string",
          description: "技能名 (例: 目星, 聞き耳, 図書館)",
        },
        target_value: {
          type: "integer",
          description: "目標値 = その探索者のその技能の現在値 (1-100)",
        },
        reason: {
          type: "string",
          description: "判定の状況説明",
        },
      },
      required: ["character_name", "skill_name", "target_value", "reason"],
    },
  },
  {
    name: "san_check",
    description:
      "SANチェック(正気度ロール)を行う。探索者が恐ろしいもの・神話的存在・死体などを目撃したときに必ず使う。対象探索者の現在SAN値に対して1d100をロールし、成功/失敗に応じた減少値を自動でロールしてSAN値を更新する。減少値は '0' や '1' のような定数、または '1d4' のようなダイス式で指定する。複数の探索者が同時に目撃した場合は、探索者ごとにこのツールを呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        character_name: {
          type: "string",
          description:
            "SANチェックする探索者の名前。シート記載の名前を一字一句正確に指定する",
        },
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
      required: ["character_name", "loss_on_success", "loss_on_failure", "reason"],
    },
  },
];

export interface ToolExecutionResult {
  resultForModel: string; // tool_result として返すJSON文字列
  display: Record<string, unknown>; // SSEでクライアントに送る演出用データ
  isError?: boolean;
  newMemberState?: { memberId: string; state: AiGmState };
}

// character_name からメンバーを解決する。
// 完全一致 → 部分一致 → メンバーが1人なら無条件でその人 (旧1人用セッション互換+表記ゆれ耐性)
export function resolveMember(
  members: MemberContext[],
  characterName: unknown,
): MemberContext | null {
  const name = typeof characterName === "string" ? characterName.trim() : "";
  if (name) {
    const exact = members.find((m) => m.name === name);
    if (exact) return exact;
    const partial = members.filter(
      (m) => m.name.includes(name) || name.includes(m.name),
    );
    if (partial.length === 1) return partial[0];
  }
  if (members.length === 1) return members[0];
  return null;
}

function unknownMemberResult(
  members: MemberContext[],
  characterName: unknown,
): ToolExecutionResult {
  const valid = members.map((m) => m.name).join("、");
  return {
    resultForModel: JSON.stringify({
      error: `探索者「${String(characterName ?? "")}」が見つかりません。有効な名前: ${valid}。正確な名前で再度ツールを呼んでください。`,
    }),
    display: { tool: "error", message: "探索者名の解決に失敗 (AIが再試行します)" },
    isError: true,
  };
}

export async function executeGmTool(
  name: string,
  input: Record<string, unknown>,
  ctx: GmToolContext,
): Promise<ToolExecutionResult> {
  switch (name) {
    case "roll_dice": {
      const expression = String(input.expression ?? "1d100");
      const reason = String(input.reason ?? "");
      // roll_diceの対象は任意。指定があれば解決を試みるが、失敗してもロール自体は行う
      const member = input.character_name
        ? resolveMember(ctx.members, input.character_name)
        : null;
      const result = rollDice(expression);
      await prisma.diceRoll.create({
        data: {
          expression: result.expression,
          rolls: JSON.stringify(result.rolls),
          total: result.total,
          context: reason,
          characterId: member?.characterId ?? null,
          characterName: member?.name ?? null,
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
        ...(member && { character_name: member.name }),
      };
      return { resultForModel: JSON.stringify(payload), display: payload };
    }

    case "request_skill_check": {
      const member = resolveMember(ctx.members, input.character_name);
      if (!member) return unknownMemberResult(ctx.members, input.character_name);
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
          characterId: member.characterId,
          characterName: member.name,
          source: "AI_GM",
          aiGmSessionId: ctx.aiGmSessionId,
        },
      });
      const payload = {
        tool: "request_skill_check",
        character_name: member.name,
        skill_name: skillName,
        roll: result.roll,
        target,
        outcome: result.outcome,
        reason,
      };
      return { resultForModel: JSON.stringify(payload), display: payload };
    }

    case "san_check": {
      const member = resolveMember(ctx.members, input.character_name);
      if (!member) return unknownMemberResult(ctx.members, input.character_name);
      const lossOnSuccess = String(input.loss_on_success ?? "0");
      const lossOnFailure = String(input.loss_on_failure ?? "1");
      const reason = String(input.reason ?? "");
      const result = sanCheck(member.state.san, lossOnSuccess, lossOnFailure);
      const newState: AiGmState = { ...member.state, san: result.sanAfter };
      await prisma.diceRoll.create({
        data: {
          expression: "1d100",
          rolls: JSON.stringify([result.roll]),
          total: result.roll,
          target: result.target,
          outcome: result.success ? "SUCCESS" : "FAILURE",
          context: `SANチェック: ${reason} (減少 ${result.loss})`,
          characterId: member.characterId,
          characterName: member.name,
          sanAfter: result.sanAfter,
          source: "AI_GM",
          aiGmSessionId: ctx.aiGmSessionId,
        },
      });
      const payload = {
        tool: "san_check",
        character_name: member.name,
        roll: result.roll,
        target: result.target,
        success: result.success,
        loss: result.loss,
        loss_expression: result.lossExpression,
        san_before: member.state.san,
        san_after: result.sanAfter,
        reason,
      };
      return {
        resultForModel: JSON.stringify(payload),
        display: payload,
        newMemberState: { memberId: member.memberId, state: newState },
      };
    }

    default:
      return {
        resultForModel: JSON.stringify({ error: `不明なツール: ${name}` }),
        display: { tool: name, error: "unknown tool" },
        isError: true,
      };
  }
}
