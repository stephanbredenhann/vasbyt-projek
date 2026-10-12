/** Date of birth and gender from a South African ID number (YYMMDD SSSS C A Z). Null unless the checksum and date hold. */
export function parseSaId(id: string, today = new Date()): { dateOfBirth: string; gender: 'M' | 'V' } | null {
  if (!/^\d{13}$/.test(id)) return null;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let d = Number(id[12 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  if (sum % 10) return null;
  const yy = Number(id.slice(0, 2)), mm = Number(id.slice(2, 4)), dd = Number(id.slice(4, 6));
  const year = yy > today.getFullYear() % 100 ? 1900 + yy : 2000 + yy;
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return null;
  return { dateOfBirth: `${year}-${id.slice(2, 4)}-${id.slice(4, 6)}`, gender: Number(id.slice(6, 10)) >= 5000 ? 'M' : 'V' };
}
