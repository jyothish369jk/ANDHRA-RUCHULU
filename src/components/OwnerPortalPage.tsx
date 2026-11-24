import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  IndianRupee,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';
import type { CustomerOrder, OrderStatus } from '../types/restaurant';
import { AggregatorAnalyticsTab } from './AggregatorAnalyticsTab';
import { BrandEmblem } from './InteractivePrimitives';

const OWNER_SESSION_KEY = 'ar_owner_session_token';
const ADMIN_AUTH_FLAG_KEY = 'isAdminAuthenticated';
const AUTHORIZED_OWNER_EMAIL = 'jyothish369k@gmail.com';

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'Pending',
  'Preparing',
  'Delivered',
  'Cancelled',
];

interface OrdersSummary {
  totalOrders: number;
  totalRevenueInr: number;
  pendingActiveCount: number;
}

interface OwnerPortalPageProps {
  onBackToSite: () => void;
  onShowToast: (title: string, description: string) => void;
}

function getStatusTone(status: OrderStatus): string {
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

function formatOrderTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
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
      const isAuthed = window.sessionStorage.getItem(ADMIN_AUTH_FLAG_KEY) === 'true';
      return token && (isAuthed || token.length > 0) ? token : null;
    } catch {
      return null;
    }
  });
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(() => {
    try {
      return Boolean(window.sessionStorage.getItem(OWNER_SESSION_KEY));
    } catch {
      return false;
    }
  });

  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  // Passkey Login Form State
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Authenticated Dashboard State
  const [activeAdminTab, setActiveAdminTab] = useState<'orders' | 'analytics'>(
    'orders',
  );
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>({
    totalOrders: 0,
    totalRevenueInr: 0,
    pendingActiveCount: 0,
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');

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
    setSummary({
      totalOrders: 0,
      totalRevenueInr: 0,
      pendingActiveCount: 0,
    });
  }, []);

  const fetchOwnerOrders = useCallback(
    async (token: string, silent = false) => {
      setIsLoadingOrders(true);
      try {
        const res = await fetch('/api/admin/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          clearSession();
          return;
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Invalid response');
        }
        const data = (await res.json()) as {
          orders?: CustomerOrder[];
          summary?: OrdersSummary;
        };
        if (!res.ok) {
          throw new Error('Failed to load orders');
        }
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        if (data.summary) {
          setSummary(data.summary);
        }
        if (!silent) {
          onShowToast('Orders Refreshed', 'Loaded the latest customer orders.');
        }
      } catch {
        onShowToast('Refresh Failed', 'Could not load orders from server.');
      } finally {
        setIsLoadingOrders(false);
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
        const res = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (cancelled) return;
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
          await fetchOwnerOrders(sessionToken, true);
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsVerifyingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, clearSession, fetchOwnerOrders]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    setLoginError(null);
    const normalizedPasskey = String(pinInput ?? '').trim();

    if (!normalizedPasskey) {
      setLoginError('Please enter your 4-digit admin passkey.');
      return;
    }

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
      if (!contentType.includes('application/json')) {
        setLoginError('Unable to verify passkey right now. Please try again.');
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
          data.error || 'Incorrect passkey. Please enter the valid 4-digit passkey.',
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
      onShowToast('Admin Portal Unlocked', 'Welcome back to Andhra Ruchulu Order Desk.');
    } catch {
      setLoginError('Unable to reach verification server. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const activeToken = sessionToken;
    clearSession();
    if (activeToken) {
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

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    if (!sessionToken || updatingOrderId === orderId) return;
    setUpdatingOrderId(orderId);
    try {
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
      const data = (await res.json()) as { order?: CustomerOrder; error?: string };
      if (!res.ok || !data.order) {
        onShowToast('Update Failed', data.error || 'Could not update order status.');
        return;
      }

      setOrders((prev) => {
        const updatedList = prev.map((ord) =>
          ord.id === orderId ? data.order! : ord,
        );
        setSummary({
          totalOrders: updatedList.length,
          totalRevenueInr: updatedList.reduce(
            (sum, ord) => sum + ord.totalAmountInr,
            0,
          ),
          pendingActiveCount: updatedList.filter(
            (ord) => ord.status === 'Pending' || ord.status === 'Preparing',
          ).length,
        });
        return updatedList;
      });
      onShowToast('Status Updated', `Order #${orderId} marked as ${nextStatus}.`);
    } catch {
      onShowToast('Update Failed', 'Network error updating order status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'All' && order.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const itemMatch = order.items.some((item) =>
        item.name.toLowerCase().includes(q),
      );
      return (
        order.id.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.customerPhone.toLowerCase().includes(q) ||
        order.deliveryAddress.toLowerCase().includes(q) ||
        itemMatch
      );
    });
  }, [orders, searchQuery, statusFilter]);

  if (isVerifyingSession) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel-elevated flex items-center gap-3 rounded-2xl px-6 py-4 text-sm text-[#F8FAFC]">
          <Loader2 className="h-4 w-4 animate-spin text-[#F59E0B]" aria-hidden="true" />
          <span>Verifying owner session...</span>
        </div>
      </div>
    );
  }

  // Strictly block all order UI & metrics until sessionToken and authorized email are verified
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
              Enter your 4-digit security PIN to access the Andhra Ruchulu order desk.
            </p>

            <form onSubmit={handleLoginSubmit} noValidate className="mt-6 space-y-4">
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
                    id="owner-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    autoFocus
                    autoComplete="off"
                    required
                    value={pinInput}
                    onChange={(e) => {
                      const sanitized = String(e.target.value ?? '')
                        .replace(/\D/g, '')
                        .slice(0, 4);
                      setPinInput(sanitized);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="••••"
                    className="glass-input h-11 w-full rounded-xl pr-11 pl-10 text-sm tracking-[0.25em] text-[#F8FAFC] tabular-nums placeholder:tracking-normal placeholder:text-[#94A3B8]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    aria-label={showPin ? 'Hide security PIN' : 'Show security PIN'}
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
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#FBBF24] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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

  return (
    <div className="relative z-10 min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        {/* Admin Header */}
        <header className="glass-panel-elevated flex flex-col justify-between gap-4 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <BrandEmblem className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#F59E0B]">
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
              onClick={() => fetchOwnerOrders(sessionToken, false)}
              disabled={isLoadingOrders}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-[#F8FAFC] transition-colors hover:border-[#F59E0B]/45 hover:text-[#F59E0B] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`}
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

        {/* Admin Portal Sub-Navigation Tabs (Hidden from public & pre-login) */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Admin Portal sections"
            className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-white/12 bg-white/[0.04] p-1.5"
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
        ) : (
          <>
            {/* Summary Metrics Cards */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Total Orders</span>
                  <Package className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
                </div>
                <p className="mt-2 font-serif text-4xl font-semibold text-[#F8FAFC] tabular-nums">
                  {summary.totalOrders}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">All-time storefront orders</p>
              </div>

          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Total Revenue</span>
              <IndianRupee className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-serif text-4xl font-semibold text-[#F59E0B] tabular-nums">
              ₹{summary.totalRevenueInr.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">Gross order value (incl. GST)</p>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Pending / Active Orders</span>
              <Clock className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-serif text-4xl font-semibold text-[#F8FAFC] tabular-nums">
              {summary.pendingActiveCount}
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">Pending or in kitchen preparation</p>
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
              const isSelected = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setStatusFilter(status)}
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, customer, phone, or dish..."
              aria-label="Search customer orders"
              className="glass-input h-11 w-full rounded-xl pr-4 pl-10 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
            />
          </div>
        </div>

        {/* Orders List / Empty State */}
        <div className="mt-6">
          {isLoadingOrders && orders.length === 0 ? (
            <div className="glass-panel flex items-center justify-center gap-3 rounded-2xl py-16 text-sm text-[#94A3B8]">
              <Loader2 className="h-5 w-5 animate-spin text-[#F59E0B]" aria-hidden="true" />
              <span>Loading customer orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
              <Package className="h-10 w-10 text-white/20" aria-hidden="true" />
              <h2 className="mt-4 font-serif text-2xl font-semibold text-[#F8FAFC]">
                No customer orders yet
              </h2>
              <p className="mt-2 max-w-md text-sm text-[#94A3B8]">
                Orders submitted through the storefront dining tray will appear here
                automatically in real time.
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
              <p className="font-serif text-xl text-[#F8FAFC]">
                No matching orders found
              </p>
              <p className="mt-1.5 text-sm text-[#94A3B8]">
                Try clearing your search query or switching the status filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <article
                  key={order.id}
                  className="glass-panel rounded-2xl p-5 sm:p-6"
                >
                  <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-serif text-xl font-semibold text-[#F8FAFC] tabular-nums">
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
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="inline-flex items-center gap-1.5 text-xs text-[#F59E0B] tabular-nums hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{order.customerPhone}</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] text-[#94A3B8]">Order Total</p>
                        <p className="font-serif text-2xl font-semibold text-[#F59E0B] tabular-nums">
                          ₹{order.totalAmountInr.toLocaleString('en-IN')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`status-${order.id}`}
                          className="sr-only"
                        >
                          Update status for order {order.id}
                        </label>
                        <select
                          id={`status-${order.id}`}
                          value={order.status}
                          disabled={updatingOrderId === order.id}
                          onChange={(e) =>
                            handleStatusChange(
                              order.id,
                              e.target.value as OrderStatus,
                            )
                          }
                          className={`min-h-[40px] cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#F59E0B] ${getStatusTone(order.status)}`}
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
                      </div>
                    </div>
                  </div>

                  {/* Delivery / Pickup Details + Ordered Items */}
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8]">
                        {order.fulfillmentType === 'Delivery' ? (
                          <MapPin className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                        ) : (
                          <Store className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                        )}
                        <span>
                          {order.fulfillmentType === 'Delivery'
                            ? 'Delivery Address'
                            : 'Pickup Details'}
                        </span>
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#F8FAFC]/90">
                        {order.deliveryAddress}
                      </p>
                    </div>

                    <div className="lg:col-span-7">
                      <p className="text-xs font-medium text-[#94A3B8]">
                        Ordered Items ({order.items.length})
                      </p>
                      <ul className="mt-1.5 divide-y divide-white/8">
                        {order.items.map((line, idx) => (
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
                                {line.spicePreference} · {line.portionStyle}
                                {line.notes ? ` · Note: ${line.notes}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold text-[#F8FAFC] tabular-nums">
                              ₹{line.lineTotalInr.toLocaleString('en-IN')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
