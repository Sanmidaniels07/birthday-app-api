
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s\-().]/g, '');
  if (!s) return null;

  let e164: string;
  if (s.startsWith('+')) e164 = s;
  else if (s.startsWith('00')) e164 = `+${s.slice(2)}`;
  else if (s.startsWith('0')) e164 = `+234${s.slice(1)}`;   // local Nigerian format
  else if (s.startsWith('234')) e164 = `+${s}`;
  else return null;

  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export function splitDate(dateStr: string): { month: number; day: number } {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}