import { z } from "zod";
import { weaponsSchema } from "@/lib/weapons";
import { imageUrlSchema } from "@/lib/upload";

// 技能名 → 現在値 のマップ (Character.skillsJson の中身)
export const skillsSchema = z.record(z.string(), z.number().int().min(0).max(100));
export type Skills = z.infer<typeof skillsSchema>;

export const sessionStatusSchema = z.enum(["RECRUITING", "ONGOING", "FINISHED"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const aiGmStatusSchema = z.enum(["ONGOING", "FINISHED"]);
export type AiGmStatus = z.infer<typeof aiGmStatusSchema>;

// EXTREME/HARD は7版の成功度 (6版判定は4値しか返さない)
export const checkOutcomeSchema = z.enum([
  "CRITICAL",
  "EXTREME",
  "HARD",
  "SUCCESS",
  "FAILURE",
  "FUMBLE",
]);
export type CheckOutcome = z.infer<typeof checkOutcomeSchema>;

export const rollSourceSchema = z.enum(["MANUAL", "AI_GM", "KP_ASSIST"]);

export const scenarioSourceSchema = z.enum(["MANUAL", "AI_GENERATED"]);
export type ScenarioSource = z.infer<typeof scenarioSourceSchema>;

export const scenarioInputSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(200),
  content: z.string().min(1, "本文は必須です").max(50000),
  summary: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  source: scenarioSourceSchema.default("MANUAL"),
});
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;

export const statBlockSchema = z.object({
  str: z.number().int().min(1).max(99),
  con: z.number().int().min(1).max(99),
  pow: z.number().int().min(1).max(99),
  dex: z.number().int().min(1).max(99),
  app: z.number().int().min(1).max(99),
  siz: z.number().int().min(1).max(99),
  int_: z.number().int().min(1).max(99),
  edu: z.number().int().min(1).max(99),
});
export type StatBlock = z.infer<typeof statBlockSchema>;

export const characterInputSchema = statBlockSchema.extend({
  edition: z.enum(["6", "7"]).default("6"),
  luck: z.number().int().min(0).max(99).optional().nullable(), // 7版のみ
  name: z.string().min(1, "名前は必須です").max(100),
  playerName: z.string().max(100).optional().nullable(),
  occupation: z.string().max(100).optional().nullable(),
  age: z.number().int().min(1).max(999).optional().nullable(),
  sex: z.string().max(20).optional().nullable(),
  // ローカル(/uploads/…) または Firebase Storage の公開URLのみ許可 (javascript:等の混入防止)
  imageUrl: imageUrlSchema.optional().nullable(),
  skills: skillsSchema.default({}),
  weapons: weaponsSchema.default([]),
  memo: z.string().max(10000).optional().nullable(),
  // 省略時は派生値の上限で初期化する
  currentHp: z.number().int().min(0).optional(),
  currentMp: z.number().int().min(0).optional(),
  currentSan: z.number().int().min(0).optional(),
});
export type CharacterInput = z.infer<typeof characterInputSchema>;

// AiGmSessionMember.stateJson の中身
export const aiGmStateSchema = z.object({
  hp: z.number().int(),
  maxHp: z.number().int(),
  mp: z.number().int(),
  maxMp: z.number().int(),
  san: z.number().int(),
  maxSan: z.number().int(),
});
export type AiGmState = z.infer<typeof aiGmStateSchema>;

// SSE state イベントで送るメンバー別状態
export const memberStateSchema = z.object({
  characterId: z.string(),
  name: z.string(),
  state: aiGmStateSchema,
});
export type MemberState = z.infer<typeof memberStateSchema>;
