import type {
  AggregatorAnalyticsEntry,
  AggregatorEntryInput,
  AggregatorPlatform,
  AggregatorSettlementStatus,
  CartItem,
  CustomerOrder,
  OrderFulfillmentType,
  OrderLineItem,
  OrderStatus,
} from '../types/restaurant';

export const LOCAL_ADMIN_SESSION_TOKEN = 'ar_local_admin_session';
export const ORDERS_UPDATED_EVENT = 'ar-orders-updated';
export const CUSTOMER_ORDERS_STORAGE_KEY = 'andhra_ruchulu_customer_orders_v1';
export const AGGREGATOR_ENTRIES_STORAGE_KEY =
  'andhra_ruchulu_delivery_analytics_v1';

const DEFAULT_ADMIN_PIN = '5588';

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'New',
  'Pending',
  'Preparing',
  'Delivered',
  'Cancelled',
];

let inMemoryOrdersFallback: CustomerOrder[] = [];
let inMemoryAggregatorsFallback: AggregatorAnalyticsEntry[] | null = null;

function generateLocalId(prefix: string): string {
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomSuffix}`;
}

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
    typeof rawPhone === 'string'
      ? rawPhone.trim()
      : String(rawPhone ?? '').trim();

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
          entry.fulfillmentType === 'Pickup' ||
          entry.fulfillmentType === 'Delivery'
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

function computeDefaultBreakdown(
  platform: AggregatorPlatform,
  grossSalesInr: number,
  deductionsInr: number,
  orders: number,
): {
  commissionInr: number;
  gstInr: number;
  packagingInr: number;
  adsDiscountInr: number;
} {
  if (deductionsInr <= 0 || grossSalesInr <= 0) {
    return {
      commissionInr: 0,
      gstInr: 0,
      packagingInr: 0,
      adsDiscountInr: 0,
    };
  }
  const baseCommissionRate = platform === 'Zomato' ? 0.175 : 0.182;
  const rawCommission = Math.round(grossSalesInr * baseCommissionRate);
  const commissionInr = Math.min(
    Math.round(deductionsInr * 0.78),
    Math.max(0, rawCommission),
  );
  const gstInr = Math.min(
    Math.max(0, deductionsInr - commissionInr),
    Math.round(commissionInr * 0.18),
  );
  const remainder = Math.max(0, deductionsInr - commissionInr - gstInr);
  const packagingInr = Math.min(remainder, Math.round(orders * 14));
  const adsDiscountInr = Math.max(0, remainder - packagingInr);
  return {
    commissionInr,
    gstInr,
    packagingInr,
    adsDiscountInr,
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

  const rawCancelled = obj.cancelled_orders ?? obj.cancelledOrders;
  const cancelledOrders = Number.isFinite(Number(rawCancelled))
    ? Math.max(0, Math.round(Number(rawCancelled)))
    : 0;

  const rawGross = obj.gross_sales ?? obj.grossSalesInr;
  const grossSalesInr = Number.isFinite(Number(rawGross))
    ? Math.max(0, Math.round(Number(rawGross)))
    : 0;

  const rawDeductions = obj.deductions ?? obj.deductionsInr;
  const deductionsInr = Number.isFinite(Number(rawDeductions))
    ? Math.max(0, Math.round(Number(rawDeductions)))
    : 0;

  const fallbackBreakdown = computeDefaultBreakdown(
    platform,
    grossSalesInr,
    deductionsInr,
    orders,
  );

  const commissionInr = Number.isFinite(Number(obj.commissionInr))
    ? Math.max(0, Math.round(Number(obj.commissionInr)))
    : fallbackBreakdown.commissionInr;
  const gstInr = Number.isFinite(Number(obj.gstInr))
    ? Math.max(0, Math.round(Number(obj.gstInr)))
    : fallbackBreakdown.gstInr;
  const packagingInr = Number.isFinite(Number(obj.packagingInr))
    ? Math.max(0, Math.round(Number(obj.packagingInr)))
    : fallbackBreakdown.packagingInr;
  const adsDiscountInr = Number.isFinite(Number(obj.adsDiscountInr))
    ? Math.max(0, Math.round(Number(obj.adsDiscountInr)))
    : fallbackBreakdown.adsDiscountInr;

  const rawNet = obj.net_payout ?? obj.netPayoutInr;
  const netPayoutInr = Number.isFinite(Number(rawNet))
    ? Math.round(Number(rawNet))
    : grossSalesInr - deductionsInr;

  const rawStatus = String(obj.settlementStatus ?? '')
    .trim()
    .toLowerCase();
  const settlementStatus: AggregatorSettlementStatus =
    rawStatus === 'processing' || rawStatus === 'pending'
      ? 'Processing'
      : 'Settled';

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
    cancelledOrders,
    grossSalesInr,
    deductionsInr,
    commissionInr,
    gstInr,
    packagingInr,
    adsDiscountInr,
    netPayoutInr,
    settlementStatus,
    orderId:
      typeof obj.orderId === 'string' && obj.orderId.trim()
        ? obj.orderId.trim()
        : undefined,
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

function readOrdersStorage(): CustomerOrder[] {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_ORDERS_STORAGE_KEY);
    if (!raw) return [...inMemoryOrdersFallback];
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
    return [...inMemoryOrdersFallback];
  }
}

function writeOrdersStorage(orders: CustomerOrder[]): void {
  inMemoryOrdersFallback = [...orders];
  try {
    window.localStorage.setItem(
      CUSTOMER_ORDERS_STORAGE_KEY,
      JSON.stringify(orders),
    );
  } catch {
    // Fallback remains in memory if storage quota/privacy blocks localStorage
  }
}

function readAggregatorsStorage(): AggregatorAnalyticsEntry[] {
  try {
    const raw = window.localStorage.getItem(AGGREGATOR_ENTRIES_STORAGE_KEY);
    if (raw === null) {
      const seeded =
        inMemoryAggregatorsFallback ?? buildSeededAggregatorEntries();
      writeAggregatorsStorage(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed
      .map(sanitizeAggregatorEntry)
      .filter((item): item is AggregatorAnalyticsEntry => item !== null)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Upgrade legacy 7-day seeded datasets cleanly while keeping user-added Manual/CSV rows
    const seededRows = sanitized.filter((item) => item.source === 'Seeded');
    if (seededRows.length > 0 && seededRows.length < 30) {
      const userRows = sanitized.filter((item) => item.source !== 'Seeded');
      const freshSeed = buildSeededAggregatorEntries();
      const upgraded = [...userRows, ...freshSeed].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      writeAggregatorsStorage(upgraded);
      return upgraded;
    }

    inMemoryAggregatorsFallback = sanitized;
    return sanitized;
  } catch {
    if (inMemoryAggregatorsFallback === null) {
      inMemoryAggregatorsFallback = buildSeededAggregatorEntries();
    }
    return [...inMemoryAggregatorsFallback];
  }
}

function writeAggregatorsStorage(entries: AggregatorAnalyticsEntry[]): void {
  inMemoryAggregatorsFallback = [...entries];
  try {
    window.localStorage.setItem(
      AGGREGATOR_ENTRIES_STORAGE_KEY,
      JSON.stringify(entries),
    );
  } catch {
    // Fallback remains in memory if localStorage is unavailable
  }
}

export function getExpectedAdminPin(): string {
  return DEFAULT_ADMIN_PIN;
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
  const TOTAL_DAYS = 60;
  const entries: AggregatorAnalyticsEntry[] = [];
  const baseDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  // Day-of-week demand multipliers (0 = Sun ... 6 = Sat)
  const dowMultiplier = [1.34, 0.86, 0.91, 0.96, 1.04, 1.24, 1.41];

  for (let offset = TOTAL_DAYS - 1; offset >= 0; offset -= 1) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - offset);
    const dateStr = formatIsoDate(d);
    const timestamp = `${dateStr}T22:30:00.000Z`;
    const dow = d.getDay();
    const wave = Math.sin((TOTAL_DAYS - offset) * 0.45) * 0.06;
    const growthFactor = 1 + ((TOTAL_DAYS - 1 - offset) / TOTAL_DAYS) * 0.14;
    const dayScale = (dowMultiplier[dow] ?? 1) * (1 + wave) * growthFactor;

    const zOrders = Math.max(18, Math.round(28 * dayScale + ((offset * 3) % 5)));
    const sOrders = Math.max(16, Math.round(25 * dayScale + ((offset * 5) % 4)));

    const zAov = 765 + ((offset * 17) % 65);
    const sAov = 748 + ((offset * 19) % 58);

    const zGross = Math.round(zOrders * zAov);
    const sGross = Math.round(sOrders * sAov);

    const zCommission = Math.round(zGross * 0.175);
    const zGst = Math.round(zCommission * 0.18);
    const zPackaging = Math.round(zOrders * 15);
    const zAds = offset % 3 === 0 ? Math.round(zGross * 0.021) : Math.round(zGross * 0.012);
    const zDed = zCommission + zGst + zPackaging + zAds;

    const sCommission = Math.round(sGross * 0.182);
    const sGst = Math.round(sCommission * 0.18);
    const sPackaging = Math.round(sOrders * 14);
    const sAds = offset % 2 === 0 ? Math.round(sGross * 0.019) : Math.round(sGross * 0.011);
    const sDed = sCommission + sGst + sPackaging + sAds;

    const zCancelled = dow === 0 || dow === 6 ? 2 : offset % 4 === 0 ? 1 : 0;
    const sCancelled = dow === 6 ? 2 : offset % 3 === 0 ? 1 : 0;

    const status: AggregatorSettlementStatus =
      offset <= 1 ? 'Processing' : 'Settled';

    entries.push({
      id: `seed-zomato-${dateStr}`,
      platform: 'Zomato',
      date: dateStr,
      orders: zOrders,
      cancelledOrders: zCancelled,
      grossSalesInr: zGross,
      deductionsInr: zDed,
      commissionInr: zCommission,
      gstInr: zGst,
      packagingInr: zPackaging,
      adsDiscountInr: zAds,
      netPayoutInr: zGross - zDed,
      settlementStatus: status,
      source: 'Seeded',
      notes: dow === 0 || dow === 6 ? 'Weekend peak service' : 'Daily Zomato settlement',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    entries.push({
      id: `seed-swiggy-${dateStr}`,
      platform: 'Swiggy',
      date: dateStr,
      orders: sOrders,
      cancelledOrders: sCancelled,
      grossSalesInr: sGross,
      deductionsInr: sDed,
      commissionInr: sCommission,
      gstInr: sGst,
      packagingInr: sPackaging,
      adsDiscountInr: sAds,
      netPayoutInr: sGross - sDed,
      settlementStatus: status,
      source: 'Seeded',
      notes: dow === 0 || dow === 6 ? 'Weekend peak service' : 'Daily Swiggy settlement',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

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
  'Date,Platform,Order_ID,Gross_Amount,Commission,GST,Net_Payout,Status',
  `${formatIsoDate(new Date())},Zomato,ZMT-98412,1840,322,58,1460,Settled`,
  `${formatIsoDate(new Date())},Swiggy,SWG-64109,1520,277,50,1193,Settled`,
  `${formatIsoDate(new Date())},Zomato,ZMT-98485,2260,396,71,1793,Processing`,
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
  const dateIdx = findCol(['date', 'day']);
  const orderIdIdx = findCol(['order_id', 'order id', 'orderid', 'txn', 'reference']);
  const ordersIdx = headers.findIndex(
    (h) =>
      (h === 'orders' ||
        h === 'orders_count' ||
        h.includes('count') ||
        h.includes('qty')) &&
      !h.includes('id'),
  );
  const grossIdx = findCol(['gross', 'sales', 'revenue', 'amount', 'total']);
  const commissionIdx = findCol(['commission', 'comm']);
  const gstIdx = findCol(['gst', 'tax']);
  const deductionsIdx = findCol(['deduction', 'fee', 'discount']);
  const netIdx = findCol(['net', 'payout', 'settled']);
  const statusIdx = findCol(['status', 'state']);
  const notesIdx = findCol(['note', 'remark', 'comment']);

  if (dateIdx === -1 || grossIdx === -1 || (ordersIdx === -1 && orderIdIdx === -1)) {
    return {
      entries: [],
      skippedRows: lines.length - 1,
      errors: [
        'Missing required columns. Expected Partner CSV (Date, Platform, Order_ID, Gross_Amount, Commission, GST, Net_Payout, Status) or Summary CSV (Platform, Date, Orders, Gross Sales, Deductions).',
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

    const orderId =
      orderIdIdx !== -1 && cols[orderIdIdx]?.trim()
        ? cols[orderIdIdx].trim()
        : undefined;
    const orders =
      ordersIdx !== -1
        ? parseNumericCurrency(cols[ordersIdx])
        : orderId
          ? 1
          : 1;
    const grossSalesInr = parseNumericCurrency(cols[grossIdx]);

    const commissionVal =
      commissionIdx !== -1 ? parseNumericCurrency(cols[commissionIdx]) : NaN;
    const gstVal = gstIdx !== -1 ? parseNumericCurrency(cols[gstIdx]) : NaN;
    const explicitDed =
      deductionsIdx !== -1 ? parseNumericCurrency(cols[deductionsIdx]) : NaN;
    const parsedNet = netIdx !== -1 ? parseNumericCurrency(cols[netIdx]) : NaN;

    let deductionsInr = 0;
    if (!Number.isNaN(explicitDed)) {
      deductionsInr = explicitDed;
    } else if (!Number.isNaN(commissionVal) || !Number.isNaN(gstVal)) {
      deductionsInr =
        (Number.isNaN(commissionVal) ? 0 : commissionVal) +
        (Number.isNaN(gstVal) ? 0 : gstVal);
    } else if (!Number.isNaN(parsedNet) && !Number.isNaN(grossSalesInr)) {
      deductionsInr = Math.max(0, grossSalesInr - parsedNet);
    }

    const rawStatus = statusIdx !== -1 ? (cols[statusIdx] || '').trim().toLowerCase() : '';
    const settlementStatus: AggregatorSettlementStatus =
      rawStatus.includes('process') || rawStatus.includes('pend')
        ? 'Processing'
        : 'Settled';

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
          `Row ${rowIdx + 1}: Invalid platform, date, orders, or gross amount.`,
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
      commissionInr: !Number.isNaN(commissionVal) ? Math.max(0, commissionVal) : undefined,
      gstInr: !Number.isNaN(gstVal) ? Math.max(0, gstVal) : undefined,
      settlementStatus,
      orderId,
      source: 'CSV',
      notes:
        notesIdx !== -1 && cols[notesIdx]
          ? cols[notesIdx]
          : orderId
            ? `Order ${orderId}`
            : undefined,
    });
  }

  return { entries, skippedRows, errors };
}

export const ordersService = {
  async listOrders(): Promise<CustomerOrder[]> {
    return readOrdersStorage();
  },

  async createOrder(params: {
    customerName: string;
    customerPhone: string;
    fulfillmentType: OrderFulfillmentType;
    deliveryAddress: string;
    cartItems: CartItem[];
  }): Promise<CustomerOrder> {
    const resolvedAddress =
      params.fulfillmentType === 'Delivery'
        ? params.deliveryAddress.trim()
        : params.deliveryAddress.trim() || 'Madhuravada Flagship Pickup / Dine-in';

    const lineItems: OrderLineItem[] = params.cartItems.map((entry) => ({
      itemId: entry.item.id,
      name: entry.item.name,
      quantity: entry.quantity,
      spicePreference: entry.spicePreference,
      portionStyle: entry.portionStyle,
      unitPriceInr: entry.unitPriceInr,
      lineTotalInr: entry.unitPriceInr * entry.quantity,
      notes: entry.notes,
      fulfillmentType: params.fulfillmentType,
      deliveryAddress: resolvedAddress,
    }));

    const subtotalInr = lineItems.reduce(
      (sum, line) => sum + line.lineTotalInr,
      0,
    );
    const taxesInr = Math.round(subtotalInr * 0.05);
    const totalAmountInr = subtotalInr + taxesInr;
    const nowIso = new Date().toISOString();

    const created: CustomerOrder = {
      id: `AR-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone.replace(/\D/g, '').slice(-10),
      fulfillmentType: params.fulfillmentType,
      deliveryAddress: resolvedAddress,
      items: lineItems,
      subtotalInr,
      taxesInr,
      totalAmountInr,
      status: 'New',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const existing = readOrdersStorage();
    writeOrdersStorage([created, ...existing]);
    notifyOrdersUpdated();
    return created;
  },

  async updateOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
  ): Promise<CustomerOrder> {
    const existing = readOrdersStorage();
    const targetIdx = existing.findIndex((o) => o.id === orderId);
    if (targetIdx === -1) {
      throw new Error(`Order #${orderId} could not be found.`);
    }

    const updated: CustomerOrder = {
      ...existing[targetIdx],
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    const nextList = existing.map((o) => (o.id === orderId ? updated : o));
    writeOrdersStorage(nextList);
    notifyOrdersUpdated();
    return updated;
  },

  async deleteOrder(orderId: string): Promise<void> {
    const existing = readOrdersStorage();
    const filtered = existing.filter((o) => o.id !== orderId);
    writeOrdersStorage(filtered);
    notifyOrdersUpdated();
  },
};

export const dataService = {
  async listAggregatorEntries(): Promise<AggregatorAnalyticsEntry[]> {
    return readAggregatorsStorage();
  },

  async createAggregatorEntry(
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const orders = Math.max(0, Math.round(payload.orders));
    const gross = Math.max(0, Math.round(payload.grossSalesInr));
    const ded = Math.max(0, Math.round(payload.deductionsInr));
    const breakdown = computeDefaultBreakdown(
      payload.platform,
      gross,
      ded,
      orders,
    );
    const nowIso = new Date().toISOString();

    const created: AggregatorAnalyticsEntry = {
      id: generateLocalId('agg'),
      platform: payload.platform,
      date: payload.date,
      orders,
      cancelledOrders: Math.max(0, Math.round(payload.cancelledOrders ?? 0)),
      grossSalesInr: gross,
      deductionsInr: ded,
      commissionInr: payload.commissionInr ?? breakdown.commissionInr,
      gstInr: payload.gstInr ?? breakdown.gstInr,
      packagingInr: payload.packagingInr ?? breakdown.packagingInr,
      adsDiscountInr: payload.adsDiscountInr ?? breakdown.adsDiscountInr,
      netPayoutInr: gross - ded,
      settlementStatus: payload.settlementStatus ?? 'Settled',
      orderId: payload.orderId?.trim() || undefined,
      source: payload.source || 'Manual',
      notes: payload.notes?.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const existing = readAggregatorsStorage();
    const nextList = [created, ...existing].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    writeAggregatorsStorage(nextList);
    return created;
  },

  async importAggregatorEntries(
    rows: AggregatorEntryInput[],
  ): Promise<AggregatorAnalyticsEntry[]> {
    const nowIso = new Date().toISOString();
    const createdRows: AggregatorAnalyticsEntry[] = rows.map((row, idx) => {
      const orders = Math.max(0, Math.round(row.orders));
      const gross = Math.max(0, Math.round(row.grossSalesInr));
      const ded = Math.max(0, Math.round(row.deductionsInr));
      const breakdown = computeDefaultBreakdown(row.platform, gross, ded, orders);
      return {
        id: `${generateLocalId('csv')}-${idx}`,
        platform: row.platform,
        date: row.date,
        orders,
        cancelledOrders: Math.max(0, Math.round(row.cancelledOrders ?? 0)),
        grossSalesInr: gross,
        deductionsInr: ded,
        commissionInr: row.commissionInr ?? breakdown.commissionInr,
        gstInr: row.gstInr ?? breakdown.gstInr,
        packagingInr: row.packagingInr ?? breakdown.packagingInr,
        adsDiscountInr: row.adsDiscountInr ?? breakdown.adsDiscountInr,
        netPayoutInr: gross - ded,
        settlementStatus: row.settlementStatus ?? 'Settled',
        orderId: row.orderId?.trim() || undefined,
        source: 'CSV',
        notes: row.notes?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const existing = readAggregatorsStorage();
    const merged = [...createdRows, ...existing].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    writeAggregatorsStorage(merged);
    return createdRows;
  },

  async updateAggregatorEntry(
    id: string,
    payload: AggregatorEntryInput,
  ): Promise<AggregatorAnalyticsEntry> {
    const existing = readAggregatorsStorage();
    const targetIdx = existing.findIndex((item) => item.id === id);
    if (targetIdx === -1) {
      throw new Error('Analytics entry not found.');
    }

    const orders = Math.max(0, Math.round(payload.orders));
    const gross = Math.max(0, Math.round(payload.grossSalesInr));
    const ded = Math.max(0, Math.round(payload.deductionsInr));
    const breakdown = computeDefaultBreakdown(
      payload.platform,
      gross,
      ded,
      orders,
    );
    const updated: AggregatorAnalyticsEntry = {
      ...existing[targetIdx],
      platform: payload.platform,
      date: payload.date,
      orders,
      cancelledOrders:
        payload.cancelledOrders !== undefined
          ? Math.max(0, Math.round(payload.cancelledOrders))
          : existing[targetIdx].cancelledOrders ?? 0,
      grossSalesInr: gross,
      deductionsInr: ded,
      commissionInr: payload.commissionInr ?? breakdown.commissionInr,
      gstInr: payload.gstInr ?? breakdown.gstInr,
      packagingInr: payload.packagingInr ?? breakdown.packagingInr,
      adsDiscountInr: payload.adsDiscountInr ?? breakdown.adsDiscountInr,
      netPayoutInr: gross - ded,
      settlementStatus:
        payload.settlementStatus ??
        existing[targetIdx].settlementStatus ??
        'Settled',
      orderId: payload.orderId?.trim() || existing[targetIdx].orderId,
      source: payload.source || existing[targetIdx].source,
      notes: payload.notes?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    const nextList = existing
      .map((item) => (item.id === id ? updated : item))
      .sort((a, b) => b.date.localeCompare(a.date));
    writeAggregatorsStorage(nextList);
    return updated;
  },

  async deleteAggregatorEntry(id: string): Promise<void> {
    const existing = readAggregatorsStorage();
    const filtered = existing.filter((item) => item.id !== id);
    writeAggregatorsStorage(filtered);
  },

  parseCsv: parseSampleFriendlyCsv,
};
