// CSV export helpers. Cells that start with = + - @ are prefixed with an apostrophe so spreadsheets never run them as formulas.
const cell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// columns: [[header, (row) => value], ...]
export const toCsv = (rows, columns) =>
  [columns.map(([h]) => cell(h)).join(','), ...rows.map((r) => columns.map(([, get]) => cell(get(r))).join(','))].join('\r\n') + '\r\n';

export const downloadCsv = (filename, csv) => {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// pages through a list endpoint (limit 100) and returns every row
export const fetchAll = async (get, key, maxPages = 50) => {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const d = await get(page);
    out.push(...d[key]);
    if (page >= d.totalPages) break;
  }
  return out;
};
