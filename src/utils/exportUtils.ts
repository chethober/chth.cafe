/**
 * Export Utilities for CHTH Cafe Admin Panel
 * Provides styled Excel (.xls) generation, CSV formatting, JSON serialization, and clipboard helpers.
 */

export interface ExportColumn {
  header: string;
  align?: 'left' | 'center' | 'right';
  isNumeric?: boolean;
}

export interface StyledExcelOptions {
  filename: string;
  sheetName?: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, string | number | undefined | null>;
  summaryCards?: { label: string; value: string | number; color?: string }[];
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  columnAlignments?: ('left' | 'center' | 'right')[];
  totalsRow?: (string | number | null | undefined)[];
  themeColor?: 'emerald' | 'amber' | 'blue' | 'purple' | 'slate';
}

const THEME_STYLES = {
  emerald: {
    primaryBg: '#059669',
    primaryText: '#ffffff',
    accentBg: '#ecfdf5',
    accentBorder: '#10b981',
    totalsBg: '#d1fae5',
    totalsText: '#065f46'
  },
  amber: {
    primaryBg: '#d97706',
    primaryText: '#ffffff',
    accentBg: '#fffbeb',
    accentBorder: '#f59e0b',
    totalsBg: '#fef3c7',
    totalsText: '#92400e'
  },
  blue: {
    primaryBg: '#2563eb',
    primaryText: '#ffffff',
    accentBg: '#eff6ff',
    accentBorder: '#3b82f6',
    totalsBg: '#dbeafe',
    totalsText: '#1e40af'
  },
  purple: {
    primaryBg: '#7c3aed',
    primaryText: '#ffffff',
    accentBg: '#f5f3ff',
    accentBorder: '#8b5cf6',
    totalsBg: '#ede9fe',
    totalsText: '#5b21b6'
  },
  slate: {
    primaryBg: '#1e293b',
    primaryText: '#ffffff',
    accentBg: '#f8fafc',
    accentBorder: '#64748b',
    totalsBg: '#e2e8f0',
    totalsText: '#0f172a'
  }
};

/**
 * Downloads a beautifully styled Excel spreadsheet with branding, KPI cards, zebra-striping, and totals.
 */
export function downloadStyledExcel(opts: StyledExcelOptions): void {
  const theme = THEME_STYLES[opts.themeColor || 'emerald'];
  const sheetName = opts.sheetName || 'Report';

  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeXml(sheetName)}</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
    .title-banner { background-color: ${theme.primaryBg}; color: ${theme.primaryText}; font-size: 16pt; font-weight: bold; text-align: left; padding: 12px; }
    .subtitle-banner { background-color: ${theme.accentBg}; color: #475569; font-size: 10pt; padding: 6px 12px; font-style: italic; }
    .meta-table { margin-bottom: 15px; border-collapse: collapse; width: 100%; }
    .meta-label { font-weight: bold; color: #64748b; font-size: 9.5pt; text-transform: uppercase; background-color: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; }
    .meta-val { color: #0f172a; font-size: 10pt; font-weight: 600; padding: 6px 10px; border: 1px solid #cbd5e1; }
    .kpi-table { margin-bottom: 18px; border-collapse: separate; border-spacing: 6px; }
    .kpi-card { background-color: ${theme.accentBg}; border: 1.5px solid ${theme.accentBorder}; border-radius: 6px; padding: 8px 14px; text-align: center; }
    .kpi-card-label { font-size: 8.5pt; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .kpi-card-val { font-size: 14pt; font-weight: bold; color: ${theme.primaryBg}; margin-top: 2px; }
    .data-table { border-collapse: collapse; width: 100%; font-size: 10pt; }
    .data-th { background-color: ${theme.primaryBg}; color: ${theme.primaryText}; font-weight: bold; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; }
    .data-td { padding: 6px 12px; border: 1px solid #e2e8f0; vertical-align: middle; }
    .data-td-alt { background-color: #f8fafc; }
    .align-left { text-align: left; }
    .align-center { text-align: center; }
    .align-right { text-align: right; }
    .totals-row { background-color: ${theme.totalsBg}; color: ${theme.totalsText}; font-weight: bold; font-size: 10.5pt; }
    .totals-td { padding: 8px 12px; border: 1.5px solid ${theme.accentBorder}; }
  </style>
</head>
<body>
  <table>
    <!-- Title Banner -->
    <tr>
      <td colspan="${opts.headers.length}" class="title-banner">
        ☕ ${escapeXml(opts.title)}
      </td>
    </tr>
    ${
      opts.subtitle
        ? `<tr><td colspan="${opts.headers.length}" class="subtitle-banner">${escapeXml(opts.subtitle)}</td></tr>`
        : ''
    }
    <tr><td colspan="${opts.headers.length}" style="height: 10px;"></td></tr>
  </table>
`;

  // Metadata block
  if (opts.metadata && Object.keys(opts.metadata).length > 0) {
    html += `<table class="meta-table"><tr>`;
    const entries = Object.entries(opts.metadata).filter(([_, v]) => v != null && v !== '');
    entries.forEach(([k, v]) => {
      html += `<td class="meta-label">${escapeXml(k)}:</td><td class="meta-val">${escapeXml(String(v))}</td>`;
    });
    html += `</tr></table><br/>`;
  }

  // KPI Summary Cards
  if (opts.summaryCards && opts.summaryCards.length > 0) {
    html += `<table class="kpi-table"><tr>`;
    opts.summaryCards.forEach((c) => {
      html += `
        <td class="kpi-card">
          <div class="kpi-card-label">${escapeXml(c.label)}</div>
          <div class="kpi-card-val">${escapeXml(String(c.value))}</div>
        </td>
      `;
    });
    html += `</tr></table><br/>`;
  }

  // Data Table
  html += `<table class="data-table"><thead><tr>`;
  opts.headers.forEach((h, idx) => {
    const align = opts.columnAlignments?.[idx] || 'left';
    html += `<th class="data-th align-${align}">${escapeXml(h)}</th>`;
  });
  html += `</tr></thead><tbody>`;

  opts.rows.forEach((row, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    html += `<tr>`;
    row.forEach((cell, cIdx) => {
      const align = opts.columnAlignments?.[cIdx] || 'left';
      const cellVal = cell == null ? '' : String(cell);
      html += `<td class="data-td ${isAlt ? 'data-td-alt' : ''} align-${align}">${escapeXml(cellVal)}</td>`;
    });
    html += `</tr>`;
  });

  // Totals Row
  if (opts.totalsRow && opts.totalsRow.length > 0) {
    html += `<tr class="totals-row">`;
    opts.totalsRow.forEach((cell, cIdx) => {
      const align = opts.columnAlignments?.[cIdx] || 'left';
      const cellVal = cell == null ? '' : String(cell);
      html += `<td class="totals-td align-${align}">${escapeXml(cellVal)}</td>`;
    });
    html += `</tr>`;
  }

  html += `</tbody></table><br/><div style="font-size: 8pt; color: #94a3b8; font-style: italic;">Export generated by CHTH Cafe Operations System on ${new Date().toLocaleString()}</div></body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerFileDownload(blob, opts.filename.endsWith('.xls') || opts.filename.endsWith('.xlsx') ? opts.filename : `${opts.filename}.xls`);
}

/**
 * Downloads a standard RFC 4180 CSV file.
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Downloads structured JSON file with metadata and rows.
 */
export function downloadJSON(filename: string, data: Record<string, any>): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  triggerFileDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

/**
 * Copies formatted CSV content directly to the user's clipboard.
 */
export async function copyCSVToClipboard(headers: string[], rows: (string | number | boolean | null | undefined)[][]): Promise<boolean> {
  try {
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(csvContent);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Clipboard write error:', e);
    return false;
  }
}

function triggerFileDownload(blob: Blob, fullFilename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fullFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
