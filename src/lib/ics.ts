// 卓予定のiCalendar (.ics) 生成。GoogleカレンダーやiOSカレンダーにそのまま登録できる。
// RFC 5545 の最小構成: VCALENDAR + VEVENT 1件。行はCRLF区切り。

export interface IcsSessionInput {
  id: string;
  title: string;
  scenarioName?: string | null;
  notes?: string | null;
  scheduledAt: Date;
  /** セッションの想定時間 (時間)。TRPGの標準的な1回分として既定4時間 */
  durationHours?: number;
}

// TEXT型のエスケープ (RFC 5545 3.3.11): バックスラッシュ・セミコロン・カンマ・改行
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// UTC基本形式 (例: 20260718T130000Z)
export function toIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildSessionIcs(input: IcsSessionInput): string {
  const start = input.scheduledAt;
  const end = new Date(start.getTime() + (input.durationHours ?? 4) * 3600000);
  const description = [
    input.scenarioName && `シナリオ: ${input.scenarioName}`,
    input.notes?.trim(),
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TRPG Central//JP",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:session-${input.id}@trpg-central`,
    `DTSTAMP:${toIcsUtc(start)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(`🎲 ${input.title}`)}`,
    ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
