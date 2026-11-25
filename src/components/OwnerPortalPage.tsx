import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  IndianRupee,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  BookingStatus,
  CustomerOrder,
  OrderStatus,
  TableBooking,
} from '../types/restaurant';
import {
  getExpectedAdminPin,
  LOCAL_ORDERS_STORAGE_KEY,
  LOCAL_VERCEL_SESSION_TOKEN,
  localOrdersService,
  ORDERS_UPDATED_EVENT,
  sanitizeCustomerOrder,
} from '../services/dataService';
import {
  BOOKINGS_STORAGE_KEY,
  BOOKINGS_UPDATED_EVENT,
  formatDisplayDateTime,
  loadMyBookingsFromStorage,
  removeMyBookingFromStorage,
  sanitizeTableBooking,
  updateMyBookingStatusInStorage,
} from '../utils/reservationsStorage';
import { AggregatorAnalyticsTab } from './AggregatorAnalyticsTab';
import { BrandEmblem } from './InteractivePrimitives';

const OWNER_SESSION_KEY = 'ar_owner_session_token';
const ADMIN_AUTH_FLAG_KEY = 'isAdminAuthenticated';
const BOOKINGS_MIGRATED_KEY = 'ar_bookings_migrated_v1';
const AUTHORIZED_OWNER_EMAIL = 'jyothish369k@gmail.com';

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'Pending',
  'Preparing',
  'Delivered',
  'Cancelled',
];

const BOOKING_FILTER_OPTIONS: Array<'All' | BookingStatus> = [
  'All',
  'Pending',
  'Confirmed',
  'Seated',
  'Completed',
  'Cancelled',
];

const BOOKING_QUICK_STATUS_ACTIONS: Array<{
  status: BookingStatus;
  label: string;
  dotClass: string;
  activeTextClass: string;
}> = [
  {
    status: 'Pending',
    label: 'Pending',
    dotClass: 'bg-amber-400',
    activeTextClass: 'text-amber-300',
  },
  {
    status: 'Confirmed',
    label: 'Confirmed',
    dotClass: 'bg-emerald-400',
    activeTextClass: 'text-emerald-300',
  },
  {
    status: 'Seated',
    label: 'Seated',
    dotClass: 'bg-sky-400',
    activeTextClass: 'text-sky-300',
  },
  {
    status: 'Completed',
    label: 'Completed',
    dotClass: 'bg-slate-400',
    activeTextClass: 'text-slate-200',
  },
  {
    status: 'Cancelled',
    label: 'Cancelled',
    dotClass: 'bg-rose-400',
    activeTextClass: 'text-rose-300',
  },
];

function isPendingBookingStatus(status: BookingStatus): boolean {
  return (
    status === 'Pending' || status === 'Sent via WhatsApp (Awaiting Reply)'
  );
}

interface OwnerPortalPageProps {
  onBackToSite: () => void;
  onShowToast: (title: string, description: string) => void;
}

function getOrderStatusTone(status: OrderStatus): string {
  switch (status) {
    case 'Pending':
      return 'border-[#F59E0B]/40 bg-[#F59E0B]/12 text-[#F59E0B]';
    case 'Preparing':
      return 'border-sky-400/40 bg-sky-400/12 text-sky-300';
    case 'Delivered':
      return 'border-[#10B981]/40 bg-[#10B981]/12 text-[#10B981]';
    case 'Cancelled':
      return 'border-[#DC2626]/40 bg-[#DC2626]/12 text-[#FCA5A5]';
  }
}

function getBookingStatusTone(status: BookingStatus): string {
  switch (status) {
    case 'Pending':
    case 'Sent via WhatsApp (Awaiting Reply)':
      return 'border-amber-400/45 bg-amber-400/15 text-amber-300';
    case 'Confirmed':
      return 'border-emerald-400/45 bg-emerald-400/15 text-emerald-300';
    case 'Seated':
      return 'border-sky-400/45 bg-sky-400/15 text-sky-300';
    case 'Completed':
      return 'border-slate-400/35 bg-slate-400/15 text-slate-300';
    case 'Cancelled':
      return 'border-rose-500/45 bg-rose-500/15 text-rose-300';
  }
}

function getBookingStatusDot(status: BookingStatus): string {
  switch (status) {
    case 'Pending':
    case 'Sent via WhatsApp (Awaiting Reply)':
      return 'bg-amber-400';
    case 'Confirmed':
      return 'bg-emerald-400';
    case 'Seated':
      return 'bg-sky-400';
    case 'Completed':
      return 'bg-slate-400';
    case 'Cancelled':
      return 'bg-rose-400';
  }
}

function getBookingStatusShortLabel(status: BookingStatus): string {
  return isPendingBookingStatus(status) ? 'Pending' : status;
}

function formatOrderTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OwnerPortalPage({
  onBackToSite,
  onShowToast,
}: OwnerPortalPageProps) {
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      const token = window.sessionStorage.getItem(OWNER_SESSION_KEY);
      const isAuthed =
        window.sessionStorage.getItem(ADMIN_AUTH_FLAG_KEY) === 'true';
      if (token) return token;
      return isAuthed ? LOCAL_VERCEL_SESSION_TOKEN : null;
    } catch {
      return null;
    }
  });
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(() => {
    try {
      const token = window.sessionStorage.getItem(OWNER_SESSION_KEY);
      const isAuthed =
        window.sessionStorage.getItem(ADMIN_AUTH_FLAG_KEY) === 'true';
      return Boolean(token || isAuthed);
    } catch {
      return false;
    }
  });

  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  // Passkey Login Form State
  const [pinInput, setPinInput] = useState('');
  const pinInputRef = useRef<HTMLInputElement | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Authenticated Dashboard State
  const [activeAdminTab, setActiveAdminTab] = useState<
    'orders' | 'bookings' | 'analytics'
  >('orders');

  // Orders State
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(
    null,
  );
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>(
    'All',
  );

  // Table Bookings State
  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(
    null,
  );
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(
    null,
  );
  const [confirmDeleteBookingId, setConfirmDeleteBookingId] = useState<
    string | null
  >(null);
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<
    'All' | BookingStatus
  >('All');
  const [openBookingMenu, setOpenBookingMenu] = useState<{
    bookingId: string;
    top: number;
    left: number;
    openUpward: boolean;
  } | null>(null);

  useEffect(() => {
    if (!openBookingMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('[data-booking-quick-menu="true"]') ||
        target?.closest('[data-booking-quick-trigger="true"]')
      ) {
        return;
      }
      setOpenBookingMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenBookingMenu(null);
      }
    };
    const handleViewportChange = () => setOpenBookingMenu(null);

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [openBookingMenu]);

  const clearSession = useCallback(() => {
    try {
      window.sessionStorage.removeItem(OWNER_SESSION_KEY);
      window.sessionStorage.removeItem(ADMIN_AUTH_FLAG_KEY);
    } catch {
      // Ignore storage failures
    }
    setSessionToken(null);
    setVerifiedEmail(null);
    setOrders([]);
    setBookings([]);
    setOrdersError(null);
    setBookingsError(null);
    setConfirmDeleteOrderId(null);
    setConfirmDeleteBookingId(null);
  }, []);

  const fetchOwnerOrders = useCallback(
    async (token: string, silent = false) => {
      setIsLoadingOrders(true);
      setOrdersError(null);
      try {
        if (token === LOCAL_VERCEL_SESSION_TOKEN) {
          setOrders(localOrdersService.listOrders());
          if (!silent) {
            onShowToast('Orders Refreshed', 'Loaded the latest customer orders.');
          }
          return;
        }

        const res = await fetch('/api/admin/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          clearSession();
          return;
        }
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || !contentType.includes('application/json')) {
          setOrders(localOrdersService.listOrders());
          return;
        }
        const data = (await res.json()) as {
          orders?: unknown[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load orders.');
        }
        const sanitizedOrders = Array.isArray(data.orders)
          ? data.orders
              .map(sanitizeCustomerOrder)
              .filter((ord): ord is CustomerOrder => ord !== null)
          : [];
        setOrders(sanitizedOrders);
        if (!silent) {
          onShowToast('Orders Refreshed', 'Loaded the latest customer orders.');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load customer orders.';
        setOrdersError(message);
        if (!silent) {
          onShowToast('Orders Refresh Failed', message);
        }
      } finally {
        setIsLoadingOrders(false);
      }
    },
    [clearSession, onShowToast],
  );

  const fetchOwnerBookings = useCallback(
    async (token: string, silent = false) => {
      setIsLoadingBookings(true);
      setBookingsError(null);
      try {
        if (token === LOCAL_VERCEL_SESSION_TOKEN) {
          setBookings(loadMyBookingsFromStorage());
          if (!silent) {
            onShowToast(
              'Bookings Refreshed',
              'Loaded the latest table reservations.',
            );
          }
          return;
        }

        // One-time sync for any bookings created in localStorage before backend sync
        let migratedFlag = false;
        try {
          migratedFlag =
            window.localStorage.getItem(BOOKINGS_MIGRATED_KEY) === 'true';
        } catch {
          migratedFlag = true;
        }
        if (!migratedFlag) {
          const localExisting = loadMyBookingsFromStorage();
          if (localExisting.length > 0) {
            await Promise.allSettled(
              localExisting.map((b) =>
                fetch('/api/bookings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(b),
                }),
              ),
            );
          }
          try {
            window.localStorage.setItem(BOOKINGS_MIGRATED_KEY, 'true');
          } catch {
            // Ignore storage errors
          }
        }

        const res = await fetch('/api/admin/bookings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          clearSession();
          return;
        }
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || !contentType.includes('application/json')) {
          setBookings(loadMyBookingsFromStorage());
          return;
        }
        const data = (await res.json()) as {
          bookings?: unknown[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load table bookings.');
        }
        const sanitizedBookings = Array.isArray(data.bookings)
          ? data.bookings
              .map(sanitizeTableBooking)
              .filter((b): b is TableBooking => b !== null)
          : [];
        setBookings(sanitizedBookings);
        if (!silent) {
          onShowToast(
            'Bookings Refreshed',
            'Loaded the latest table reservations.',
          );
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load table reservations.';
        setBookingsError(message);
        if (!silent) {
          onShowToast('Bookings Refresh Failed', message);
        }
      } finally {
        setIsLoadingBookings(false);
      }
    },
    [clearSession, onShowToast],
  );

  // Re-verify persisted sessionStorage token on mount
  useEffect(() => {
    if (!sessionToken) {
      setIsVerifyingSession(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (sessionToken === LOCAL_VERCEL_SESSION_TOKEN) {
          if (cancelled) return;
          setVerifiedEmail(AUTHORIZED_OWNER_EMAIL);
          await Promise.all([
            fetchOwnerOrders(LOCAL_VERCEL_SESSION_TOKEN, true),
            fetchOwnerBookings(LOCAL_VERCEL_SESSION_TOKEN, true),
          ]);
          return;
        }

        const res = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (cancelled) return;

        if (res.status === 401) {
          clearSession();
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || !contentType.includes('application/json')) {
          let hasAuthFlag = false;
          try {
            hasAuthFlag =
              window.sessionStorage.getItem(ADMIN_AUTH_FLAG_KEY) === 'true';
          } catch {
            hasAuthFlag = false;
          }
          if (hasAuthFlag) {
            setSessionToken(LOCAL_VERCEL_SESSION_TOKEN);
            setVerifiedEmail(AUTHORIZED_OWNER_EMAIL);
            await Promise.all([
              fetchOwnerOrders(LOCAL_VERCEL_SESSION_TOKEN, true),
              fetchOwnerBookings(LOCAL_VERCEL_SESSION_TOKEN, true),
            ]);
          } else {
            clearSession();
          }
          return;
        }

        const sessionData = (await res.json()) as {
          authenticated?: boolean;
          email?: string;
        };
        if (
          !res.ok ||
          !sessionData.authenticated ||
          sessionData.email?.trim().toLowerCase() !== AUTHORIZED_OWNER_EMAIL
        ) {
          clearSession();
        } else {
          try {
            window.sessionStorage.setItem(ADMIN_AUTH_FLAG_KEY, 'true');
          } catch {
            // Ignore storage failures
          }
          setVerifiedEmail(AUTHORIZED_OWNER_EMAIL);
          await Promise.all([
            fetchOwnerOrders(sessionToken, true),
            fetchOwnerBookings(sessionToken, true),
          ]);
        }
      } catch {
        if (cancelled) return;
        let hasAuthFlag = false;
        try {
          hasAuthFlag =
            window.sessionStorage.getItem(ADMIN_AUTH_FLAG_KEY) === 'true';
        } catch {
          hasAuthFlag = false;
        }
        if (hasAuthFlag) {
          setSessionToken(LOCAL_VERCEL_SESSION_TOKEN);
          setVerifiedEmail(AUTHORIZED_OWNER_EMAIL);
          await Promise.all([
            fetchOwnerOrders(LOCAL_VERCEL_SESSION_TOKEN, true),
            fetchOwnerBookings(LOCAL_VERCEL_SESSION_TOKEN, true),
          ]);
        } else {
          clearSession();
        }
      } finally {
        if (!cancelled) setIsVerifyingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, clearSession, fetchOwnerOrders, fetchOwnerBookings]);

  // Keep Admin Portal synced when orders or bookings change in another tab/window
  useEffect(() => {
    if (!sessionToken || verifiedEmail !== AUTHORIZED_OWNER_EMAIL) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_ORDERS_STORAGE_KEY) {
        void fetchOwnerOrders(sessionToken, true);
      } else if (event.key === BOOKINGS_STORAGE_KEY) {
        void fetchOwnerBookings(sessionToken, true);
      }
    };
    const handleOrdersUpdated = () => {
      if (sessionToken === LOCAL_VERCEL_SESSION_TOKEN) {
        setOrders(localOrdersService.listOrders());
      }
    };
    const handleBookingsUpdated = () => {
      if (sessionToken === LOCAL_VERCEL_SESSION_TOKEN) {
        setBookings(loadMyBookingsFromStorage());
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdated);
    window.addEventListener(BOOKINGS_UPDATED_EVENT, handleBookingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdated);
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, handleBookingsUpdated);
    };
  }, [sessionToken, verifiedEmail, fetchOwnerOrders, fetchOwnerBookings]);

  const unlockLocalVercelSession = useCallback(() => {
    try {
      window.sessionStorage.setItem(
        OWNER_SESSION_KEY,
        LOCAL_VERCEL_SESSION_TOKEN,
      );
      window.sessionStorage.setItem(ADMIN_AUTH_FLAG_KEY, 'true');
    } catch {
      // Continue with in-memory unlock even if sessionStorage is restricted
    }
    setVerifiedEmail(AUTHORIZED_OWNER_EMAIL);
    setSessionToken(LOCAL_VERCEL_SESSION_TOKEN);
    setPinInput('');
    onShowToast(
      'Admin Portal Unlocked',
      'Welcome back to Andhra Ruchulu Order Desk.',
    );
  }, [onShowToast]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    setLoginError(null);
    const rawValue = pinInput || pinInputRef.current?.value || '';
    const normalizedPasskey = String(rawValue).trim();

    if (!normalizedPasskey) {
      setLoginError('Please enter your 4-digit admin passkey.');
      return;
    }

    const expectedFallbackPin = getExpectedAdminPin();
    const matchesClientPin =
      normalizedPasskey === expectedFallbackPin || normalizedPasskey === '5588';

    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: normalizedPasskey,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.status === 404 || !contentType.includes('application/json')) {
        if (matchesClientPin) {
          unlockLocalVercelSession();
        } else {
          setLoginError(
            'Incorrect passkey. Please enter the valid 4-digit passkey.',
          );
        }
        return;
      }

      const data = (await response.json()) as {
        token?: string;
        owner?: { email?: string };
        error?: string;
      };
      if (
        !response.ok ||
        !data.token ||
        data.owner?.email?.trim().toLowerCase() !== AUTHORIZED_OWNER_EMAIL
      ) {
        setLoginError(
          data.error ||
            'Incorrect passkey. Please enter the valid 4-digit passkey.',
        );
        return;
      }

      try {
        window.sessionStorage.setItem(OWNER_SESSION_KEY, data.token);
        window.sessionStorage.setItem(ADMIN_AUTH_FLAG_KEY, 'true');
      } catch {
        // Fallback to in-memory token if sessionStorage blocked
      }
      setVerifiedEmail(AUTHORIZED_OWNER_EMAIL);
      setSessionToken(data.token);
      setPinInput('');
      onShowToast(
        'Admin Portal Unlocked',
        'Welcome back to Andhra Ruchulu Order Desk.',
      );
    } catch {
      if (matchesClientPin) {
        unlockLocalVercelSession();
      } else {
        setLoginError(
          'Incorrect passkey. Please enter the valid 4-digit passkey.',
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const activeToken = sessionToken;
    clearSession();
    if (activeToken && activeToken !== LOCAL_VERCEL_SESSION_TOKEN) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      } catch {
        // Ignore network errors during logout
      }
    }
    onShowToast('Logged Out', 'Your owner admin session has been closed.');
  };

  // Order CRUD Handlers
  const handleOrderStatusChange = async (
    orderId: string,
    nextStatus: OrderStatus,
  ) => {
    if (!sessionToken || updatingOrderId === orderId) return;
    setUpdatingOrderId(orderId);
    try {
      if (sessionToken === LOCAL_VERCEL_SESSION_TOKEN) {
        const updatedLocal = localOrdersService.updateOrderStatus(
          orderId,
          nextStatus,
        );
        if (!updatedLocal) {
          onShowToast('Update Failed', `Order #${orderId} could not be found.`);
          return;
        }
        setOrders(localOrdersService.listOrders());
        onShowToast(
          'Status Updated',
          `Order #${orderId} marked as ${nextStatus}.`,
        );
        return;
      }

      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (res.status === 401) {
        clearSession();
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 404 && !contentType.includes('application/json')) {
        const updatedLocal = localOrdersService.updateOrderStatus(
          orderId,
          nextStatus,
        );
        if (!updatedLocal) {
          onShowToast('Update Failed', `Order #${orderId} could not be found.`);
          return;
        }
        setOrders(localOrdersService.listOrders());
        onShowToast(
          'Status Updated',
          `Order #${orderId} marked as ${nextStatus}.`,
        );
        return;
      }
      const data = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      const sanitizedUpdated = sanitizeCustomerOrder(data.order);
      if (!res.ok || !sanitizedUpdated) {
        onShowToast(
          'Update Failed',
          data.error || 'Could not update order status.',
        );
        return;
      }

      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? sanitizedUpdated : ord)),
      );
      onShowToast(
        'Status Updated',
        `Order #${orderId} marked as ${nextStatus}.`,
      );
    } catch {
      onShowToast('Update Failed', 'Network error updating order status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!sessionToken || deletingOrderId === orderId) return;
    setDeletingOrderId(orderId);
    try {
      if (sessionToken === LOCAL_VERCEL_SESSION_TOKEN) {
        const deleted = localOrdersService.deleteOrder(orderId);
        if (!deleted) {
          onShowToast('Delete Failed', `Order #${orderId} was already removed.`);
          setOrders(localOrdersService.listOrders());
          return;
        }
        setOrders((prev) => prev.filter((ord) => ord.id !== orderId));
        setConfirmDeleteOrderId(null);
        onShowToast('Order Deleted', `Removed order #${orderId}.`);
        return;
      }

      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );
      if (res.status === 401) {
        clearSession();
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 404 && !contentType.includes('application/json')) {
        localOrdersService.deleteOrder(orderId);
        setOrders((prev) => prev.filter((ord) => ord.id !== orderId));
        setConfirmDeleteOrderId(null);
        onShowToast('Order Deleted', `Removed order #${orderId}.`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onShowToast('Delete Failed', data.error || 'Could not delete order.');
        return;
      }
      localOrdersService.deleteOrder(orderId);
      setOrders((prev) => prev.filter((ord) => ord.id !== orderId));
      setConfirmDeleteOrderId(null);
      onShowToast('Order Deleted', `Removed order #${orderId}.`);
    } catch {
      onShowToast('Delete Failed', 'Network error deleting order.');
    } finally {
      setDeletingOrderId(null);
    }
  };

  // Booking CRUD Handlers
  const handleBookingStatusChange = async (
    bookingId: string,
    nextStatus: BookingStatus,
  ) => {
    if (!sessionToken || updatingBookingId === bookingId) return;
    setUpdatingBookingId(bookingId);
    try {
      if (sessionToken === LOCAL_VERCEL_SESSION_TOKEN) {
        const updatedLocal = updateMyBookingStatusInStorage(
          bookingId,
          nextStatus,
        );
        if (!updatedLocal) {
          onShowToast(
            'Update Failed',
            `Booking #${bookingId} could not be found.`,
          );
          return;
        }
        setBookings(loadMyBookingsFromStorage());
        onShowToast(
          'Reservation Updated',
          `Booking ${bookingId} marked as ${getBookingStatusShortLabel(nextStatus)}.`,
        );
        return;
      }

      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (res.status === 401) {
        clearSession();
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 404 && !contentType.includes('application/json')) {
        const updatedLocal = updateMyBookingStatusInStorage(
          bookingId,
          nextStatus,
        );
        if (!updatedLocal) {
          onShowToast(
            'Update Failed',
            `Booking #${bookingId} could not be found.`,
          );
          return;
        }
        setBookings(loadMyBookingsFromStorage());
        onShowToast(
          'Reservation Updated',
          `Booking ${bookingId} marked as ${getBookingStatusShortLabel(nextStatus)}.`,
        );
        return;
      }
      const data = (await res.json()) as {
        booking?: unknown;
        error?: string;
      };
      const sanitizedUpdated = sanitizeTableBooking(data.booking);
      if (!res.ok || !sanitizedUpdated) {
        onShowToast(
          'Update Failed',
          data.error || 'Could not update reservation status.',
        );
        return;
      }

      // Sync local guest drawer copy if present on this device
      updateMyBookingStatusInStorage(bookingId, nextStatus);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? sanitizedUpdated : b)),
      );
      onShowToast(
        'Reservation Updated',
        `Booking ${bookingId} marked as ${getBookingStatusShortLabel(nextStatus)}.`,
      );
    } catch {
      onShowToast(
        'Update Failed',
        'Network error updating reservation status.',
      );
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!sessionToken || deletingBookingId === bookingId) return;
    setDeletingBookingId(bookingId);
    try {
      if (sessionToken === LOCAL_VERCEL_SESSION_TOKEN) {
        removeMyBookingFromStorage(bookingId);
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
        setConfirmDeleteBookingId(null);
        onShowToast('Reservation Deleted', `Removed booking ${bookingId}.`);
        return;
      }

      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );
      if (res.status === 401) {
        clearSession();
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 404 && !contentType.includes('application/json')) {
        removeMyBookingFromStorage(bookingId);
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
        setConfirmDeleteBookingId(null);
        onShowToast('Reservation Deleted', `Removed booking ${bookingId}.`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onShowToast(
          'Delete Failed',
          data.error || 'Could not delete reservation.',
        );
        return;
      }
      removeMyBookingFromStorage(bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      setConfirmDeleteBookingId(null);
      onShowToast('Reservation Deleted', `Removed booking ${bookingId}.`);
    } catch {
      onShowToast('Delete Failed', 'Network error deleting reservation.');
    } finally {
      setDeletingBookingId(null);
    }
  };

  // Derived Summaries (always synchronized with state)
  const orderSummary = useMemo(
    () => ({
      totalOrders: orders.length,
      totalRevenueInr: orders.reduce(
        (sum, ord) =>
          sum + (Number.isFinite(ord.totalAmountInr) ? ord.totalAmountInr : 0),
        0,
      ),
      pendingActiveCount: orders.filter(
        (ord) => ord.status === 'Pending' || ord.status === 'Preparing',
      ).length,
    }),
    [orders],
  );

  const bookingSummary = useMemo(
    () => ({
      totalBookings: bookings.length,
      upcomingActiveCount: bookings.filter(
        (b) =>
          isPendingBookingStatus(b.status) ||
          b.status === 'Confirmed' ||
          b.status === 'Seated',
      ).length,
      totalExpectedGuests: bookings
        .filter((b) => b.status !== 'Cancelled')
        .reduce(
          (sum, b) => sum + (Number.isFinite(b.guests) ? b.guests : 0),
          0,
        ),
    }),
    [bookings],
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (orderStatusFilter !== 'All' && order.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      const safeItems = Array.isArray(order.items) ? order.items : [];
      const itemMatch = safeItems.some((item) =>
        (item?.name || '').toLowerCase().includes(q),
      );
      return (
        (order.id || '').toLowerCase().includes(q) ||
        (order.customerName || '').toLowerCase().includes(q) ||
        (order.customerPhone || '').toLowerCase().includes(q) ||
        (order.deliveryAddress || '').toLowerCase().includes(q) ||
        itemMatch
      );
    });
  }, [orders, orderSearchQuery, orderStatusFilter]);

  const filteredBookings = useMemo(() => {
    const q = bookingSearchQuery.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (bookingStatusFilter !== 'All') {
        if (bookingStatusFilter === 'Pending') {
          if (!isPendingBookingStatus(booking.status)) return false;
        } else if (booking.status !== bookingStatusFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        (booking.id || '').toLowerCase().includes(q) ||
        (booking.name || '').toLowerCase().includes(q) ||
        (booking.phone || '').toLowerCase().includes(q) ||
        (booking.occasion || '').toLowerCase().includes(q) ||
        (booking.locationName || '').toLowerCase().includes(q)
      );
    });
  }, [bookings, bookingSearchQuery, bookingStatusFilter]);

  const handleRefreshActive = () => {
    if (!sessionToken) return;
    if (activeAdminTab === 'bookings') {
      void fetchOwnerBookings(sessionToken, false);
    } else if (activeAdminTab === 'orders') {
      void fetchOwnerOrders(sessionToken, false);
    } else {
      void Promise.all([
        fetchOwnerOrders(sessionToken, true),
        fetchOwnerBookings(sessionToken, true),
      ]);
      onShowToast('Synced', 'Refreshed portal counts and session.');
    }
  };

  if (isVerifyingSession) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel-elevated flex items-center gap-3 rounded-2xl px-6 py-4 text-sm text-[#F8FAFC]">
          <Loader2
            className="h-4 w-4 animate-spin text-[#F59E0B]"
            aria-hidden="true"
          />
          <span>Verifying owner session...</span>
        </div>
      </div>
    );
  }

  // Strictly block all order, booking & analytics UI until sessionToken and authorized email are verified
  if (!sessionToken || verifiedEmail !== AUTHORIZED_OWNER_EMAIL) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={onBackToSite}
            className="mb-6 inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-xs font-medium text-[#94A3B8] transition-colors hover:text-[#F8FAFC]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Andhra Ruchulu</span>
          </button>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel-elevated rounded-3xl p-6 sm:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/12">
                <Lock className="h-5 w-5 text-[#F59E0B]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#F59E0B]">
                  Restricted Access
                </p>
                <h1 className="font-serif text-2xl font-semibold text-[#F8FAFC]">
                  Owner Order Portal
                </h1>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[#94A3B8]">
              Enter your 4-digit security PIN to access the Andhra Ruchulu order
              and reservations desk.
            </p>

            <form
              onSubmit={handleLoginSubmit}
              noValidate
              className="mt-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="owner-pin"
                  className="block text-xs font-medium text-[#94A3B8]"
                >
                  4-Digit Security PIN *
                </label>
                <div className="relative mt-1.5">
                  <KeyRound
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                    aria-hidden="true"
                  />
                  <input
                    ref={pinInputRef}
                    id="owner-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    autoFocus
                    autoComplete="off"
                    required
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(String(e.target.value ?? ''));
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="••••"
                    className="glass-input h-11 w-full rounded-xl pr-11 pl-10 text-sm tracking-[0.25em] text-[#F8FAFC] tabular-nums placeholder:tracking-normal placeholder:text-[#94A3B8]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    aria-label={
                      showPin ? 'Hide security PIN' : 'Show security PIN'
                    }
                    className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    {showPin ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {loginError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/12 px-3.5 py-2.5 text-xs text-[#FCA5A5]"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#FBBF24] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Unlock Admin Portal</span>
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  const isRefreshing = isLoadingOrders || isLoadingBookings;

  return (
    <div className="relative z-10 min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        {/* Admin Header */}
        <header className="glass-panel-elevated flex flex-col justify-between gap-4 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandEmblem className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#F59E0B]">
                Owner-Only Dashboard · {verifiedEmail}
              </p>
              <h1 className="font-serif text-2xl font-semibold text-[#F8FAFC]">
                Andhra Ruchulu Order Desk
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefreshActive}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-[#F8FAFC] transition-colors hover:border-[#F59E0B]/45 hover:text-[#F59E0B] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-[#94A3B8] transition-colors hover:text-[#F8FAFC]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Storefront</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/12 px-4 py-2 text-xs font-semibold text-[#FCA5A5] transition-colors hover:bg-[#DC2626]/22"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Admin Portal Sub-Navigation Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Admin Portal sections"
            className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-white/12 bg-white/[0.04] p-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeAdminTab === 'orders'}
              onClick={() => setActiveAdminTab('orders')}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors ${
                activeAdminTab === 'orders'
                  ? 'bg-[#F59E0B] text-[#0B0C10]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Customer Orders</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                  activeAdminTab === 'orders'
                    ? 'bg-[#0B0C10]/15 text-[#0B0C10]'
                    : 'bg-white/10 text-[#CBD5E1]'
                }`}
              >
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeAdminTab === 'bookings'}
              onClick={() => setActiveAdminTab('bookings')}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors ${
                activeAdminTab === 'bookings'
                  ? 'bg-[#F59E0B] text-[#0B0C10]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table Bookings</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                  activeAdminTab === 'bookings'
                    ? 'bg-[#0B0C10]/15 text-[#0B0C10]'
                    : 'bg-white/10 text-[#CBD5E1]'
                }`}
              >
                {bookings.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeAdminTab === 'analytics'}
              onClick={() => setActiveAdminTab('analytics')}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors ${
                activeAdminTab === 'analytics'
                  ? 'bg-[#F8FAFC] text-[#0B0C10]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Zomato &amp; Swiggy Analytics</span>
            </button>
          </div>
        </div>

        {activeAdminTab === 'analytics' ? (
          <AggregatorAnalyticsTab
            sessionToken={sessionToken}
            onUnauthorized={clearSession}
            onShowToast={onShowToast}
          />
        ) : activeAdminTab === 'bookings' ? (
          <>
            {/* Table Bookings Summary Metrics */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Total Bookings</span>
                  <CalendarCheck
                    className="h-4 w-4 text-[#F59E0B]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-sans text-4xl font-semibold tracking-tight text-[#F8FAFC] tabular-nums">
                  {bookingSummary.totalBookings}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  All recorded table reservations
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Active / Upcoming</span>
                  <Clock
                    className="h-4 w-4 text-[#10B981]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-sans text-4xl font-semibold tracking-tight text-[#F59E0B] tabular-nums">
                  {bookingSummary.upcomingActiveCount}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Pending, confirmed, or seated
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Total Guests</span>
                  <Users
                    className="h-4 w-4 text-[#F59E0B]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-sans text-4xl font-semibold tracking-tight text-[#F8FAFC] tabular-nums">
                  {bookingSummary.totalExpectedGuests}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Excluding cancelled reservations
                </p>
              </div>
            </div>

            {/* Bookings Search & Filter Toolbar */}
            <div className="mt-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div
                role="tablist"
                aria-label="Filter bookings by status"
                className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1"
              >
                {BOOKING_FILTER_OPTIONS.map((status) => {
                  const isSelected = bookingStatusFilter === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setBookingStatusFilter(status)}
                      className={`min-h-[36px] cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-[#F59E0B] text-[#0B0C10]'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      {status === 'All'
                        ? 'All'
                        : getBookingStatusShortLabel(status)}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={bookingSearchQuery}
                  onChange={(e) => setBookingSearchQuery(e.target.value)}
                  placeholder="Search ref ID, guest, phone, or occasion..."
                  aria-label="Search table reservations"
                  className="glass-input h-11 w-full rounded-xl pr-4 pl-10 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
                />
              </div>
            </div>

            {bookingsError && (
              <div
                role="alert"
                className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DC2626]/40 bg-[#DC2626]/12 px-4 py-3 text-xs text-[#FCA5A5]"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{bookingsError}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void fetchOwnerBookings(sessionToken, false)}
                  className="cursor-pointer rounded-lg border border-[#FCA5A5]/35 bg-white/10 px-3 py-1 font-semibold text-[#F8FAFC] hover:bg-white/15"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Bookings List / Empty State */}
            <div className="mt-6">
              {isLoadingBookings && bookings.length === 0 ? (
                <div className="glass-panel flex items-center justify-center gap-3 rounded-2xl py-16 text-sm text-[#94A3B8]">
                  <Loader2
                    className="h-5 w-5 animate-spin text-[#F59E0B]"
                    aria-hidden="true"
                  />
                  <span>Loading table reservations...</span>
                </div>
              ) : bookings.length === 0 ? (
                <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
                  <CalendarCheck
                    className="h-10 w-10 text-white/20"
                    aria-hidden="true"
                  />
                  <h2 className="mt-4 font-serif text-2xl font-semibold text-[#F8FAFC]">
                    No table reservations yet
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-[#94A3B8]">
                    Reservations submitted through the Reserve a Table form will
                    appear here automatically.
                  </p>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
                  <p className="font-serif text-xl text-[#F8FAFC]">
                    No matching reservations found
                  </p>
                  <p className="mt-1.5 text-sm text-[#94A3B8]">
                    Try clearing your search query or switching the status filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingSearchQuery('');
                      setBookingStatusFilter('All');
                    }}
                    className="mt-4 cursor-pointer rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-[#F59E0B]/45"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="glass-panel overflow-hidden rounded-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold tracking-wider text-[#94A3B8] uppercase">
                          <th className="py-3.5 pr-4 pl-5 sm:pl-6">Booking Ref</th>
                          <th className="px-4 py-3.5">Guest &amp; Phone</th>
                          <th className="px-4 py-3.5">Party &amp; Occasion</th>
                          <th className="px-4 py-3.5">Preferred Date &amp; Time</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="py-3.5 pr-5 pl-4 text-right sm:pr-6">
                            Quick Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8 text-[#F8FAFC]">
                        {filteredBookings.map((booking) => {
                          const isBusy =
                            updatingBookingId === booking.id ||
                            deletingBookingId === booking.id;
                          const isMenuOpen =
                            openBookingMenu?.bookingId === booking.id;
                          return (
                            <tr
                              key={booking.id}
                              className="transition-colors hover:bg-white/[0.025]"
                            >
                              <td className="py-4 pr-4 pl-5 align-middle sm:pl-6">
                                <p className="font-sans text-sm font-semibold tracking-tight text-[#F8FAFC] tabular-nums">
                                  #{booking.id}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[#94A3B8] tabular-nums">
                                  {formatOrderTimestamp(booking.bookedAt)}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-middle">
                                <p className="text-sm font-semibold text-[#F8FAFC]">
                                  {booking.name}
                                </p>
                                {booking.phone ? (
                                  <a
                                    href={`tel:${booking.phone}`}
                                    className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-[#F59E0B] tabular-nums hover:underline"
                                  >
                                    <Phone
                                      className="h-3 w-3 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>{booking.phone}</span>
                                  </a>
                                ) : (
                                  <span className="mt-0.5 block text-[11px] text-[#94A3B8]">
                                    No phone
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-4 align-middle">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center rounded-md border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2 py-0.5 text-[11px] font-semibold text-[#F59E0B]">
                                    {booking.occasion}
                                  </span>
                                  <span className="font-sans text-xs font-semibold text-[#F8FAFC] tabular-nums">
                                    {booking.guests}{' '}
                                    {booking.guests === 1 ? 'Guest' : 'Guests'}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] text-[#94A3B8]">
                                  {booking.locationName || 'Madhuravada Flagship'}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-middle">
                                <p className="font-sans text-xs font-semibold text-[#F8FAFC] tabular-nums sm:text-sm">
                                  {formatDisplayDateTime(booking.dateTime)}
                                </p>
                              </td>

                              <td className="px-4 py-4 align-middle">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${getBookingStatusTone(booking.status)}`}
                                >
                                  {updatingBookingId === booking.id ? (
                                    <Loader2
                                      className="h-3 w-3 animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <span
                                      aria-hidden="true"
                                      className={`h-1.5 w-1.5 rounded-full ${getBookingStatusDot(booking.status)}`}
                                    />
                                  )}
                                  <span>
                                    {getBookingStatusShortLabel(booking.status)}
                                  </span>
                                </span>
                              </td>

                              <td className="py-4 pr-5 pl-4 text-right align-middle sm:pr-6">
                                <div className="inline-flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    data-booking-quick-trigger="true"
                                    disabled={isBusy}
                                    aria-haspopup="menu"
                                    aria-expanded={isMenuOpen}
                                    aria-label={`Change status for reservation ${booking.id}`}
                                    onClick={(e) => {
                                      if (isMenuOpen) {
                                        setOpenBookingMenu(null);
                                        return;
                                      }
                                      const rect =
                                        e.currentTarget.getBoundingClientRect();
                                      const menuWidth = 192;
                                      const openUpward =
                                        window.innerHeight - rect.bottom < 240 &&
                                        rect.top > 240;
                                      setOpenBookingMenu({
                                        bookingId: booking.id,
                                        left: Math.min(
                                          window.innerWidth - menuWidth - 12,
                                          Math.max(12, rect.right - menuWidth),
                                        ),
                                        top: openUpward
                                          ? rect.top - 6
                                          : rect.bottom + 6,
                                        openUpward,
                                      });
                                    }}
                                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] transition-colors hover:border-[#F59E0B]/50 hover:text-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <MoreHorizontal
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                    <span>Status</span>
                                    <ChevronDown
                                      className={`h-3 w-3 transition-transform duration-150 ${
                                        isMenuOpen ? 'rotate-180' : ''
                                      }`}
                                      aria-hidden="true"
                                    />
                                  </button>

                                  {confirmDeleteBookingId === booking.id ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        disabled={deletingBookingId === booking.id}
                                        onClick={() =>
                                          void handleDeleteBooking(booking.id)
                                        }
                                        className="min-h-[36px] cursor-pointer rounded-xl bg-[#DC2626] px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:opacity-60"
                                      >
                                        {deletingBookingId === booking.id
                                          ? 'Deleting...'
                                          : 'Confirm'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={deletingBookingId === booking.id}
                                        onClick={() =>
                                          setConfirmDeleteBookingId(null)
                                        }
                                        className="min-h-[36px] cursor-pointer rounded-xl border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[#CBD5E1] hover:text-[#F8FAFC]"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => {
                                        setOpenBookingMenu(null);
                                        setConfirmDeleteBookingId(booking.id);
                                      }}
                                      aria-label={`Delete reservation ${booking.id}`}
                                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] text-[#94A3B8] transition-colors hover:border-[#DC2626]/45 hover:bg-[#DC2626]/12 hover:text-[#FCA5A5] disabled:opacity-50"
                                    >
                                      <Trash2
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Viewport-Safe Quick-Action Status Menu */}
                  {openBookingMenu &&
                    (() => {
                      const activeBooking = filteredBookings.find(
                        (b) => b.id === openBookingMenu.bookingId,
                      );
                      if (!activeBooking) return null;
                      return (
                        <div
                          data-booking-quick-menu="true"
                          role="menu"
                          aria-label={`Quick status actions for ${activeBooking.name}`}
                          style={{
                            position: 'fixed',
                            top: openBookingMenu.top,
                            left: openBookingMenu.left,
                            transform: openBookingMenu.openUpward
                              ? 'translateY(-100%)'
                              : undefined,
                          }}
                          className="z-50 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#14110F]/95 p-1.5 shadow-2xl backdrop-blur-xl"
                        >
                          <p className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-[#94A3B8] uppercase">
                            Set Reservation Status
                          </p>
                          <div className="space-y-0.5">
                            {BOOKING_QUICK_STATUS_ACTIONS.map((opt) => {
                              const isCurrent =
                                opt.status === 'Pending'
                                  ? isPendingBookingStatus(activeBooking.status)
                                  : activeBooking.status === opt.status;
                              return (
                                <button
                                  key={opt.status}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenBookingMenu(null);
                                    if (!isCurrent) {
                                      void handleBookingStatusChange(
                                        activeBooking.id,
                                        opt.status,
                                      );
                                    }
                                  }}
                                  className={`flex min-h-[36px] w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                                    isCurrent
                                      ? `bg-white/[0.08] ${opt.activeTextClass}`
                                      : 'text-[#F8FAFC] hover:bg-white/[0.07]'
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      aria-hidden="true"
                                      className={`h-2 w-2 rounded-full ${opt.dotClass}`}
                                    />
                                    <span>{opt.label}</span>
                                  </span>
                                  {isCurrent && (
                                    <Check
                                      className="h-3.5 w-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Summary Metrics Cards */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Total Orders</span>
                  <Package
                    className="h-4 w-4 text-[#F59E0B]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-sans text-4xl font-semibold tracking-tight text-[#F8FAFC] tabular-nums">
                  {orderSummary.totalOrders}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  All-time storefront orders
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Total Revenue</span>
                  <IndianRupee
                    className="h-4 w-4 text-[#10B981]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-sans text-4xl font-semibold tracking-tight text-[#F59E0B] tabular-nums">
                  ₹{orderSummary.totalRevenueInr.toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Gross order value (incl. GST)
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Pending / Active Orders</span>
                  <Clock
                    className="h-4 w-4 text-[#F59E0B]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-sans text-4xl font-semibold tracking-tight text-[#F8FAFC] tabular-nums">
                  {orderSummary.pendingActiveCount}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Pending or in kitchen preparation
                </p>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="mt-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div
                role="tablist"
                aria-label="Filter orders by status"
                className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1"
              >
                {(['All', ...ORDER_STATUS_OPTIONS] as const).map((status) => {
                  const isSelected = orderStatusFilter === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setOrderStatusFilter(status)}
                      className={`min-h-[36px] cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-[#F59E0B] text-[#0B0C10]'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search ID, customer, phone, or dish..."
                  aria-label="Search customer orders"
                  className="glass-input h-11 w-full rounded-xl pr-4 pl-10 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
                />
              </div>
            </div>

            {ordersError && (
              <div
                role="alert"
                className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DC2626]/40 bg-[#DC2626]/12 px-4 py-3 text-xs text-[#FCA5A5]"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{ordersError}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void fetchOwnerOrders(sessionToken, false)}
                  className="cursor-pointer rounded-lg border border-[#FCA5A5]/35 bg-white/10 px-3 py-1 font-semibold text-[#F8FAFC] hover:bg-white/15"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Orders List / Empty State */}
            <div className="mt-6">
              {isLoadingOrders && orders.length === 0 ? (
                <div className="glass-panel flex items-center justify-center gap-3 rounded-2xl py-16 text-sm text-[#94A3B8]">
                  <Loader2
                    className="h-5 w-5 animate-spin text-[#F59E0B]"
                    aria-hidden="true"
                  />
                  <span>Loading customer orders...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
                  <Package
                    className="h-10 w-10 text-white/20"
                    aria-hidden="true"
                  />
                  <h2 className="mt-4 font-serif text-2xl font-semibold text-[#F8FAFC]">
                    No customer orders yet
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-[#94A3B8]">
                    Orders submitted through the storefront dining tray will
                    appear here automatically.
                  </p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
                  <p className="font-serif text-xl text-[#F8FAFC]">
                    No matching orders found
                  </p>
                  <p className="mt-1.5 text-sm text-[#94A3B8]">
                    Try clearing your search query or switching the status
                    filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSearchQuery('');
                      setOrderStatusFilter('All');
                    }}
                    className="mt-4 cursor-pointer rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-[#F59E0B]/45"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const orderItems = Array.isArray(order.items)
                      ? order.items
                      : [];
                    return (
                      <article
                        key={order.id}
                        className="glass-panel rounded-2xl p-5 sm:p-6"
                      >
                        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-sans text-lg font-semibold tracking-tight text-[#F8FAFC] tabular-nums">
                                #{order.id}
                              </span>
                              <span className="text-xs text-[#94A3B8] tabular-nums">
                                {formatOrderTimestamp(order.createdAt)}
                              </span>
                              <span className="text-xs font-medium text-[#F59E0B]">
                                · {order.fulfillmentType}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              <span className="font-semibold text-[#F8FAFC]">
                                {order.customerName}
                              </span>
                              {order.customerPhone && (
                                <a
                                  href={`tel:${order.customerPhone}`}
                                  className="inline-flex items-center gap-1.5 text-xs text-[#F59E0B] tabular-nums hover:underline"
                                >
                                  <Phone
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>{order.customerPhone}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-left sm:text-right">
                              <p className="text-[11px] text-[#94A3B8]">
                                Order Total
                              </p>
                              <p className="font-sans text-2xl font-semibold tracking-tight text-[#F59E0B] tabular-nums">
                                ₹
                                {(
                                  Number(order.totalAmountInr) || 0
                                ).toLocaleString('en-IN')}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                htmlFor={`status-${order.id}`}
                                className="sr-only"
                              >
                                Update status for order {order.id}
                              </label>
                              <select
                                id={`status-${order.id}`}
                                value={order.status}
                                disabled={
                                  updatingOrderId === order.id ||
                                  deletingOrderId === order.id
                                }
                                onChange={(e) =>
                                  void handleOrderStatusChange(
                                    order.id,
                                    e.target.value as OrderStatus,
                                  )
                                }
                                className={`min-h-[40px] cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#F59E0B] ${getOrderStatusTone(order.status)}`}
                              >
                                {ORDER_STATUS_OPTIONS.map((opt) => (
                                  <option
                                    key={opt}
                                    value={opt}
                                    className="bg-[#0B0C10] text-[#F8FAFC]"
                                  >
                                    {opt}
                                  </option>
                                ))}
                              </select>

                              {confirmDeleteOrderId === order.id ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={deletingOrderId === order.id}
                                    onClick={() =>
                                      void handleDeleteOrder(order.id)
                                    }
                                    className="min-h-[40px] cursor-pointer rounded-xl bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:opacity-60"
                                  >
                                    {deletingOrderId === order.id
                                      ? 'Deleting...'
                                      : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deletingOrderId === order.id}
                                    onClick={() => setConfirmDeleteOrderId(null)}
                                    className="min-h-[40px] cursor-pointer rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-[#F8FAFC]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeleteOrderId(order.id)
                                  }
                                  aria-label={`Delete order ${order.id}`}
                                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#94A3B8] transition-colors hover:border-[#DC2626]/45 hover:bg-[#DC2626]/12 hover:text-[#FCA5A5]"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Delivery / Pickup Details + Ordered Items */}
                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                          <div className="min-w-0 lg:col-span-5">
                            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8]">
                              {order.fulfillmentType === 'Delivery' ? (
                                <MapPin
                                  className="h-3.5 w-3.5 text-[#F59E0B]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Store
                                  className="h-3.5 w-3.5 text-[#F59E0B]"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                {order.fulfillmentType === 'Delivery'
                                  ? 'Delivery Address'
                                  : 'Pickup Details'}
                              </span>
                            </p>
                            <p className="mt-1.5 break-words text-sm leading-relaxed text-[#F8FAFC]/90">
                              {order.deliveryAddress}
                            </p>
                          </div>

                          <div className="min-w-0 lg:col-span-7">
                            <p className="text-xs font-medium text-[#94A3B8] tabular-nums">
                              Ordered Items ({orderItems.length})
                            </p>
                            {orderItems.length === 0 ? (
                              <p className="mt-1.5 text-xs text-[#94A3B8]">
                                No line items recorded for this order.
                              </p>
                            ) : (
                              <ul className="mt-1.5 divide-y divide-white/8">
                                {orderItems.map((line, idx) => (
                                  <li
                                    key={`${order.id}-${line.itemId}-${idx}`}
                                    className="flex items-start justify-between gap-3 py-2 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium text-[#F8FAFC]">
                                        <span className="text-[#F59E0B] tabular-nums">
                                          {line.quantity}×
                                        </span>{' '}
                                        {line.name}
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                                        {line.spicePreference} ·{' '}
                                        {line.portionStyle}
                                        {line.notes
                                          ? ` · Note: ${line.notes}`
                                          : ''}
                                      </p>
                                    </div>
                                    <span className="shrink-0 font-semibold text-[#F8FAFC] tabular-nums">
                                      ₹
                                      {(
                                        Number(line.lineTotalInr) || 0
                                      ).toLocaleString('en-IN')}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
