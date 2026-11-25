import type {
  AggregatorAnalyticsEntry,
  AggregatorEntryInput,
  AggregatorPlatform,
  CartItem,
  CustomerOrder,
  OrderFulfillmentType,
  OrderLineItem,
  OrderStatus,
} from '../types/restaurant';

export const LOCAL_VERCEL_SESSION_TOKEN = 'ar_local_vercel_session';
export const LOCAL_ORDERS_STORAGE_KEY = 'ar_local_customer_orders';
const LOCAL_AGGREGATORS_STORAGE_KEY = 'ar_local_aggregator_analytics';
const LOCAL_AGGREGATORS_SEEDED_KEY = 'ar_local_aggregator_seeded_v1';
export const ORDERS_UPDATED_EVENT = 'ar-orders-updated';

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Preparing',
  'Delivered',
  'Cancelled',
];

export function sanitizeCustomerOrder(raw: unknown): CustomerOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  if (!id) return null;

  const customerName =
    typeof obj.customerName === 'string' && obj.customerName.trim()
      ? obj.customerName.trim()
      : 'Guest';
  const customerPhone =
    typeof obj.customerPhone === 'string' ? obj.customerPhone.trim() : '';
  const fulfillmentType: OrderFulfillmentType =
    obj.fulfillmentType === 'Pickup' ? 'Pickup' : 'Delivery';
  const deliveryAddress =
    typeof obj.deliveryAddress === 'string' && obj.deliveryAddress.trim()
      ? obj.deliveryAddress.trim()
      : fulfillmentType === 'Pickup'
        ? 'Madhuravada Flagship Pickup / Dine-in'
        : 'Address not provided';

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items: OrderLineItem[] = rawItems
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry, idx) => {
      const quantity = Number.isFinite(Number(entry.quantity)) && Number(entry.quantity) > 0
        ? Math.round(Number(entry.quantity))
        : 1;
      const unitPriceInr = Number.isFinite(Number(entry.unitPriceInr)) && Number(entry.unitPriceInr) >= 0
        ? Math.round(Number(entry.unitPriceInr))
        : 0;
      const lineTotalInr = Number.isFinite(Number(entry.lineTotalInr)) && Number(entry.lineTotalInr) >= 0
        ? Math.round(Number(entry.lineTotalInr))
        : unitPriceInr * quantity;
      return {
        itemId: typeof entry.itemId === 'string' && entry.itemId ? entry.itemId : `item-${idx}`,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Menu Item',
        quantity,
        spicePreference:
          entry.spicePreference === 'Mild Temper' ||
          entry.spicePreference === 'Authentic Andhra' ||
          entry.spicePreference === 'Fiery Guntur'
            ? entry.spicePreference
            : 'Authentic Andhra',
        portionStyle:
          entry.portionStyle === 'Claypot Feast (+₹180)'
            ? 'Claypot Feast (+₹180)'
            : 'Signature Plate',
        unitPriceInr,
        lineTotalInr,
        notes: typeof entry.notes === 'string' && entry.notes.trim() ? entry.notes.trim() : undefined,
      };
    });

  const computedSubtotal = items.reduce((sum, l) => sum + l.lineTotalInr, 0);
  const subtotalInr = Number.isFinite(Number(obj.subtotalInr))
    ? Math.max(0, Math.round(Number(obj.subtotalInr)))
    : computedSubtotal;
  const taxesInr = Number.isFinite(Number(obj.taxesInr))
    ? Math.max(0, Math.round(Number(obj.taxesInr)))
    : Math.round(subtotalInr * 0.05);
  const totalAmountInr = Number.isFinite(Number(obj.totalAmountInr))
    ? Math.max(0, Math.round(Number(obj.totalAmountInr)))
    : subtotalInr + taxesInr;
  const status: OrderStatus = VALID_ORDER_STATUSES.includes(obj.status as OrderStatus)
    ? (obj.status as OrderStatus)
    : 'Pending';
  const nowIso = new Date().toISOString();

  return {
    id,
    customerName,
    customerPhone,
    fulfillmentType,
    deliveryAddress,
    items,
    subtotalInr,
    taxesInr,
    totalAmountInr,
    status,
    createdAt: typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : nowIso,
    updatedAt: typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : nowIso,
  };
}

export function sanitizeAggregatorEntry(raw: unknown): AggregatorAnalyticsEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const platform: AggregatorPlatform | null =
    obj.platform === 'Zomato' || obj.platform === 'Swiggy' ? obj.platform : null;
  const date = typeof obj.date === 'string' ? obj.date.trim() : '';
  if (!id || !platform || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const orders = Number.isFinite(Number(obj.orders)) ? Math.max(0, Math.round(Number(obj.orders))) : 0;
  const grossSalesInr = Number.isFinite(Number(obj.grossSalesInr))
    ? Math.max(0, Math.round(Number(obj.grossSalesInr)))
    : 0;
  const deductionsInr = Number.isFinite(Number(obj.deductionsInr))
    ? Math.max(0, Math.round(Number(obj.deductionsInr)))
    : 0;
  const netPayoutInr = Number.isFinite(Number(obj.netPayoutInr))
    ? Math.round(Number(obj.netPayoutInr))
    : grossSalesInr - deductionsInr;
  const source =
    obj.source === 'CSV' || obj.source === 'Seeded' || obj.source === 'Manual'
      ? obj.source
      : 'Manual';
  const nowIso = new Date().toISOString();

  return {
    id,
    platform,
    date,
    orders,
    grossSalesInr,
    deductionsInr,
    netPayoutInr,
    source,
    notes: typeof obj.notes === 'string' && obj.notes.trim() ? obj.notes.trim() : undefined,
    createdAt: typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : nowIso,
    updatedAt: typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : nowIso,
  };
}

function notifyOrdersUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  } catch {
    // Ignore in non-DOM environments
  }
}

export function getExpectedAdminPin(): string {
  const envPin =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_ADMIN_PIN
      : undefined;
  const cleaned = String(envPin ?? '').trim();
  return cleaned || '5588';
}

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

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

function normalizeDateString(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isValidCalendarDate(year, month, day) ? trimmed : null;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    // Support DD/MM/YYYY by default, and auto-detect MM/DD/YYYY when second part > 12
    const day = second > 12 && first <= 12 ? second : first;
    const month = second > 12 && first <= 12 ? first : second;
    if (!isValidCalendarDate(year, month, day)) {
      return null;
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
    let platform =
      platformIdx !== -1 ? normalizePlatformName(cols[platformIdx]) : null;
    let dateStr = normalizeDateString(cols[dateIdx]);

    if (!platform && platformIdx === -1) {
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

class StaticHostFallbackSignal extends Error {
  constructor() {
    super('Static host mode');
    this.name = 'StaticHostFallbackSignal';
  }
}

function readLocalAggregators(): AggregatorAnalyticsEntry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_AGGREGATORS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed
          .map(sanitizeAggregatorEntry)
          .filter((item): item is AggregatorAnalyticsEntry => item !== null)
          .sort((a, b) => b.date.localeCompare(a.date));
        if (sanitized.length > 0 || window.localStorage.getItem(LOCAL_AGGREGATORS_SEEDED_KEY) === 'true') {
          return sanitized;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  const seeded = buildSeededAggregatorEntries();
  writeLocalAggregators(seeded);
  return seeded;
}

function writeLocalAggregators(entries: AggregatorAnalyticsEntry[]): void {
  try {
    window.localStorage.setItem(LOCAL_AGGREGATORS_SEEDED_KEY, 'true');
    window.localStorage.setItem(
      LOCAL_AGGREGATORS_STORAGE_KEY,
      JSON.stringify(entries),
    );
  } catch {
    // Ignore storage quota/private-mode errors
  }
}

export const localOrdersService = {
  listOrders(): CustomerOrder[] {
    try {
      const raw = window.localStorage.getItem(LOCAL_ORDERS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(sanitizeCustomerOrder)
        .filter((ord): ord is CustomerOrder => ord !== null)
        .sort(
          (a, b) =>
            (new Date(b.createdAt).getTime() || 0) -
            (new Date(a.createdAt).getTime() || 0),
        );
    } catch {
      return [];
    }
  },

  createOrder(params: {
    customerName: string;
    customerPhone: string;
    fulfillmentType: OrderFulfillmentType;
    deliveryAddress: string;
    cartItems: CartItem[];
  }): CustomerOrder {
    const lineItems: OrderLineItem[] = params.cartItems.map((entry) => ({
      itemId: entry.item.id,
      name: entry.item.name,
      quantity: entry.quantity,
      spicePreference: entry.spicePreference,
      portionStyle: entry.portionStyle,
      unitPriceInr: entry.unitPriceInr,
      lineTotalInr: entry.unitPriceInr * entry.quantity,
      notes: entry.notes,
    }));

    const subtotalInr = lineItems.reduce(
      (sum, line) => sum + line.lineTotalInr,
      0,
    );
    const taxesInr = Math.round(subtotalInr * 0.05);
    const totalAmountInr = subtotalInr + taxesInr;
    const nowIso = new Date().toISOString();

    const newOrder: CustomerOrder = {
      id: `AR-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone.replace(/\D/g, '').slice(-10),
      fulfillmentType: params.fulfillmentType,
      deliveryAddress:
        params.fulfillmentType === 'Delivery'
          ? params.deliveryAddress.trim()
          : params.deliveryAddress.trim() || 'Madhuravada Flagship Pickup / Dine-in',
      items: lineItems,
      subtotalInr,
      taxesInr,
      totalAmountInr,
      status: 'Pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const existing = this.listOrders();
    const updated = [newOrder, ...existing];
    try {
      window.localStorage.setItem(
        LOCAL_ORDERS_STORAGE_KEY,
        JSON.stringify(updated),
      );
      notifyOrdersUpdated();
    } catch {
      // Ignore storage errors
    }
    return newOrder;
  },

  updateOrderStatus(orderId: string, nextStatus: OrderStatus): CustomerOrder | null {
    const existing = this.listOrders();
    let updatedOrder: CustomerOrder | null = null;
    const nextList = existing.map((ord) => {
      if (ord.id !== orderId) return ord;
      updatedOrder = {
        ...ord,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      return updatedOrder;
    });
    if (updatedOrder) {
      try {
        window.localStorage.setItem(
          LOCAL_ORDERS_STORAGE_KEY,
          JSON.stringify(nextList),
        );
        notifyOrdersUpdated();
      } catch {
        // Ignore storage errors
      }
    }
    return updatedOrder;
  },

  deleteOrder(orderId: string): boolean {
    const existing = this.listOrders();
    const filtered = existing.filter((ord) => ord.id !== orderId);
    if (filtered.length === existing.length) return false;
    try {
      window.localStorage.setItem(
        LOCAL_ORDERS_STORAGE_KEY,
        JSON.stringify(filtered),
      );
      notifyOrdersUpdated();
    } catch {
      // Ignore storage errors
    }
    return true;
  },
};

async function parseJsonOrFallback<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    throw new UnauthorizedAggregatorError();
  }
  const contentType = res.headers.get('content-type') || '';
  if (res.status === 404 || !contentType.includes('application/json')) {
    throw new StaticHostFallbackSignal();
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
    if (token === LOCAL_VERCEL_SESSION_TOKEN) {
      return readLocalAggregators();
    }
    try {
      const res = await fetch('/api/admin/aggregators', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonOrFallback<{
        entries: AggregatorAnalyticsEntry[];
      }>(res);
      return Array.isArray(data.entries)
        ? data.entries
            .map(sanitizeAggregatorEntry)
            .filter((item): item is AggregatorAnalyticsEntry => item !== null)
        : [];
    } catch (error) {
      if (error instanceof StaticHostFallbackSignal) {
        return readLocalAggregators();
      }
      throw error;
    }
  },

  async createAggregatorEntry(
    token: string,
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const buildLocalEntry = (): AggregatorAnalyticsEntry => {
      const nowIso = new Date().toISOString();
      const gross = Math.round(payload.grossSalesInr);
      const ded = Math.round(payload.deductionsInr);
      const created: AggregatorAnalyticsEntry = {
        id: `agg-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 899)}`,
        platform: payload.platform,
        date: payload.date,
        orders: Math.round(payload.orders),
        grossSalesInr: gross,
        deductionsInr: ded,
        netPayoutInr: gross - ded,
        source: payload.source || 'Manual',
        notes: payload.notes,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const existing = readLocalAggregators();
      writeLocalAggregators([created, ...existing]);
      return created;
    };

    if (token === LOCAL_VERCEL_SESSION_TOKEN) {
      return buildLocalEntry();
    }

    try {
      const res = await fetch('/api/admin/aggregators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonOrFallback<{
        entry: AggregatorAnalyticsEntry;
      }>(res);
      return data.entry;
    } catch (error) {
      if (error instanceof StaticHostFallbackSignal) {
        return buildLocalEntry();
      }
      throw error;
    }
  },

  async importAggregatorEntries(
    token: string,
    rows: AggregatorEntryInput[],
  ): Promise<AggregatorAnalyticsEntry[]> {
    const buildLocalImport = (): AggregatorAnalyticsEntry[] => {
      const nowIso = new Date().toISOString();
      const created: AggregatorAnalyticsEntry[] = rows.map((row, idx) => {
        const gross = Math.round(row.grossSalesInr);
        const ded = Math.round(row.deductionsInr);
        return {
          id: `csv-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          platform: row.platform,
          date: row.date,
          orders: Math.round(row.orders),
          grossSalesInr: gross,
          deductionsInr: ded,
          netPayoutInr: gross - ded,
          source: 'CSV',
          notes: row.notes,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });
      const existing = readLocalAggregators();
      writeLocalAggregators([...created, ...existing]);
      return created;
    };

    if (token === LOCAL_VERCEL_SESSION_TOKEN) {
      return buildLocalImport();
    }

    try {
      const res = await fetch('/api/admin/aggregators/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: rows }),
      });
      const data = await parseJsonOrFallback<{
        entries: AggregatorAnalyticsEntry[];
      }>(res);
      return Array.isArray(data.entries) ? data.entries : [];
    } catch (error) {
      if (error instanceof StaticHostFallbackSignal) {
        return buildLocalImport();
      }
      throw error;
    }
  },

  async updateAggregatorEntry(
    token: string,
    id: string,
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const updateLocal = (): AggregatorAnalyticsEntry => {
      const existing = readLocalAggregators();
      const gross = Math.round(payload.grossSalesInr);
      const ded = Math.round(payload.deductionsInr);
      let updatedItem: AggregatorAnalyticsEntry | null = null;
      const next = existing.map((item) => {
        if (item.id !== id) return item;
        updatedItem = {
          ...item,
          platform: payload.platform,
          date: payload.date,
          orders: Math.round(payload.orders),
          grossSalesInr: gross,
          deductionsInr: ded,
          netPayoutInr: gross - ded,
          source: payload.source || item.source,
          notes: payload.notes,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      });
      if (!updatedItem) {
        throw new Error('Entry not found.');
      }
      writeLocalAggregators(next);
      return updatedItem;
    };

    if (token === LOCAL_VERCEL_SESSION_TOKEN) {
      return updateLocal();
    }

    try {
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
      const data = await parseJsonOrFallback<{
        entry: AggregatorAnalyticsEntry;
      }>(res);
      return data.entry;
    } catch (error) {
      if (error instanceof StaticHostFallbackSignal) {
        return updateLocal();
      }
      throw error;
    }
  },

  async deleteAggregatorEntry(token: string, id: string): Promise<void> {
    const deleteLocal = () => {
      const existing = readLocalAggregators();
      writeLocalAggregators(existing.filter((item) => item.id !== id));
    };

    if (token === LOCAL_VERCEL_SESSION_TOKEN) {
      deleteLocal();
      return;
    }

    try {
      const res = await fetch(
        `/api/admin/aggregators/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      await parseJsonOrFallback<{ ok: boolean }>(res);
    } catch (error) {
      if (error instanceof StaticHostFallbackSignal) {
        deleteLocal();
        return;
      }
      throw error;
    }
  },

  parseCsv: parseSampleFriendlyCsv,
};
