import { z } from "zod";

// 技能名 → 現在値 のマップ (Character.skillsJson の中身)
export const skillsSchema = z.record(z.string(), z.number().int().min(0).max(100));
export type Skills = z.infer<typeof skillsSchema>;

export const sessionStatusSchema = z.enum(["RECRUITING", "ONGOING", "FINISHED"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const aiGmStatusSchema = z.enum(["ONGOING", "FINISHED"]);
export type AiGmStatus = z.infer<typeof aiGmStatusSchema>;

export const checkOutcomeSchema = z.enum(["CRITICAL", "SUCCESS", "FAILURE", "FUMBLE"]);
export type CheckOutcome = z.infer<typeof checkOutcomeSchema>;

export const rollSourceSchema = z.enum(["MANUAL", "AI_GM"]);

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
  name: z.string().min(1, "名前は必須です").max(100),
  playerName: z.string().max(100).optional().nullable(),
  occupation: z.string().max(100).optional().nullable(),
  age: z.number().int().min(1).max(999).optional().nullable(),
  sex: z.string().max(20).optional().nullable(),
  skills: skillsSchema.default({}),
  memo: z.string().max(10000).optional().nullable(),
  // 省略時は派生値の上限で初期化する
  currentHp: z.number().int().min(0).optional(),
  currentMp: z.number().int().min(0).optional(),
  currentSan: z.number().int().min(0).optional(),
});
export type CharacterInput = z.infer<typeof characterInputSchema>;

// AiGmSession.stateJson の中身
export const aiGmStateSchema = z.object({
  hp: z.number().int(),
  maxHp: z.number().int(),
  mp: z.number().int(),
  maxMp: z.number().int(),
  san: z.number().int(),
  maxSan: z.number().int(),
});
export type AiGmState = z.infer<typeof aiGmStateSchema>;
