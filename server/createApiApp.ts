import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import type {
  AggregatorAnalyticsEntry,
  AggregatorEntrySource,
  AggregatorPlatform,
  BookingStatus,
  CustomerOrder,
  OrderFulfillmentType,
  OrderLineItem,
  OrderStatus,
  PortionStyle,
  ReservationOccasion,
  SpicePreference,
  TableBooking,
} from '../src/types/restaurant.ts';
import {
  buildSeededAggregatorEntries,
  sanitizeAggregatorEntry,
} from '../src/services/dataService.ts';

const IS_SERVERLESS_READONLY_FS =
  process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

const DATA_DIR = IS_SERVERLESS_READONLY_FS
  ? path.resolve(os.tmpdir(), 'andhra-ruchulu-data')
  : path.resolve(process.cwd(), '.data');
const ORDERS_FILE = path.resolve(DATA_DIR, 'orders.json');
const BOOKINGS_FILE = path.resolve(DATA_DIR, 'bookings.json');
const AGGREGATORS_FILE = path.resolve(DATA_DIR, 'aggregator-analytics.json');

if (
  !ORDERS_FILE.startsWith(DATA_DIR + path.sep) ||
  !BOOKINGS_FILE.startsWith(DATA_DIR + path.sep) ||
  !AGGREGATORS_FILE.startsWith(DATA_DIR + path.sep)
) {
  throw new Error('Invalid storage path configuration.');
}

const DEFAULT_PIN_SALT = 'ar_owner_v1_salt_9381';
const DEFAULT_PIN_HASH =
  '17a22e7817f711880c3081b35e64a7c52a7ed414128a36805a493cd1be0e1969';

const VERCEL_DEPLOYMENT_KEY =
  process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || '';

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  (process.env.VERCEL === '1' && VERCEL_DEPLOYMENT_KEY
    ? crypto
        .createHmac('sha256', VERCEL_DEPLOYMENT_KEY)
        .update('ar_vercel_admin_session_v1')
        .digest('hex')
    : crypto.randomBytes(32).toString('hex'));

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const CANONICAL_MENU_PRICES: Record<string, { name: string; priceInr: number }> = {
  'kodi-vepudu': { name: 'Guntur Kodi Vepudu', priceInr: 540 },
  'karivepaku-royyalu': { name: 'Karivepaku Royyala Roast', priceInr: 680 },
  'ulavacharu-biryani': { name: 'Ulavacharu Kodi Biryani', priceInr: 690 },
  'rayalaseema-dum-biryani': { name: 'Rayalaseema Mamsam Handi', priceInr: 780 },
  'royyala-iguru': { name: 'Bhimavaram Royyala Iguru', priceInr: 740 },
  'gongura-mamsam': { name: 'Gongura Mamsam', priceInr: 720 },
  'gutti-vankaya': { name: 'Gutti Vankaya Kura', priceInr: 460 },
  'atreyapuram-pootharekulu': { name: 'Atreyapuram Pootharekulu', priceInr: 340 },
};

const VALID_SPICES: SpicePreference[] = [
  'Mild Temper',
  'Authentic Andhra',
  'Fiery Guntur',
];

const VALID_PORTIONS: PortionStyle[] = [
  'Signature Plate',
  'Claypot Feast (+₹180)',
];

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Preparing',
  'Delivered',
  'Cancelled',
];

const VALID_OCCASIONS: ReservationOccasion[] = [
  'Birthday',
  'Anniversary',
  'Family Dinner',
  'Casual Dining',
  'Corporate Event',
  'Other',
];

const VALID_BOOKING_STATUSES: BookingStatus[] = [
  'Pending',
  'Sent via WhatsApp (Awaiting Reply)',
  'Confirmed',
  'Seated',
  'Completed',
  'Cancelled',
];

interface OwnerTokenPayload {
  sub: 'owner';
  email: string;
  jti: string;
  iat: number;
  exp: number;
}

const revokedTokenIds = new Set<string>();
const loginAttemptStore = new Map<string, { count: number; resetAt: number }>();

let writeQueue: Promise<void> = Promise.resolve();

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function normalizeStoredOrder(raw: unknown): CustomerOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  if (!id) return null;
  const items = Array.isArray(obj.items) ? (obj.items as OrderLineItem[]) : [];
  const totalAmountInr = Number.isFinite(Number(obj.totalAmountInr))
    ? Math.max(0, Math.round(Number(obj.totalAmountInr)))
    : 0;
  const status: OrderStatus = VALID_ORDER_STATUSES.includes(obj.status as OrderStatus)
    ? (obj.status as OrderStatus)
    : 'Pending';
  const nowIso = new Date().toISOString();
  return {
    id,
    customerName:
      typeof obj.customerName === 'string' && obj.customerName.trim()
        ? obj.customerName.trim()
        : 'Guest',
    customerPhone:
      typeof obj.customerPhone === 'string' ? obj.customerPhone.trim() : '',
    fulfillmentType: obj.fulfillmentType === 'Pickup' ? 'Pickup' : 'Delivery',
    deliveryAddress:
      typeof obj.deliveryAddress === 'string' && obj.deliveryAddress.trim()
        ? obj.deliveryAddress.trim()
        : 'Madhuravada Flagship Pickup / Dine-in',
    items,
    subtotalInr: Number.isFinite(Number(obj.subtotalInr))
      ? Math.max(0, Math.round(Number(obj.subtotalInr)))
      : totalAmountInr,
    taxesInr: Number.isFinite(Number(obj.taxesInr))
      ? Math.max(0, Math.round(Number(obj.taxesInr)))
      : 0,
    totalAmountInr,
    status,
    createdAt: typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : nowIso,
    updatedAt: typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : nowIso,
  };
}

function normalizeStoredBooking(raw: unknown): TableBooking | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!id || !name) return null;
  const guestsNum = Number(obj.guests);
  const nowIso = new Date().toISOString();
  return {
    id,
    name,
    phone: typeof obj.phone === 'string' ? obj.phone.trim() : '',
    occasion: VALID_OCCASIONS.includes(obj.occasion as ReservationOccasion)
      ? (obj.occasion as ReservationOccasion)
      : 'Other',
    guests:
      Number.isFinite(guestsNum) && guestsNum >= 1
        ? Math.min(100, Math.round(guestsNum))
        : 2,
    dateTime:
      typeof obj.dateTime === 'string' && obj.dateTime.trim()
        ? obj.dateTime.trim()
        : nowIso,
    bookedAt:
      typeof obj.bookedAt === 'string' && obj.bookedAt.trim()
        ? obj.bookedAt.trim()
        : nowIso,
    status: VALID_BOOKING_STATUSES.includes(obj.status as BookingStatus)
      ? (obj.status as BookingStatus)
      : 'Sent via WhatsApp (Awaiting Reply)',
    locationName:
      typeof obj.locationName === 'string' && obj.locationName.trim()
        ? obj.locationName.trim()
        : undefined,
    updatedAt:
      typeof obj.updatedAt === 'string' && obj.updatedAt.trim()
        ? obj.updatedAt.trim()
        : undefined,
  };
}

async function readOrdersFromDisk(): Promise<CustomerOrder[]> {
  try {
    const raw = await fs.readFile(ORDERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeStoredOrder)
      .filter((ord): ord is CustomerOrder => ord !== null);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || err instanceof SyntaxError) {
      return [];
    }
    throw err;
  }
}

async function writeOrdersToDisk(orders: CustomerOrder[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.resolve(
    DATA_DIR,
    `orders.${process.pid}.${Date.now()}.tmp`,
  );
  if (!tempFile.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temporary file path.');
  }
  await fs.writeFile(tempFile, JSON.stringify(orders, null, 2), 'utf8');
  await fs.rename(tempFile, ORDERS_FILE);
}

async function readBookingsFromDisk(): Promise<TableBooking[]> {
  try {
    const raw = await fs.readFile(BOOKINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeStoredBooking)
      .filter((b): b is TableBooking => b !== null);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || err instanceof SyntaxError) {
      return [];
    }
    throw err;
  }
}

async function writeBookingsToDisk(bookings: TableBooking[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.resolve(
    DATA_DIR,
    `bookings.${process.pid}.${Date.now()}.tmp`,
  );
  if (!tempFile.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temporary bookings file path.');
  }
  await fs.writeFile(tempFile, JSON.stringify(bookings, null, 2), 'utf8');
  await fs.rename(tempFile, BOOKINGS_FILE);
}

async function readAggregatorsFromDisk(): Promise<AggregatorAnalyticsEntry[]> {
  try {
    const raw = await fs.readFile(AGGREGATORS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map(sanitizeAggregatorEntry)
        .filter((item): item is AggregatorAnalyticsEntry => item !== null);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && !(err instanceof SyntaxError)) {
      throw err;
    }
  }
  const seeded = buildSeededAggregatorEntries();
  await writeAggregatorsToDisk(seeded);
  return seeded;
}

async function writeAggregatorsToDisk(
  entries: AggregatorAnalyticsEntry[],
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.resolve(
    DATA_DIR,
    `aggregators.${process.pid}.${Date.now()}.tmp`,
  );
  if (!tempFile.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temporary aggregator file path.');
  }
  await fs.writeFile(tempFile, JSON.stringify(entries, null, 2), 'utf8');
  await fs.rename(tempFile, AGGREGATORS_FILE);
}

function sanitizeAggregatorInput(
  raw: Record<string, unknown>,
  fallbackSource: AggregatorEntrySource = 'Manual',
): {
  platform: AggregatorPlatform;
  date: string;
  orders: number;
  grossSalesInr: number;
  deductionsInr: number;
  netPayoutInr: number;
  source: AggregatorEntrySource;
  notes?: string;
} | null {
  const platform: AggregatorPlatform | null =
    raw.platform === 'Zomato' || raw.platform === 'Swiggy'
      ? raw.platform
      : null;
  const date = typeof raw.date === 'string' ? raw.date.trim() : '';
  const orders = Number(raw.orders);
  const grossSalesInr = Number(raw.grossSalesInr);
  const deductionsInr = Number(raw.deductionsInr ?? 0);

  if (
    !platform ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(orders) ||
    orders < 0 ||
    orders > 100000 ||
    !Number.isFinite(grossSalesInr) ||
    grossSalesInr < 0 ||
    !Number.isFinite(deductionsInr) ||
    deductionsInr < 0
  ) {
    return null;
  }

  const roundedOrders = Math.round(orders);
  const roundedGross = Math.round(grossSalesInr);
  const roundedDeductions = Math.round(deductionsInr);
  const source: AggregatorEntrySource =
    raw.source === 'CSV' || raw.source === 'Seeded' || raw.source === 'Manual'
      ? raw.source
      : fallbackSource;
  const notes =
    typeof raw.notes === 'string'
      ? raw.notes.trim().slice(0, 160) || undefined
      : undefined;

  return {
    platform,
    date,
    orders: roundedOrders,
    grossSalesInr: roundedGross,
    deductionsInr: roundedDeductions,
    netPayoutInr: roundedGross - roundedDeductions,
    source,
    notes,
  };
}

function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

const AUTHORIZED_OWNER_EMAIL = 'jyothish369k@gmail.com';

function isAuthorizedOwnerPin(rawPin: unknown): boolean {
  const cleanPin = String(rawPin ?? '').trim();
  if (!cleanPin) {
    return false;
  }

  const configuredPin = String(
    process.env.OWNER_PIN || process.env.VITE_ADMIN_PIN || '',
  ).trim();
  if (configuredPin.length >= 4) {
    const submittedDigest = crypto.createHash('sha256').update(cleanPin).digest();
    const expectedDigest = crypto
      .createHash('sha256')
      .update(configuredPin)
      .digest();
    if (crypto.timingSafeEqual(submittedDigest, expectedDigest)) {
      return true;
    }
  }

  if (/^\d{4}$/.test(cleanPin)) {
    const derived = crypto.scryptSync(cleanPin, DEFAULT_PIN_SALT, 32);
    const expected = Buffer.from(DEFAULT_PIN_HASH, 'hex');
    return crypto.timingSafeEqual(derived, expected);
  }
  return false;
}

function signToken(payload: OwnerTokenPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string): OwnerTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as OwnerTokenPayload;

    if (
      parsed.sub !== 'owner' ||
      typeof parsed.email !== 'string' ||
      parsed.email.trim().toLowerCase() !== AUTHORIZED_OWNER_EMAIL ||
      typeof parsed.jti !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Date.now() ||
      revokedTokenIds.has(parsed.jti)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function requireOwnerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized Access' });
    return;
  }
  const verified = verifyToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Unauthorized Access' });
    return;
  }
  next();
}

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttemptStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    return true;
  }
  return entry.count < 12;
}

function recordFailedLoginAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttemptStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttemptStore.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

function clearLoginAttempts(ip: string): void {
  loginAttemptStore.delete(ip);
}

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  // Public customer order submission (write-only; never exposes other customer orders)
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const customerName =
        typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const rawPhone =
        typeof body.customerPhone === 'string' ? body.customerPhone : '';
      const normalizedDigits = normalizePhoneInput(rawPhone);
      const fulfillmentType: OrderFulfillmentType =
        body.fulfillmentType === 'Pickup' ? 'Pickup' : 'Delivery';
      const rawAddress =
        typeof body.deliveryAddress === 'string'
          ? body.deliveryAddress.trim()
          : '';
      const rawItems = Array.isArray(body.items) ? body.items : [];

      if (customerName.length < 2 || customerName.length > 80) {
        res.status(400).json({ error: 'Please enter a valid customer name.' });
        return;
      }

      if (!/^\d{10}$/.test(normalizedDigits)) {
        res
          .status(400)
          .json({ error: 'Please enter a valid 10-digit phone number.' });
        return;
      }

      if (fulfillmentType === 'Delivery' && rawAddress.length < 5) {
        res
          .status(400)
          .json({ error: 'Please enter a complete delivery address.' });
        return;
      }

      if (rawAddress.length > 300) {
        res.status(400).json({ error: 'Delivery details are too long.' });
        return;
      }

      if (rawItems.length === 0 || rawItems.length > 30) {
        res.status(400).json({ error: 'Order must contain 1 to 30 items.' });
        return;
      }

      const validatedItems: OrderLineItem[] = [];
      for (const entry of rawItems) {
        if (!entry || typeof entry !== 'object') {
          res.status(400).json({ error: 'Invalid order item format.' });
          return;
        }
        const itemObj = entry as Record<string, unknown>;
        const itemId =
          typeof itemObj.itemId === 'string' ? itemObj.itemId.trim() : '';
        const catalogItem = CANONICAL_MENU_PRICES[itemId];
        if (!catalogItem) {
          res.status(400).json({ error: 'Unknown menu item in order.' });
          return;
        }

        const quantity =
          typeof itemObj.quantity === 'number' &&
          Number.isInteger(itemObj.quantity)
            ? itemObj.quantity
            : 0;
        if (quantity < 1 || quantity > 50) {
          res.status(400).json({ error: 'Invalid item quantity.' });
          return;
        }

        const spicePreference: SpicePreference = VALID_SPICES.includes(
          itemObj.spicePreference as SpicePreference,
        )
          ? (itemObj.spicePreference as SpicePreference)
          : 'Authentic Andhra';

        const portionStyle: PortionStyle = VALID_PORTIONS.includes(
          itemObj.portionStyle as PortionStyle,
        )
          ? (itemObj.portionStyle as PortionStyle)
          : 'Signature Plate';

        const notes =
          typeof itemObj.notes === 'string'
            ? itemObj.notes.trim().slice(0, 140)
            : undefined;

        const unitPriceInr =
          catalogItem.priceInr +
          (portionStyle === 'Claypot Feast (+₹180)' ? 180 : 0);

        validatedItems.push({
          itemId,
          name: catalogItem.name,
          quantity,
          spicePreference,
          portionStyle,
          unitPriceInr,
          lineTotalInr: unitPriceInr * quantity,
          notes: notes || undefined,
        });
      }

      const subtotalInr = validatedItems.reduce(
        (sum, line) => sum + line.lineTotalInr,
        0,
      );
      const taxesInr = Math.round(subtotalInr * 0.05);
      const totalAmountInr = subtotalInr + taxesInr;
      const nowIso = new Date().toISOString();

      const newOrder: CustomerOrder = {
        id: `AR-${Date.now().toString().slice(-4)}${crypto.randomInt(10, 99)}`,
        customerName,
        customerPhone: normalizedDigits,
        fulfillmentType,
        deliveryAddress:
          fulfillmentType === 'Delivery'
            ? rawAddress
            : rawAddress || 'Madhuravada Flagship Pickup / Dine-in',
        items: validatedItems,
        subtotalInr,
        taxesInr,
        totalAmountInr,
        status: 'Pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await runSerialized(async () => {
        const existing = await readOrdersFromDisk();
        existing.unshift(newOrder);
        await writeOrdersToDisk(existing);
      });

      res.status(201).json({
        order: {
          id: newOrder.id,
          totalAmountInr: newOrder.totalAmountInr,
          status: newOrder.status,
          createdAt: newOrder.createdAt,
        },
      });
    } catch (error) {
      console.error('Failed to save customer order:', error);
      res.status(500).json({ error: 'Unable to save order right now.' });
    }
  });

  // Explicitly block unauthenticated listing on /api/orders
  app.get('/api/orders', (_req: Request, res: Response) => {
    res.status(401).json({
      error: 'Unauthorized Access: Owner authentication required.',
    });
  });

  // Public table reservation submission (write-only; never exposes other guest bookings)
  app.post('/api/bookings', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const rawPhone = typeof body.phone === 'string' ? body.phone : '';
      const normalizedDigits = normalizePhoneInput(rawPhone);
      const occasion: ReservationOccasion = VALID_OCCASIONS.includes(
        body.occasion as ReservationOccasion,
      )
        ? (body.occasion as ReservationOccasion)
        : 'Family Dinner';
      const guestsNum = Number(body.guests);
      const dateTime =
        typeof body.dateTime === 'string' ? body.dateTime.trim() : '';
      const locationName =
        typeof body.locationName === 'string'
          ? body.locationName.trim().slice(0, 120)
          : undefined;

      if (name.length < 2 || name.length > 80) {
        res.status(400).json({ error: 'Please enter a valid guest name.' });
        return;
      }

      if (!/^\d{10}$/.test(normalizedDigits)) {
        res
          .status(400)
          .json({ error: 'Please enter a valid 10-digit phone number.' });
        return;
      }

      if (!Number.isFinite(guestsNum) || guestsNum < 1 || guestsNum > 40) {
        res.status(400).json({ error: 'Guests must be between 1 and 40.' });
        return;
      }

      if (!dateTime || Number.isNaN(new Date(dateTime).getTime())) {
        res
          .status(400)
          .json({ error: 'Please enter a valid reservation date and time.' });
        return;
      }

      const providedId =
        typeof body.id === 'string' && /^AR-[A-Za-z0-9_-]{3,24}$/.test(body.id.trim())
          ? body.id.trim()
          : `AR-${Date.now().toString().slice(-5)}${crypto.randomInt(10, 99)}`;

      const bookedAt =
        typeof body.bookedAt === 'string' && !Number.isNaN(new Date(body.bookedAt).getTime())
          ? body.bookedAt
          : new Date().toISOString();

      const status: BookingStatus = VALID_BOOKING_STATUSES.includes(
        body.status as BookingStatus,
      )
        ? (body.status as BookingStatus)
        : 'Sent via WhatsApp (Awaiting Reply)';

      const createdBooking: TableBooking = {
        id: providedId,
        name,
        phone: normalizedDigits,
        occasion,
        guests: Math.round(guestsNum),
        dateTime,
        bookedAt,
        status,
        locationName: locationName || 'Madhuravada Flagship',
        updatedAt: new Date().toISOString(),
      };

      await runSerialized(async () => {
        const existing = await readBookingsFromDisk();
        const deduped = existing.filter((b) => b.id !== createdBooking.id);
        deduped.unshift(createdBooking);
        await writeBookingsToDisk(deduped);
      });

      res.status(201).json({ booking: createdBooking });
    } catch (error) {
      console.error('Failed to save table booking:', error);
      res.status(500).json({ error: 'Unable to save booking right now.' });
    }
  });

  app.get('/api/bookings', (_req: Request, res: Response) => {
    res.status(401).json({
      error: 'Unauthorized Access: Owner authentication required.',
    });
  });

  // Passkey-only Admin Portal authentication
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    const body = (req.body ?? {}) as Record<string, unknown>;
    const normalizedPasskey = String(body.pin ?? body.passkey ?? '').trim();

    // Never lock out a valid passkey submission due to prior failed attempts on shared IPs
    if (isAuthorizedOwnerPin(normalizedPasskey)) {
      clearLoginAttempts(clientIp);
      const now = Date.now();

      const token = signToken({
        sub: 'owner',
        email: AUTHORIZED_OWNER_EMAIL,
        jti: crypto.randomUUID(),
        iat: now,
        exp: now + SESSION_TTL_MS,
      });

      res.status(200).json({
        token,
        expiresAt: now + SESSION_TTL_MS,
        owner: {
          email: AUTHORIZED_OWNER_EMAIL,
        },
      });
      return;
    }

    if (!checkLoginRateLimit(clientIp)) {
      res.status(429).json({
        error: 'Too many incorrect passkey attempts. Wait a moment or enter the valid passkey.',
      });
      return;
    }

    recordFailedLoginAttempt(clientIp);
    res.status(401).json({
      error: 'Incorrect passkey. Please enter the valid 4-digit passkey.',
    });
  });

  app.get(
    '/api/admin/session',
    requireOwnerAuth,
    (_req: Request, res: Response) => {
      res.status(200).json({
        authenticated: true,
        email: AUTHORIZED_OWNER_EMAIL,
      });
    },
  );

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        revokedTokenIds.add(payload.jti);
      }
    }
    res.status(200).json({ ok: true });
  });

  // Protected Owner Orders list + aggregate summary metrics
  app.get(
    '/api/admin/orders',
    requireOwnerAuth,
    async (_req: Request, res: Response) => {
      try {
        const allOrders = await readOrdersFromDisk();
        const sortedOrders = [...allOrders].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        const totalOrders = sortedOrders.length;
        const totalRevenueInr = sortedOrders.reduce(
          (sum, order) => sum + order.totalAmountInr,
          0,
        );
        const pendingActiveCount = sortedOrders.filter(
          (order) => order.status === 'Pending' || order.status === 'Preparing',
        ).length;

        res.status(200).json({
          orders: sortedOrders,
          summary: {
            totalOrders,
            totalRevenueInr,
            pendingActiveCount,
          },
        });
      } catch (error) {
        console.error('Failed to read orders:', error);
        res.status(500).json({ error: 'Unable to load customer orders.' });
      }
    },
  );

  // Protected Owner Order Status Update
  app.patch(
    '/api/admin/orders/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const orderId = String(req.params.id || '').trim();
        const body = (req.body ?? {}) as Record<string, unknown>;
        const nextStatus = body.status as OrderStatus;

        if (!orderId || !VALID_ORDER_STATUSES.includes(nextStatus)) {
          res.status(400).json({ error: 'Invalid order status update.' });
          return;
        }

        let updatedOrder: CustomerOrder | null = null;
        await runSerialized(async () => {
          const orders = await readOrdersFromDisk();
          const idx = orders.findIndex((o) => o.id === orderId);
          if (idx === -1) return;
          orders[idx] = {
            ...orders[idx],
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
          updatedOrder = orders[idx];
          await writeOrdersToDisk(orders);
        });

        if (!updatedOrder) {
          res.status(404).json({ error: 'Order not found.' });
          return;
        }

        res.status(200).json({ order: updatedOrder });
      } catch (error) {
        console.error('Failed to update order status:', error);
        res.status(500).json({ error: 'Unable to update order status.' });
      }
    },
  );

  // Protected Owner Order Delete
  app.delete(
    '/api/admin/orders/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const orderId = String(req.params.id || '').trim();
        if (!orderId) {
          res.status(400).json({ error: 'Missing order id.' });
          return;
        }
        let deleted = false;
        await runSerialized(async () => {
          const orders = await readOrdersFromDisk();
          const filtered = orders.filter((o) => o.id !== orderId);
          if (filtered.length !== orders.length) {
            deleted = true;
            await writeOrdersToDisk(filtered);
          }
        });
        if (!deleted) {
          res.status(404).json({ error: 'Order not found.' });
          return;
        }
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error('Failed to delete order:', error);
        res.status(500).json({ error: 'Unable to delete order.' });
      }
    },
  );

  // Protected Owner Table Bookings CRUD
  app.get(
    '/api/admin/bookings',
    requireOwnerAuth,
    async (_req: Request, res: Response) => {
      try {
        const allBookings = await readBookingsFromDisk();
        const sorted = [...allBookings].sort(
          (a, b) =>
            (new Date(b.bookedAt).getTime() || 0) -
            (new Date(a.bookedAt).getTime() || 0),
        );
        res.status(200).json({ bookings: sorted });
      } catch (error) {
        console.error('Failed to read table bookings:', error);
        res.status(500).json({ error: 'Unable to load table bookings.' });
      }
    },
  );

  app.patch(
    '/api/admin/bookings/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const bookingId = String(req.params.id || '').trim();
        const body = (req.body ?? {}) as Record<string, unknown>;
        const nextStatus = body.status as BookingStatus;

        if (!bookingId || !VALID_BOOKING_STATUSES.includes(nextStatus)) {
          res.status(400).json({ error: 'Invalid booking status update.' });
          return;
        }

        let updatedBooking: TableBooking | null = null;
        await runSerialized(async () => {
          const bookings = await readBookingsFromDisk();
          const idx = bookings.findIndex((b) => b.id === bookingId);
          if (idx === -1) return;
          bookings[idx] = {
            ...bookings[idx],
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
          updatedBooking = bookings[idx];
          await writeBookingsToDisk(bookings);
        });

        if (!updatedBooking) {
          res.status(404).json({ error: 'Booking not found.' });
          return;
        }

        res.status(200).json({ booking: updatedBooking });
      } catch (error) {
        console.error('Failed to update booking status:', error);
        res.status(500).json({ error: 'Unable to update booking status.' });
      }
    },
  );

  app.delete(
    '/api/admin/bookings/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const bookingId = String(req.params.id || '').trim();
        if (!bookingId) {
          res.status(400).json({ error: 'Missing booking id.' });
          return;
        }
        let deleted = false;
        await runSerialized(async () => {
          const bookings = await readBookingsFromDisk();
          const filtered = bookings.filter((b) => b.id !== bookingId);
          if (filtered.length !== bookings.length) {
            deleted = true;
            await writeBookingsToDisk(filtered);
          }
        });
        if (!deleted) {
          res.status(404).json({ error: 'Booking not found.' });
          return;
        }
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error('Failed to delete booking:', error);
        res.status(500).json({ error: 'Unable to delete booking.' });
      }
    },
  );

  // Protected Admin-Only Zomato & Swiggy Analytics routes (never accessible publicly)
  app.get(
    '/api/admin/aggregators',
    requireOwnerAuth,
    async (_req: Request, res: Response) => {
      try {
        const entries = await runSerialized(() => readAggregatorsFromDisk());
        const sorted = [...entries].sort(
          (a, b) =>
            String(b.date || '').localeCompare(String(a.date || '')) ||
            String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
        );
        res.status(200).json({ entries: sorted });
      } catch (error) {
        console.error('Failed to read aggregator entries:', error);
        res.status(500).json({ error: 'Unable to load aggregator analytics.' });
      }
    },
  );

  app.post(
    '/api/admin/aggregators',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const validated = sanitizeAggregatorInput(
          (req.body ?? {}) as Record<string, unknown>,
          'Manual',
        );
        if (!validated) {
          res.status(400).json({ error: 'Invalid aggregator log entry.' });
          return;
        }
        const nowIso = new Date().toISOString();
        const created: AggregatorAnalyticsEntry = {
          id: `agg-${Date.now().toString(36)}-${crypto.randomInt(100, 999)}`,
          ...validated,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await runSerialized(async () => {
          const existing = await readAggregatorsFromDisk();
          existing.unshift(created);
          await writeAggregatorsToDisk(existing);
        });
        res.status(201).json({ entry: created });
      } catch (error) {
        console.error('Failed to create aggregator entry:', error);
        res.status(500).json({ error: 'Unable to save aggregator entry.' });
      }
    },
  );

  app.post(
    '/api/admin/aggregators/import',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const rawList = Array.isArray(body.entries) ? body.entries : [];
        if (rawList.length === 0 || rawList.length > 500) {
          res
            .status(400)
            .json({ error: 'Import must include between 1 and 500 rows.' });
          return;
        }
        const nowIso = new Date().toISOString();
        const createdEntries: AggregatorAnalyticsEntry[] = [];
        for (const item of rawList) {
          if (!item || typeof item !== 'object') {
            res.status(400).json({ error: 'Invalid row in CSV import.' });
            return;
          }
          const validated = sanitizeAggregatorInput(
            item as Record<string, unknown>,
            'CSV',
          );
          if (!validated) {
            res.status(400).json({ error: 'Invalid row values in CSV import.' });
            return;
          }
          createdEntries.push({
            id: `csv-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`,
            ...validated,
            source: 'CSV',
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }

        await runSerialized(async () => {
          const existing = await readAggregatorsFromDisk();
          const merged = [...createdEntries, ...existing];
          await writeAggregatorsToDisk(merged);
        });

        res.status(201).json({ entries: createdEntries });
      } catch (error) {
        console.error('Failed to import CSV entries:', error);
        res.status(500).json({ error: 'Unable to import CSV entries.' });
      }
    },
  );

  app.patch(
    '/api/admin/aggregators/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const entryId = String(req.params.id || '').trim();
        const validated = sanitizeAggregatorInput(
          (req.body ?? {}) as Record<string, unknown>,
          'Manual',
        );
        if (!entryId || !validated) {
          res.status(400).json({ error: 'Invalid aggregator update.' });
          return;
        }
        let updatedEntry: AggregatorAnalyticsEntry | null = null;
        await runSerialized(async () => {
          const existing = await readAggregatorsFromDisk();
          const idx = existing.findIndex((item) => item.id === entryId);
          if (idx === -1) return;
          existing[idx] = {
            ...existing[idx],
            ...validated,
            updatedAt: new Date().toISOString(),
          };
          updatedEntry = existing[idx];
          await writeAggregatorsToDisk(existing);
        });
        if (!updatedEntry) {
          res.status(404).json({ error: 'Entry not found.' });
          return;
        }
        res.status(200).json({ entry: updatedEntry });
      } catch (error) {
        console.error('Failed to update aggregator entry:', error);
        res.status(500).json({ error: 'Unable to update entry.' });
      }
    },
  );

  app.delete(
    '/api/admin/aggregators/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      try {
        const entryId = String(req.params.id || '').trim();
        if (!entryId) {
          res.status(400).json({ error: 'Missing entry id.' });
          return;
        }
        let deleted = false;
        await runSerialized(async () => {
          const existing = await readAggregatorsFromDisk();
          const filtered = existing.filter((item) => item.id !== entryId);
          if (filtered.length !== existing.length) {
            deleted = true;
            await writeAggregatorsToDisk(filtered);
          }
        });
        if (!deleted) {
          res.status(404).json({ error: 'Entry not found.' });
          return;
        }
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error('Failed to delete aggregator entry:', error);
        res.status(500).json({ error: 'Unable to delete entry.' });
      }
    },
  );

  // Guarantee JSON for unknown /api routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  return app;
}
