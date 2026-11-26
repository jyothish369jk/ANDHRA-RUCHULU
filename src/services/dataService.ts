import { requireSupabaseClient } from '../lib/supabase';
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
export const ORDERS_UPDATED_EVENT = 'ar-orders-updated';

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'New',
  'Pending',
  'Preparing',
  'Delivered',
  'Cancelled',
];

export function sanitizeCustomerOrder(raw: unknown): CustomerOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawId = obj.id;
  const id = rawId !== undefined && rawId !== null ? String(rawId).trim() : '';
  if (!id) return null;

  const rawName = obj.customer_name ?? obj.customerName;
  const customerName =
    typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Guest';

  const rawPhone = obj.phone_number ?? obj.customerPhone;
  const customerPhone =
    typeof rawPhone === 'string' ? rawPhone.trim() : String(rawPhone ?? '').trim();

  let parsedRawItems: unknown[] = [];
  if (Array.isArray(obj.items)) {
    parsedRawItems = obj.items;
  } else if (typeof obj.items === 'string') {
    try {
      const maybeArr = JSON.parse(obj.items);
      if (Array.isArray(maybeArr)) parsedRawItems = maybeArr;
    } catch {
      parsedRawItems = [];
    }
  }

  const items: OrderLineItem[] = parsedRawItems
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === 'object'),
    )
    .map((entry, idx) => {
      const quantity =
        Number.isFinite(Number(entry.quantity)) && Number(entry.quantity) > 0
          ? Math.round(Number(entry.quantity))
          : 1;
      const unitPriceInr =
        Number.isFinite(Number(entry.unitPriceInr)) &&
        Number(entry.unitPriceInr) >= 0
          ? Math.round(Number(entry.unitPriceInr))
          : 0;
      const lineTotalInr =
        Number.isFinite(Number(entry.lineTotalInr)) &&
        Number(entry.lineTotalInr) >= 0
          ? Math.round(Number(entry.lineTotalInr))
          : unitPriceInr * quantity;
      return {
        itemId:
          typeof entry.itemId === 'string' && entry.itemId
            ? entry.itemId
            : `item-${idx}`,
        name:
          typeof entry.name === 'string' && entry.name.trim()
            ? entry.name.trim()
            : 'Menu Item',
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
        notes:
          typeof entry.notes === 'string' && entry.notes.trim()
            ? entry.notes.trim()
            : undefined,
        fulfillmentType:
          entry.fulfillmentType === 'Pickup' || entry.fulfillmentType === 'Delivery'
            ? entry.fulfillmentType
            : undefined,
        deliveryAddress:
          typeof entry.deliveryAddress === 'string' &&
          entry.deliveryAddress.trim()
            ? entry.deliveryAddress.trim()
            : undefined,
      };
    });

  const itemFulfillment = items.find((i) => i.fulfillmentType)?.fulfillmentType;
  const itemAddress = items.find((i) => i.deliveryAddress)?.deliveryAddress;

  const fulfillmentType: OrderFulfillmentType =
    obj.fulfillmentType === 'Pickup' || itemFulfillment === 'Pickup'
      ? 'Pickup'
      : 'Delivery';

  const rawAddress = obj.deliveryAddress ?? itemAddress;
  const deliveryAddress =
    typeof rawAddress === 'string' && rawAddress.trim()
      ? rawAddress.trim()
      : fulfillmentType === 'Pickup'
        ? 'Madhuravada Flagship Pickup / Dine-in'
        : 'Address not provided';

  const computedSubtotal = items.reduce((sum, l) => sum + l.lineTotalInr, 0);
  const subtotalInr = Number.isFinite(Number(obj.subtotalInr))
    ? Math.max(0, Math.round(Number(obj.subtotalInr)))
    : computedSubtotal;
  const taxesInr = Number.isFinite(Number(obj.taxesInr))
    ? Math.max(0, Math.round(Number(obj.taxesInr)))
    : Math.round(subtotalInr * 0.05);

  const rawTotal = obj.total_amount ?? obj.totalAmountInr;
  const totalAmountInr = Number.isFinite(Number(rawTotal))
    ? Math.max(0, Math.round(Number(rawTotal)))
    : subtotalInr + taxesInr;

  const status: OrderStatus = VALID_ORDER_STATUSES.includes(
    obj.status as OrderStatus,
  )
    ? (obj.status as OrderStatus)
    : 'New';
  const nowIso = new Date().toISOString();
  const rawCreated = obj.created_at ?? obj.createdAt;
  const rawUpdated = obj.updated_at ?? obj.updatedAt ?? rawCreated;

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
    createdAt:
      typeof rawCreated === 'string' && rawCreated ? rawCreated : nowIso,
    updatedAt:
      typeof rawUpdated === 'string' && rawUpdated ? rawUpdated : nowIso,
  };
}

export function sanitizeAggregatorEntry(
  raw: unknown,
): AggregatorAnalyticsEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawId = obj.id;
  const id = rawId !== undefined && rawId !== null ? String(rawId).trim() : '';

  const rawPlatform = String(obj.platform ?? '')
    .trim()
    .toLowerCase();
  const platform: AggregatorPlatform | null =
    rawPlatform === 'zomato'
      ? 'Zomato'
      : rawPlatform === 'swiggy'
        ? 'Swiggy'
        : null;

  const rawDate = typeof obj.date === 'string' ? obj.date.trim().slice(0, 10) : '';
  if (!id || !platform || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return null;

  const rawOrders = obj.orders_count ?? obj.orders;
  const orders = Number.isFinite(Number(rawOrders))
    ? Math.max(0, Math.round(Number(rawOrders)))
    : 0;

  const rawGross = obj.gross_sales ?? obj.grossSalesInr;
  const grossSalesInr = Number.isFinite(Number(rawGross))
    ? Math.max(0, Math.round(Number(rawGross)))
    : 0;

  const rawDeductions = obj.deductions ?? obj.deductionsInr;
  const deductionsInr = Number.isFinite(Number(rawDeductions))
    ? Math.max(0, Math.round(Number(rawDeductions)))
    : 0;

  const rawNet = obj.net_payout ?? obj.netPayoutInr;
  const netPayoutInr = Number.isFinite(Number(rawNet))
    ? Math.round(Number(rawNet))
    : grossSalesInr - deductionsInr;

  const source =
    obj.source === 'CSV' || obj.source === 'Seeded' || obj.source === 'Manual'
      ? obj.source
      : 'Manual';
  const nowIso = new Date().toISOString();
  const rawCreated = obj.created_at ?? obj.createdAt;
  const rawUpdated = obj.updated_at ?? obj.updatedAt ?? rawCreated;

  return {
    id,
    platform,
    date: rawDate,
    orders,
    grossSalesInr,
    deductionsInr,
    netPayoutInr,
    source,
    notes:
      typeof obj.notes === 'string' && obj.notes.trim()
        ? obj.notes.trim()
        : undefined,
    createdAt:
      typeof rawCreated === 'string' && rawCreated ? rawCreated : nowIso,
    updatedAt:
      typeof rawUpdated === 'string' && rawUpdated ? rawUpdated : nowIso,
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

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
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

function normalizePlatformName(
  raw: string | undefined,
): AggregatorPlatform | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower.includes('zomato')) return 'Zomato';
  if (lower.includes('swiggy')) return 'Swiggy';
  return null;
}

export const SAMPLE_AGGREGATOR_CSV = [
  'Platform,Date,Orders,Gross Sales,Deductions',
  `Zomato,${formatIsoDate(new Date())},49,39400,8668`,
  `Swiggy,${formatIsoDate(new Date())},43,34150,7854`,
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
        errors.push(
          `Row ${rowIdx + 1}: Invalid platform, date, orders, or gross sales.`,
        );
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

export const ordersService = {
  async listOrders(): Promise<CustomerOrder[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.from('customer_orders').select('*');

    if (error) {
      throw new Error(error.message || 'Failed to load customer orders.');
    }

    const rows = Array.isArray(data) ? data : [];
    return rows
      .map(sanitizeCustomerOrder)
      .filter((ord): ord is CustomerOrder => ord !== null)
      .sort(
        (a, b) =>
          (new Date(b.createdAt).getTime() || 0) -
          (new Date(a.createdAt).getTime() || 0),
      );
  },

  async createOrder(params: {
    customerName: string;
    customerPhone: string;
    fulfillmentType: OrderFulfillmentType;
    deliveryAddress: string;
    cartItems: CartItem[];
  }): Promise<CustomerOrder> {
    const supabase = requireSupabaseClient();
    const resolvedAddress =
      params.fulfillmentType === 'Delivery'
        ? params.deliveryAddress.trim()
        : params.deliveryAddress.trim() || 'Madhuravada Flagship Pickup / Dine-in';

    const lineItems: OrderLineItem[] = params.cartItems.map((entry, idx) => ({
      itemId: entry.item.id,
      name: entry.item.name,
      quantity: entry.quantity,
      spicePreference: entry.spicePreference,
      portionStyle: entry.portionStyle,
      unitPriceInr: entry.unitPriceInr,
      lineTotalInr: entry.unitPriceInr * entry.quantity,
      notes: entry.notes,
      ...(idx === 0
        ? {
            fulfillmentType: params.fulfillmentType,
            deliveryAddress: resolvedAddress,
          }
        : {}),
    }));

    const subtotalInr = lineItems.reduce(
      (sum, line) => sum + line.lineTotalInr,
      0,
    );
    const taxesInr = Math.round(subtotalInr * 0.05);
    const totalAmountInr = subtotalInr + taxesInr;

    const { data, error } = await supabase
      .from('customer_orders')
      .insert({
        customer_name: params.customerName.trim(),
        phone_number: params.customerPhone.replace(/\D/g, '').slice(-10),
        items: lineItems,
        total_amount: totalAmountInr,
        status: 'New',
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to submit customer order.');
    }

    const sanitized = sanitizeCustomerOrder(data);
    if (!sanitized) {
      throw new Error('Unexpected order response from database.');
    }

    notifyOrdersUpdated();
    return sanitized;
  },

  async updateOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
  ): Promise<CustomerOrder> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('customer_orders')
      .update({ status: nextStatus })
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update order status.');
    }

    const sanitized = sanitizeCustomerOrder(data);
    if (!sanitized) {
      throw new Error(`Order #${orderId} could not be found.`);
    }

    notifyOrdersUpdated();
    return sanitized;
  },

  async deleteOrder(orderId: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('customer_orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      throw new Error(error.message || 'Failed to delete customer order.');
    }

    notifyOrdersUpdated();
  },
};

export const dataService = {
  async listAggregatorEntries(
    _token?: string,
  ): Promise<AggregatorAnalyticsEntry[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('delivery_analytics')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      throw new Error(
        error.message || 'Failed to load Zomato & Swiggy analytics.',
      );
    }

    const rows = Array.isArray(data) ? data : [];
    return rows
      .map(sanitizeAggregatorEntry)
      .filter((item): item is AggregatorAnalyticsEntry => item !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async createAggregatorEntry(
    _token: string,
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const supabase = requireSupabaseClient();
    const gross = Math.max(0, Math.round(payload.grossSalesInr));
    const ded = Math.max(0, Math.round(payload.deductionsInr));
    const net = gross - ded;

    const { data, error } = await supabase
      .from('delivery_analytics')
      .insert({
        platform: payload.platform,
        date: payload.date,
        orders_count: Math.max(0, Math.round(payload.orders)),
        gross_sales: gross,
        deductions: ded,
        net_payout: net,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to log aggregator orders.');
    }

    const sanitized = sanitizeAggregatorEntry(data);
    if (!sanitized) {
      throw new Error('Unexpected analytics response from database.');
    }
    return sanitized;
  },

  async importAggregatorEntries(
    _token: string,
    rows: AggregatorEntryInput[],
  ): Promise<AggregatorAnalyticsEntry[]> {
    const supabase = requireSupabaseClient();
    const insertRows = rows.map((row) => {
      const gross = Math.max(0, Math.round(row.grossSalesInr));
      const ded = Math.max(0, Math.round(row.deductionsInr));
      return {
        platform: row.platform,
        date: row.date,
        orders_count: Math.max(0, Math.round(row.orders)),
        gross_sales: gross,
        deductions: ded,
        net_payout: gross - ded,
      };
    });

    const { data, error } = await supabase
      .from('delivery_analytics')
      .insert(insertRows)
      .select('*');

    if (error) {
      throw new Error(error.message || 'Failed to import CSV rows.');
    }

    const inserted = Array.isArray(data) ? data : [];
    return inserted
      .map((item): AggregatorAnalyticsEntry | null => {
        const sanitized = sanitizeAggregatorEntry(item);
        return sanitized ? { ...sanitized, source: 'CSV' } : null;
      })
      .filter((item): item is AggregatorAnalyticsEntry => item !== null);
  },

  async updateAggregatorEntry(
    _token: string,
    id: string,
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const supabase = requireSupabaseClient();
    const gross = Math.max(0, Math.round(payload.grossSalesInr));
    const ded = Math.max(0, Math.round(payload.deductionsInr));
    const net = gross - ded;

    const { data, error } = await supabase
      .from('delivery_analytics')
      .update({
        platform: payload.platform,
        date: payload.date,
        orders_count: Math.max(0, Math.round(payload.orders)),
        gross_sales: gross,
        deductions: ded,
        net_payout: net,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update analytics entry.');
    }

    const sanitized = sanitizeAggregatorEntry(data);
    if (!sanitized) {
      throw new Error('Analytics entry not found.');
    }
    return sanitized;
  },

  async deleteAggregatorEntry(_token: string, id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('delivery_analytics')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message || 'Failed to delete analytics entry.');
    }
  },

  parseCsv: parseSampleFriendlyCsv,
};
