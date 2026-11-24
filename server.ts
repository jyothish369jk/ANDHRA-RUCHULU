import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type {
  CustomerOrder,
  OrderFulfillmentType,
  OrderLineItem,
  OrderStatus,
  PortionStyle,
  SpicePreference,
} from './src/types/restaurant.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const ORDERS_FILE = path.resolve(DATA_DIR, 'orders.json');

if (!ORDERS_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid orders storage path configuration.');
}

const DEFAULT_PIN_SALT = 'ar_owner_v1_salt_9381';
const DEFAULT_PIN_HASH =
  '17a22e7817f711880c3081b35e64a7c52a7ed414128a36805a493cd1be0e1969';

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`${DEFAULT_PIN_HASH}:ar_admin_session_secret_v1`)
    .digest('hex');
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

async function readOrdersFromDisk(): Promise<CustomerOrder[]> {
  try {
    const raw = await fs.readFile(ORDERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomerOrder[]) : [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
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

function normalizePhoneInput(raw: string): string {
  return raw.replace(/[\s\-()]/g, '').trim();
}

const AUTHORIZED_OWNER_EMAIL = 'jyothish369k@gmail.com';

function isAuthorizedOwnerPin(rawPin: unknown): boolean {
  const cleanPin = String(rawPin ?? '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return false;
  }

  const configuredPin = String(process.env.OWNER_PIN ?? '').trim();
  if (/^\d{4}$/.test(configuredPin)) {
    const submittedDigest = crypto.createHash('sha256').update(cleanPin).digest();
    const expectedDigest = crypto
      .createHash('sha256')
      .update(configuredPin)
      .digest();
    if (crypto.timingSafeEqual(submittedDigest, expectedDigest)) {
      return true;
    }
  }

  const derived = crypto.scryptSync(cleanPin, DEFAULT_PIN_SALT, 32);
  const expected = Buffer.from(DEFAULT_PIN_HASH, 'hex');
  return crypto.timingSafeEqual(derived, expected);
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

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  // Public customer order submission (write-only; never exposes other customer orders)
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const customerName =
        typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const rawPhone =
        typeof body.customerPhone === 'string' ? body.customerPhone : '';
      const normalizedDigits = normalizePhoneInput(rawPhone).replace(
        /^\+91/,
        '',
      );
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
        const body = req.body as Record<string, unknown>;
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

  // Guarantee JSON for unknown /api routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Andhra Ruchulu server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
