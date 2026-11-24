import type {
  AggregatorAnalyticsEntry,
  AggregatorEntryInput,
  AggregatorPlatform,
} from '../types/restaurant';

export interface ParsedCsvResult {
  entries: AggregatorEntryInput[];
  skippedRows: number;
  errors: string[];
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildSeededAggregatorEntries(
  referenceDate: Date = new Date(),
): AggregatorAnalyticsEntry[] {
  // 14 days of realistic Zomato & Swiggy INR figures for Andhra Ruchulu
  const dailyPatterns: Array<{
    zomatoOrders: number;
    zomatoGross: number;
    zomatoDedPct: number;
    swiggyOrders: number;
    swiggyGross: number;
    swiggyDedPct: number;
  }> = [
    { zomatoOrders: 28, zomatoGross: 21450, zomatoDedPct: 0.22, swiggyOrders: 24, swiggyGross: 18320, swiggyDedPct: 0.23 },
    { zomatoOrders: 31, zomatoGross: 23890, zomatoDedPct: 0.22, swiggyOrders: 26, swiggyGross: 19950, swiggyDedPct: 0.23 },
    { zomatoOrders: 25, zomatoGross: 18940, zomatoDedPct: 0.21, swiggyOrders: 29, swiggyGross: 22180, swiggyDedPct: 0.22 },
    { zomatoOrders: 34, zomatoGross: 26420, zomatoDedPct: 0.22, swiggyOrders: 30, swiggyGross: 23400, swiggyDedPct: 0.23 },
    { zomatoOrders: 42, zomatoGross: 33680, zomatoDedPct: 0.23, swiggyOrders: 37, swiggyGross: 29450, swiggyDedPct: 0.23 },
    { zomatoOrders: 48, zomatoGross: 38920, zomatoDedPct: 0.23, swiggyOrders: 44, swiggyGross: 35600, swiggyDedPct: 0.24 },
    { zomatoOrders: 39, zomatoGross: 31150, zomatoDedPct: 0.22, swiggyOrders: 35, swiggyGross: 27840, swiggyDedPct: 0.23 },
    { zomatoOrders: 30, zomatoGross: 22960, zomatoDedPct: 0.21, swiggyOrders: 27, swiggyGross: 20790, swiggyDedPct: 0.22 },
    { zomatoOrders: 35, zomatoGross: 27140, zomatoDedPct: 0.22, swiggyOrders: 31, swiggyGross: 24210, swiggyDedPct: 0.22 },
    { zomatoOrders: 38, zomatoGross: 29870, zomatoDedPct: 0.22, swiggyOrders: 33, swiggyGross: 25940, swiggyDedPct: 0.23 },
    { zomatoOrders: 41, zomatoGross: 32540, zomatoDedPct: 0.22, swiggyOrders: 38, swiggyGross: 30120, swiggyDedPct: 0.23 },
    { zomatoOrders: 51, zomatoGross: 41860, zomatoDedPct: 0.23, swiggyOrders: 46, swiggyGross: 37490, swiggyDedPct: 0.24 },
    { zomatoOrders: 54, zomatoGross: 44720, zomatoDedPct: 0.23, swiggyOrders: 49, swiggyGross: 40350, swiggyDedPct: 0.24 },
    { zomatoOrders: 45, zomatoGross: 36480, zomatoDedPct: 0.22, swiggyOrders: 40, swiggyGross: 32260, swiggyDedPct: 0.23 },
  ];

  const entries: AggregatorAnalyticsEntry[] = [];
  const baseDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  dailyPatterns.forEach((day, idx) => {
    const offsetDays = dailyPatterns.length - 1 - idx;
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - offsetDays);
    const dateStr = formatIsoDate(d);
    const timestamp = `${dateStr}T22:30:00.000Z`;

    const zDed = Math.round(day.zomatoGross * day.zomatoDedPct);
    const sDed = Math.round(day.swiggyGross * day.swiggyDedPct);

    entries.push({
      id: `seed-zomato-${dateStr}`,
      platform: 'Zomato',
      date: dateStr,
      orders: day.zomatoOrders,
      grossSalesInr: day.zomatoGross,
      deductionsInr: zDed,
      netPayoutInr: day.zomatoGross - zDed,
      source: 'Seeded',
      notes: 'Daily Zomato settlement',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    entries.push({
      id: `seed-swiggy-${dateStr}`,
      platform: 'Swiggy',
      date: dateStr,
      orders: day.swiggyOrders,
      grossSalesInr: day.swiggyGross,
      deductionsInr: sDed,
      netPayoutInr: day.swiggyGross - sDed,
      source: 'Seeded',
      notes: 'Daily Swiggy settlement',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseNumericCurrency(raw: string | undefined): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/INR/gi, '').trim();
  if (!cleaned) return NaN;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : NaN;
}

function normalizeDateString(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatIsoDate(parsed);
  }
  return null;
}

function normalizePlatformName(raw: string | undefined): AggregatorPlatform | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower.includes('zomato')) return 'Zomato';
  if (lower.includes('swiggy')) return 'Swiggy';
  return null;
}

export const SAMPLE_AGGREGATOR_CSV = [
  'Platform,Date,Orders,Gross Sales,Deductions,Notes',
  `Zomato,${formatIsoDate(new Date())},49,39400,8668,Weekend dinner surge`,
  `Swiggy,${formatIsoDate(new Date())},43,34150,7854,Weekend dinner surge`,
].join('\n');

export function parseSampleFriendlyCsv(csvText: string): ParsedCsvResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      entries: [],
      skippedRows: 0,
      errors: ['CSV must include a header row and at least one data row.'],
    };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const findCol = (candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h.includes(c)));

  const platformIdx = findCol(['platform', 'aggregator', 'channel', 'partner']);
  const dateIdx = findCol(['date', 'day', 'settlement']);
  const ordersIdx = findCol(['order', 'count', 'qty']);
  const grossIdx = findCol(['gross', 'sales', 'revenue', 'total']);
  const deductionsIdx = findCol(['deduction', 'commission', 'fee', 'discount']);
  const netIdx = findCol(['net', 'payout', 'settled']);
  const notesIdx = findCol(['note', 'remark', 'comment']);

  if (dateIdx === -1 || ordersIdx === -1 || grossIdx === -1) {
    return {
      entries: [],
      skippedRows: lines.length - 1,
      errors: [
        'Missing required columns. Expected headers such as Platform, Date, Orders, Gross Sales, Deductions.',
      ],
    };
  }

  const entries: AggregatorEntryInput[] = [];
  const errors: string[] = [];
  let skippedRows = 0;

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const cols = splitCsvLine(lines[rowIdx]);
    // Support either Platform in column 0 or Date in column 0 if Platform header wasn't matched cleanly
    let platform =
      platformIdx !== -1 ? normalizePlatformName(cols[platformIdx]) : null;
    let dateStr = normalizeDateString(cols[dateIdx]);

    if (!platform && platformIdx === -1) {
      // Fallback: inspect first column if not already date
      platform = normalizePlatformName(cols[0]);
    }
    if (!dateStr && platformIdx !== -1 && dateIdx !== -1) {
      dateStr = normalizeDateString(cols[platformIdx]);
      if (dateStr && !platform) {
        platform = normalizePlatformName(cols[dateIdx]);
      }
    }

    const orders = parseNumericCurrency(cols[ordersIdx]);
    const grossSalesInr = parseNumericCurrency(cols[grossIdx]);

    let deductionsInr =
      deductionsIdx !== -1 ? parseNumericCurrency(cols[deductionsIdx]) : NaN;
    const parsedNet = netIdx !== -1 ? parseNumericCurrency(cols[netIdx]) : NaN;

    if (Number.isNaN(deductionsInr)) {
      deductionsInr = !Number.isNaN(parsedNet)
        ? Math.max(0, grossSalesInr - parsedNet)
        : 0;
    }

    if (
      !platform ||
      !dateStr ||
      Number.isNaN(orders) ||
      orders < 0 ||
      Number.isNaN(grossSalesInr) ||
      grossSalesInr < 0
    ) {
      skippedRows += 1;
      if (errors.length < 4) {
        errors.push(`Row ${rowIdx + 1}: Invalid platform, date, orders, or gross sales.`);
      }
      continue;
    }

    entries.push({
      platform,
      date: dateStr,
      orders,
      grossSalesInr,
      deductionsInr: Math.max(0, deductionsInr),
      source: 'CSV',
      notes: notesIdx !== -1 ? cols[notesIdx] || undefined : undefined,
    });
  }

  return { entries, skippedRows, errors };
}

export class UnauthorizedAggregatorError extends Error {
  constructor() {
    super('Unauthorized Access');
    this.name = 'UnauthorizedAggregatorError';
  }
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    throw new UnauthorizedAggregatorError();
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected response from analytics service.');
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Analytics request failed.');
  }
  return data;
}

export const dataService = {
  async listAggregatorEntries(
    token: string,
  ): Promise<AggregatorAnalyticsEntry[]> {
    const res = await fetch('/api/admin/aggregators', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseJsonOrThrow<{
      entries: AggregatorAnalyticsEntry[];
    }>(res);
    return Array.isArray(data.entries) ? data.entries : [];
  },

  async createAggregatorEntry(
    token: string,
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const res = await fetch('/api/admin/aggregators', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonOrThrow<{ entry: AggregatorAnalyticsEntry }>(
      res,
    );
    return data.entry;
  },

  async importAggregatorEntries(
    token: string,
    rows: AggregatorEntryInput[],
  ): Promise<AggregatorAnalyticsEntry[]> {
    const res = await fetch('/api/admin/aggregators/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ entries: rows }),
    });
    const data = await parseJsonOrThrow<{
      entries: AggregatorAnalyticsEntry[];
    }>(res);
    return Array.isArray(data.entries) ? data.entries : [];
  },

  async updateAggregatorEntry(
    token: string,
    id: string,
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const res = await fetch(
      `/api/admin/aggregators/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );
    const data = await parseJsonOrThrow<{ entry: AggregatorAnalyticsEntry }>(
      res,
    );
    return data.entry;
  },

  async deleteAggregatorEntry(token: string, id: string): Promise<void> {
    const res = await fetch(
      `/api/admin/aggregators/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    await parseJsonOrThrow<{ ok: boolean }>(res);
  },

  parseCsv: parseSampleFriendlyCsv,
};
