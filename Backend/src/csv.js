// Excel to'g'ri ochishi uchun BOM va nuqta-vergul ajratgich ishlatiladi
export function toCsv(rows) {
  if (!rows.length) return '﻿';
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\n');
}
