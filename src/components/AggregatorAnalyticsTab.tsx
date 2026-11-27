import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Flame,
  Info,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  AggregatorAnalyticsEntry,
  AggregatorEntryInput,
  AggregatorPlatform,
  AggregatorSettlementStatus,
} from '../types/restaurant';
import {
  dataService,
  SAMPLE_AGGREGATOR_CSV,
} from '../services/dataService';
import { MarginRecoverySimulator } from './MarginRecoverySimulator';

type DateRangeFilter = '7D' | '30D' | 'Month' | 'All';
type ChartMetricMode = 'gross' | 'net' | 'orders';

interface AggregatorAnalyticsTabProps {
  refreshKey?: number;
  onShowToast: (title: string, description: string) => void;
}

interface DailyChartPoint {
  date: string;
  label: string;
  zomatoGross: number;
  swiggyGross: number;
  zomatoNet: number;
  swiggyNet: number;
  zomatoOrders: number;
  swiggyOrders: number;
  totalNetPayout: number;
  totalOrders: number;
}

interface TopDeliveryDish {
  id: string;
  name: string;
  category: string;
  unitPriceInr: number;
  zomatoWeight: number;
  swiggyWeight: number;
  rating: string;
}

const ZOMATO_COLOR = '#E23744';
const SWIGGY_COLOR = '#FC8019';
const EMERALD_COLOR = '#10B981';

const TOP_DELIVERY_MENU_PROFILE: TopDeliveryDish[] = [
  {
    id: 'chicken-dum-biryani',
    name: 'Hyderabadi Chicken Dum Biryani',
    category: 'Royal Biryanis',
    unitPriceInr: 420,
    zomatoWeight: 0.28,
    swiggyWeight: 0.25,
    rating: '4.6',
  },
  {
    id: 'gongura-mutton',
    name: 'Gongura Mutton Curry & Bagara Rice',
    category: 'Signature Mains',
    unitPriceInr: 560,
    zomatoWeight: 0.19,
    swiggyWeight: 0.17,
    rating: '4.5',
  },
  {
    id: 'royyala-vepudu',
    name: 'Raju Gari Royyala Vepudu',
    category: 'Coastal Starters',
    unitPriceInr: 490,
    zomatoWeight: 0.16,
    swiggyWeight: 0.18,
    rating: '4.5',
  },
  {
    id: 'andhra-veg-thali',
    name: 'Andhra Bhojanam Veg Thali',
    category: 'Traditional Meals',
    unitPriceInr: 340,
    zomatoWeight: 0.15,
    swiggyWeight: 0.19,
    rating: '4.4',
  },
  {
    id: 'guntur-kodi-vepudu',
    name: 'Guntur Karam Kodi Vepudu',
    category: 'Vepudu Specials',
    unitPriceInr: 390,
    zomatoWeight: 0.13,
    swiggyWeight: 0.12,
    rating: '4.4',
  },
  {
    id: 'hot-punugulu',
    name: 'Crispy Punugulu & Ginger Chutney',
    category: 'Evening Tiffins',
    unitPriceInr: 180,
    zomatoWeight: 0.09,
    swiggyWeight: 0.09,
    rating: '4.3',
  },
];

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatCompactInr(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded >= 100000) {
    return `₹${(rounded / 100000).toFixed(1)}L`;
  }
  if (rounded >= 1000) {
    return `₹${Math.round(rounded / 1000)}k`;
  }
  return `₹${rounded}`;
}

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildSmoothSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx.toFixed(2)} ${p0.y.toFixed(2)}, ${cx.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

function buildAreaSvgPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
): string {
  if (points.length === 0) return '';
  const line = buildSmoothSvgPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

function computeDeltaPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function useAnimatedNumber(target: number, durationMs = 420): number {
  const [displayValue, setDisplayValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      valueRef.current = target;
      setDisplayValue(target);
      return;
    }

    const startValue = valueRef.current;
    if (Math.round(startValue) === Math.round(target)) {
      valueRef.current = target;
      setDisplayValue(target);
      return;
    }

    let frameId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (target - startValue) * eased;
      valueRef.current = current;
      setDisplayValue(Math.round(current));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        valueRef.current = target;
        setDisplayValue(target);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return displayValue;
}

export function AggregatorAnalyticsTab({
  refreshKey = 0,
  onShowToast,
}: AggregatorAnalyticsTabProps) {
  const [entries, setEntries] = useState<AggregatorAnalyticsEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('7D');
  const [chartMetricMode, setChartMetricMode] =
    useState<ChartMetricMode>('gross');
  const [tablePlatformFilter, setTablePlatformFilter] = useState<
    'All' | AggregatorPlatform
  >('All');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [showAllLedgerRows, setShowAllLedgerRows] = useState(false);

  // KPI Interactive Popover / Breakdown
  const [showDeductionBreakdown, setShowDeductionBreakdown] = useState(false);

  // Interactive Chart & Donut Hover State
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredDonutPlatform, setHoveredDonutPlatform] =
    useState<AggregatorPlatform | null>(null);

  // Quick Log Drawer State (Create or Edit)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] =
    useState<AggregatorAnalyticsEntry | null>(null);
  const [formPlatform, setFormPlatform] =
    useState<AggregatorPlatform>('Zomato');
  const [formDate, setFormDate] = useState(getTodayIso);
  const [formOrders, setFormOrders] = useState('34');
  const [formCancelledOrders, setFormCancelledOrders] = useState('1');
  const [formGross, setFormGross] = useState('26800');
  const [formDeductions, setFormDeductions] = useState('5896');
  const [formStatus, setFormStatus] =
    useState<AggregatorSettlementStatus>('Settled');
  const [formOrderId, setFormOrderId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);

  // CSV Import Modal State
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [isDragOverCsv, setIsDragOverCsv] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await dataService.listAggregatorEntries();
      setEntries(Array.isArray(list) ? list : []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not load Zomato & Swiggy analytics right now.';
      setLoadError(message);
      onShowToast('Analytics Unavailable', message);
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries, refreshKey]);

  useEffect(() => {
    if (!drawerOpen && !csvModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (csvModalOpen) setCsvModalOpen(false);
        else if (drawerOpen) setDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, csvModalOpen]);

  const {
    filteredEntries,
    previousWindowEntries,
    thirtyDayEntries,
    windowDescription,
  } = useMemo(() => {
    if (entries.length === 0) {
      return {
        filteredEntries: [] as AggregatorAnalyticsEntry[],
        previousWindowEntries: [] as AggregatorAnalyticsEntry[],
        thirtyDayEntries: [] as AggregatorAnalyticsEntry[],
        windowDescription: 'No partner settlements logged',
      };
    }

    const validDatedEntries = entries.filter((item) =>
      /^\d{4}-\d{2}-\d{2}$/.test(item?.date || ''),
    );
    if (validDatedEntries.length === 0) {
      return {
        filteredEntries: entries,
        previousWindowEntries: [] as AggregatorAnalyticsEntry[],
        thirtyDayEntries: entries,
        windowDescription: 'All recorded entries',
      };
    }

    const latestDateStr = validDatedEntries.reduce(
      (max, item) => (item.date > max ? item.date : max),
      validDatedEntries[0].date,
    );
    const [y, m, d] = latestDateStr.split('-').map(Number);
    const anchor = new Date(y, (m || 1) - 1, d || 1);

    const toDateKey = (dateObj: Date) => {
      const yy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    const thirtyStart = new Date(anchor);
    thirtyStart.setDate(anchor.getDate() - 29);
    const thirtyStartKey = toDateKey(thirtyStart);
    const thirtyDaySlice = entries.filter((e) => e.date >= thirtyStartKey);

    if (dateRange === 'All') {
      const earliestDateStr = validDatedEntries.reduce(
        (min, item) => (item.date < min ? item.date : min),
        validDatedEntries[0].date,
      );
      return {
        filteredEntries: entries,
        previousWindowEntries: [] as AggregatorAnalyticsEntry[],
        thirtyDayEntries: thirtyDaySlice,
        windowDescription: `${formatShortDate(earliestDateStr)} – ${formatShortDate(latestDateStr)}`,
      };
    }

    if (dateRange === 'Month') {
      const currentMonthPrefix = latestDateStr.slice(0, 7);
      const prevMonthDate = new Date(y, m - 2, 1);
      const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(
        prevMonthDate.getMonth() + 1,
      ).padStart(2, '0')}`;
      const monthLabel = anchor.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      return {
        filteredEntries: entries.filter((e) =>
          e.date.startsWith(currentMonthPrefix),
        ),
        previousWindowEntries: entries.filter((e) =>
          e.date.startsWith(prevMonthPrefix),
        ),
        thirtyDayEntries: thirtyDaySlice,
        windowDescription: `${monthLabel} MTD`,
      };
    }

    const days = dateRange === '7D' ? 7 : 30;
    const startDate = new Date(anchor);
    startDate.setDate(anchor.getDate() - (days - 1));
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(startDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevEndDate.getDate() - (days - 1));

    const startKey = toDateKey(startDate);
    const prevStartKey = toDateKey(prevStartDate);
    const prevEndKey = toDateKey(prevEndDate);

    return {
      filteredEntries: entries.filter((e) => e.date >= startKey),
      previousWindowEntries: entries.filter(
        (e) => e.date >= prevStartKey && e.date <= prevEndKey,
      ),
      thirtyDayEntries: thirtyDaySlice,
      windowDescription: `${formatShortDate(startKey)} – ${formatShortDate(latestDateStr)}`,
    };
  }, [entries, dateRange]);

  const kpis = useMemo(() => {
    const summarize = (list: AggregatorAnalyticsEntry[]) => {
      let netPayout = 0;
      let totalOrders = 0;
      let cancelledOrders = 0;
      let zomatoSales = 0;
      let zomatoNet = 0;
      let swiggySales = 0;
      let swiggyNet = 0;
      let zomatoOrders = 0;
      let swiggyOrders = 0;
      let totalDeductions = 0;
      let commissionTotal = 0;
      let gstTotal = 0;
      let packagingTotal = 0;
      let adsTotal = 0;

      for (const item of list) {
        netPayout += item.netPayoutInr;
        totalOrders += item.orders;
        cancelledOrders += item.cancelledOrders ?? 0;
        totalDeductions += item.deductionsInr;
        commissionTotal +=
          item.commissionInr ?? Math.round(item.deductionsInr * 0.72);
        gstTotal += item.gstInr ?? Math.round(item.deductionsInr * 0.13);
        packagingTotal +=
          item.packagingInr ?? Math.round(item.deductionsInr * 0.08);
        adsTotal +=
          item.adsDiscountInr ??
          Math.max(
            0,
            item.deductionsInr -
              (item.commissionInr ?? Math.round(item.deductionsInr * 0.72)) -
              (item.gstInr ?? Math.round(item.deductionsInr * 0.13)) -
              (item.packagingInr ?? Math.round(item.deductionsInr * 0.08)),
          );

        if (item.platform === 'Zomato') {
          zomatoSales += item.grossSalesInr;
          zomatoNet += item.netPayoutInr;
          zomatoOrders += item.orders;
        } else {
          swiggySales += item.grossSalesInr;
          swiggyNet += item.netPayoutInr;
          swiggyOrders += item.orders;
        }
      }

      return {
        netPayout,
        totalOrders,
        cancelledOrders,
        zomatoSales,
        zomatoNet,
        swiggySales,
        swiggyNet,
        zomatoOrders,
        swiggyOrders,
        totalDeductions,
        commissionTotal,
        gstTotal,
        packagingTotal,
        adsTotal,
      };
    };

    const curr = summarize(filteredEntries);
    const prev = summarize(previousWindowEntries);

    const totalGross = curr.zomatoSales + curr.swiggySales;
    const zomatoOrderPct =
      curr.totalOrders > 0 ? (curr.zomatoOrders / curr.totalOrders) * 100 : 50;
    const swiggyOrderPct =
      curr.totalOrders > 0 ? (curr.swiggyOrders / curr.totalOrders) * 100 : 50;
    const cancellationRate =
      curr.totalOrders + curr.cancelledOrders > 0
        ? (curr.cancelledOrders / (curr.totalOrders + curr.cancelledOrders)) *
          100
        : 0;
    const commissionPct =
      totalGross > 0 ? (curr.commissionTotal / totalGross) * 100 : 0;
    const deductionRatePct =
      totalGross > 0 ? (curr.totalDeductions / totalGross) * 100 : 0;

    return {
      ...curr,
      totalGross,
      zomatoOrderPct,
      swiggyOrderPct,
      cancellationRate,
      commissionPct,
      deductionRatePct,
      netTrend: computeDeltaPercent(curr.netPayout, prev.netPayout),
      ordersTrend: computeDeltaPercent(curr.totalOrders, prev.totalOrders),
      zomatoTrend: computeDeltaPercent(curr.zomatoSales, prev.zomatoSales),
      swiggyTrend: computeDeltaPercent(curr.swiggySales, prev.swiggySales),
      avgOrderValue:
        curr.totalOrders > 0 ? Math.round(totalGross / curr.totalOrders) : 0,
    };
  }, [filteredEntries, previousWindowEntries]);

  // Smooth Animated Metric Counters
  const animatedNetPayout = useAnimatedNumber(kpis.netPayout);
  const animatedTotalOrders = useAnimatedNumber(kpis.totalOrders);
  const animatedZomatoSales = useAnimatedNumber(kpis.zomatoSales);
  const animatedSwiggySales = useAnimatedNumber(kpis.swiggySales);
  const animatedAov = useAnimatedNumber(kpis.avgOrderValue);

  const dailyChartData = useMemo<DailyChartPoint[]>(() => {
    const byDate = new Map<string, DailyChartPoint>();
    for (const item of filteredEntries) {
      const existing = byDate.get(item.date) || {
        date: item.date,
        label: formatShortDate(item.date),
        zomatoGross: 0,
        swiggyGross: 0,
        zomatoNet: 0,
        swiggyNet: 0,
        zomatoOrders: 0,
        swiggyOrders: 0,
        totalNetPayout: 0,
        totalOrders: 0,
      };
      if (item.platform === 'Zomato') {
        existing.zomatoGross += item.grossSalesInr;
        existing.zomatoNet += item.netPayoutInr;
        existing.zomatoOrders += item.orders;
      } else {
        existing.swiggyGross += item.grossSalesInr;
        existing.swiggyNet += item.netPayoutInr;
        existing.swiggyOrders += item.orders;
      }
      existing.totalNetPayout += item.netPayoutInr;
      existing.totalOrders += item.orders;
      byDate.set(item.date, existing);
    }
    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [filteredEntries]);

  // Dynamic Top Selling Items on Delivery (scaled deterministically by active Zomato/Swiggy orders)
  const topDeliveryItems = useMemo(() => {
    const zBase = Math.max(kpis.zomatoOrders, 0);
    const sBase = Math.max(kpis.swiggyOrders, 0);
    const zScale = kpis.zomatoOrders > 0 ? kpis.zomatoSales / (zBase * 410) : 1;
    const sScale = kpis.swiggyOrders > 0 ? kpis.swiggySales / (sBase * 410) : 1;

    return TOP_DELIVERY_MENU_PROFILE.map((dish) => {
      const zQty = Math.round(zBase * dish.zomatoWeight * 1.32);
      const sQty = Math.round(sBase * dish.swiggyWeight * 1.32);
      const totalQty = zQty + sQty;
      const revenue = Math.round(
        zQty * dish.unitPriceInr * Math.min(1.25, Math.max(0.85, zScale)) +
          sQty * dish.unitPriceInr * Math.min(1.25, Math.max(0.85, sScale)),
      );
      return {
        ...dish,
        zQty,
        sQty,
        totalQty,
        revenue,
        zSharePct: totalQty > 0 ? Math.round((zQty / totalQty) * 100) : 50,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [kpis.swiggyOrders, kpis.swiggySales, kpis.zomatoOrders, kpis.zomatoSales]);

  const maxDishRevenue = useMemo(
    () =>
      topDeliveryItems.reduce((max, item) => Math.max(max, item.revenue), 1),
    [topDeliveryItems],
  );

  // SVG Chart Geometry
  const chartWidth = 680;
  const chartHeight = 250;
  const padLeft = 56;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 34;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  const getMetricValues = useCallback(
    (pt: DailyChartPoint) => {
      if (chartMetricMode === 'net') {
        return { zVal: pt.zomatoNet, sVal: pt.swiggyNet };
      }
      if (chartMetricMode === 'orders') {
        return { zVal: pt.zomatoOrders, sVal: pt.swiggyOrders };
      }
      return { zVal: pt.zomatoGross, sVal: pt.swiggyGross };
    },
    [chartMetricMode],
  );

  const { maxY, yTicks, zomatoCoords, swiggyCoords } = useMemo(() => {
    const highest = dailyChartData.reduce((max, pt) => {
      const { zVal, sVal } = getMetricValues(pt);
      return Math.max(max, zVal, sVal);
    }, 0);

    const stepSize = chartMetricMode === 'orders' ? 10 : 5000;
    const minFloor = chartMetricMode === 'orders' ? 20 : 10000;
    const niceMax = Math.max(
      minFloor,
      Math.ceil((highest * 1.16) / stepSize) * stepSize,
    );

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: Math.round(niceMax * ratio),
      y: padTop + plotHeight - ratio * plotHeight,
    }));

    const count = dailyChartData.length;
    const zPts = dailyChartData.map((pt, i) => {
      const { zVal } = getMetricValues(pt);
      return {
        x:
          count <= 1
            ? padLeft + plotWidth / 2
            : padLeft + (i / (count - 1)) * plotWidth,
        y: padTop + plotHeight - (zVal / niceMax) * plotHeight,
      };
    });
    const sPts = dailyChartData.map((pt, i) => {
      const { sVal } = getMetricValues(pt);
      return {
        x:
          count <= 1
            ? padLeft + plotWidth / 2
            : padLeft + (i / (count - 1)) * plotWidth,
        y: padTop + plotHeight - (sVal / niceMax) * plotHeight,
      };
    });

    return {
      maxY: niceMax,
      yTicks: ticks,
      zomatoCoords: zPts,
      swiggyCoords: sPts,
    };
  }, [
    chartMetricMode,
    dailyChartData,
    getMetricValues,
    plotHeight,
    plotWidth,
  ]);

  const csvPreview = useMemo(
    () => (csvRawText.trim() ? dataService.parseCsv(csvRawText) : null),
    [csvRawText],
  );

  const filteredTableEntries = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();
    return filteredEntries.filter((e) => {
      const matchesPlatform =
        tablePlatformFilter === 'All' || e.platform === tablePlatformFilter;
      if (!matchesPlatform) return false;
      if (!query) return true;
      return (
        e.date.toLowerCase().includes(query) ||
        formatShortDate(e.date).toLowerCase().includes(query) ||
        e.platform.toLowerCase().includes(query) ||
        (e.orderId ?? '').toLowerCase().includes(query) ||
        (e.notes ?? '').toLowerCase().includes(query) ||
        (e.settlementStatus ?? 'Settled').toLowerCase().includes(query)
      );
    });
  }, [filteredEntries, ledgerSearch, tablePlatformFilter]);

  const visibleTableEntries = useMemo(() => {
    if (showAllLedgerRows || ledgerSearch.trim()) {
      return filteredTableEntries;
    }
    return filteredTableEntries.slice(0, 14);
  }, [filteredTableEntries, ledgerSearch, showAllLedgerRows]);

  const openCreateDrawer = () => {
    setEditingEntry(null);
    setFormPlatform('Zomato');
    setFormDate(getTodayIso());
    setFormOrders('34');
    setFormCancelledOrders('1');
    setFormGross('26800');
    setFormDeductions('5896');
    setFormStatus('Processing');
    setFormOrderId('');
    setFormNotes('');
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (entry: AggregatorAnalyticsEntry) => {
    setEditingEntry(entry);
    setFormPlatform(entry.platform);
    setFormDate(entry.date);
    setFormOrders(String(entry.orders));
    setFormCancelledOrders(String(entry.cancelledOrders ?? 0));
    setFormGross(String(entry.grossSalesInr));
    setFormDeductions(String(entry.deductionsInr));
    setFormStatus(entry.settlementStatus ?? 'Settled');
    setFormOrderId(entry.orderId || '');
    setFormNotes(entry.notes || '');
    setFormError(null);
    setDrawerOpen(true);
  };

  const livePreviewNet = useMemo(() => {
    const g = Number(formGross) || 0;
    const d = Number(formDeductions) || 0;
    return Math.round(g - d);
  }, [formGross, formDeductions]);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingForm) return;
    setFormError(null);

    const ordersNum = Number(formOrders);
    const cancelledNum = Number(formCancelledOrders || 0);
    const grossNum = Number(formGross);
    const dedNum = Number(formDeductions || 0);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(formDate) ||
      !Number.isFinite(ordersNum) ||
      ordersNum < 0 ||
      !Number.isFinite(cancelledNum) ||
      cancelledNum < 0 ||
      !Number.isFinite(grossNum) ||
      grossNum < 0 ||
      !Number.isFinite(dedNum) ||
      dedNum < 0
    ) {
      setFormError(
        'Please enter valid date, order counts, gross sales, and deductions.',
      );
      return;
    }

    const payload: AggregatorEntryInput = {
      platform: formPlatform,
      date: formDate,
      orders: Math.round(ordersNum),
      cancelledOrders: Math.round(cancelledNum),
      grossSalesInr: Math.round(grossNum),
      deductionsInr: Math.round(dedNum),
      settlementStatus: formStatus,
      orderId: formOrderId.trim() || undefined,
      source: editingEntry ? editingEntry.source : 'Manual',
      notes: formNotes.trim() || undefined,
    };

    setIsSavingForm(true);
    try {
      if (editingEntry) {
        const updated = await dataService.updateAggregatorEntry(
          editingEntry.id,
          payload,
        );
        setEntries((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => b.date.localeCompare(a.date)),
        );
        onShowToast(
          'Entry Updated',
          `${updated.platform} · ${formatShortDate(updated.date)} saved.`,
        );
      } else {
        const created = await dataService.createAggregatorEntry(payload);
        setEntries((prev) =>
          [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
        );
        onShowToast(
          'Entry Logged',
          `${created.platform} · ${formatInr(created.netPayoutInr)} net payout added.`,
        );
      }
      setDrawerOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not save entry.',
      );
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleDeleteEntry = async (entry: AggregatorAnalyticsEntry) => {
    if (deletingId) return;
    setDeletingId(entry.id);
    try {
      await dataService.deleteAggregatorEntry(entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setConfirmDeleteId((prev) => (prev === entry.id ? null : prev));
      onShowToast(
        'Entry Deleted',
        `Removed ${entry.platform} log for ${formatShortDate(entry.date)}.`,
      );
    } catch {
      onShowToast('Delete Failed', 'Could not remove analytics entry.');
    } finally {
      setDeletingId(null);
    }
  };

  const readCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvRawText(typeof reader.result === 'string' ? reader.result : '');
      setCsvFileName(file.name);
      setCsvError(null);
    };
    reader.onerror = () => {
      setCsvError('Unable to read the selected CSV file.');
    };
    reader.readAsText(file);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    readCsvFile(file);
  };

  const handleCsvDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverCsv(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setCsvError('Please drop a valid .csv partner export file.');
      return;
    }
    readCsvFile(file);
  };

  const handleConfirmCsvImport = async () => {
    if (!csvPreview || csvPreview.entries.length === 0 || isImportingCsv) return;
    setIsImportingCsv(true);
    setCsvError(null);
    try {
      // Brief skeleton beat so financial reconciliation feels crisp & verifiable
      await new Promise((resolve) => setTimeout(resolve, 420));
      const imported = await dataService.importAggregatorEntries(
        csvPreview.entries,
      );
      setEntries((prev) =>
        [...imported, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
      );
      setCsvModalOpen(false);
      setCsvRawText('');
      setCsvFileName(null);
      onShowToast(
        'CSV Imported',
        `Reconciled ${imported.length} partner rows into your ledger.`,
      );
    } catch (error) {
      setCsvError(
        error instanceof Error ? error.message : 'Failed to import CSV rows.',
      );
    } finally {
      setIsImportingCsv(false);
    }
  };

  // Donut Ring Geometry
  const donutSize = 172;
  const donutStroke = 15;
  const donutRadius = (donutSize - donutStroke) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const zomatoArcLength = (kpis.zomatoOrderPct / 100) * donutCircumference;
  const swiggyArcLength = Math.max(0, donutCircumference - zomatoArcLength);

  const renderTrendBadge = (delta: number | null) => {
    if (delta === null) {
      return (
        <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-[#A1A1AA]">
          Full history
        </span>
      );
    }
    const positive = delta >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${
          positive
            ? 'border-[#10B981]/30 bg-[#10B981]/12 text-[#10B981]'
            : 'border-rose-500/30 bg-rose-500/12 text-rose-400'
        }`}
      >
        {positive ? (
          <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        {positive ? '+' : '-'}
        {Math.abs(delta)}% vs prev period
      </span>
    );
  };

  const activeHoverPoint =
    hoveredIdx !== null && dailyChartData[hoveredIdx]
      ? dailyChartData[hoveredIdx]
      : null;

  return (
    <section
      aria-label="Delivery Partner Intelligence — Zomato and Swiggy Analytics"
      className="mt-6 rounded-3xl border border-white/[0.08] bg-[#09090B] p-5 text-[#F4F4F5] shadow-[0_28px_70px_-15px_rgba(0,0,0,0.85)] sm:p-8"
    >
      {/* Executive Header & Interactive Controls */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 xl:flex-row xl:items-center">
        <div>
          <p className="text-xs font-medium tracking-wide text-[#A1A1AA]">
            Delivery Partner Intelligence · {windowDescription}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#F4F4F5] sm:text-2xl">
            Zomato &amp; Swiggy Financial Command
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Animated Time Filter Pills */}
          <div
            role="group"
            aria-label="Analytics date window"
            className="inline-flex items-center rounded-xl border border-white/[0.08] bg-[#121216] p-1"
          >
            {(['7D', '30D', 'Month', 'All'] as DateRangeFilter[]).map((opt) => {
              const active = dateRange === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setDateRange(opt);
                    setHoveredIdx(null);
                    setShowAllLedgerRows(false);
                  }}
                  className={`relative cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-[#09090B]'
                      : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="analytics-date-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-[#F4F4F5]"
                    />
                  )}
                  <span className="relative z-10">{opt}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setCsvError(null);
              setCsvModalOpen(true);
            }}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#121216] px-3.5 py-2 text-xs font-medium text-[#F4F4F5] whitespace-nowrap transition-colors hover:border-white/20 hover:bg-[#18181D]"
          >
            <Upload className="h-3.5 w-3.5 text-[#A1A1AA]" aria-hidden="true" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#F4F4F5] px-4 py-2 text-xs font-semibold text-[#09090B] whitespace-nowrap transition-colors hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Log Orders</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="cursor-pointer rounded-lg border border-rose-400/30 bg-[#18181D] px-3 py-1 font-semibold text-rose-200 hover:bg-rose-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && entries.length === 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="h-36 animate-pulse rounded-2xl border border-white/[0.08] bg-[#121216] p-5"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Enhanced 4-Card Executive KPI Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* 1. Net Payout (₹) with Expandable Deduction Breakdown */}
            <div
              onMouseEnter={() => setShowDeductionBreakdown(true)}
              onMouseLeave={() => setShowDeductionBreakdown(false)}
              className="relative rounded-2xl border border-white/[0.08] bg-[#121216] p-5 transition-colors hover:border-[#10B981]/35 hover:bg-[#18181D]/90"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-[#10B981]/10 blur-2xl"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#A1A1AA]">
                  Net Payout (₹)
                </span>
                {renderTrendBadge(kpis.netTrend)}
              </div>

              <p className="mt-3 text-2xl font-semibold tracking-tight text-[#10B981] tabular-nums sm:text-3xl">
                {formatInr(animatedNetPayout)}
              </p>

              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#A1A1AA] tabular-nums">
                <span>
                  {formatCompactInr(kpis.totalGross)} gross ·{' '}
                  {kpis.deductionRatePct.toFixed(1)}% fees
                </span>
                <button
                  type="button"
                  onClick={() => setShowDeductionBreakdown((prev) => !prev)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#F4F4F5] transition-colors hover:bg-white/[0.06]"
                  aria-expanded={showDeductionBreakdown}
                >
                  <Info className="h-3 w-3 text-[#10B981]" aria-hidden="true" />
                  <span>Breakdown</span>
                </button>
              </div>

              <AnimatePresence>
                {showDeductionBreakdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16 }}
                    className="absolute top-[calc(100%+8px)] right-0 left-0 z-20 rounded-xl border border-white/[0.12] bg-[#18181D] p-3.5 shadow-2xl"
                  >
                    <p className="text-[11px] font-semibold tracking-wide text-[#F4F4F5]">
                      Partner Deductions ({formatInr(kpis.totalDeductions)})
                    </p>
                    <div className="mt-2 space-y-1.5 text-[11px] tabular-nums">
                      <div className="flex items-center justify-between text-[#A1A1AA]">
                        <span>
                          Platform Commission ({kpis.commissionPct.toFixed(1)}%)
                        </span>
                        <span className="font-medium text-[#F4F4F5]">
                          -{formatInr(kpis.commissionTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#A1A1AA]">
                        <span>GST on Commission (18%)</span>
                        <span className="font-medium text-[#F4F4F5]">
                          -{formatInr(kpis.gstTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#A1A1AA]">
                        <span>Packaging Charges</span>
                        <span className="font-medium text-[#F4F4F5]">
                          -{formatInr(kpis.packagingTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#A1A1AA]">
                        <span>Ads &amp; Promo Discounts</span>
                        <span className="font-medium text-[#F4F4F5]">
                          -{formatInr(kpis.adsTotal)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Total Orders */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-5 transition-colors hover:border-white/[0.15] hover:bg-[#18181D]/90">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#A1A1AA]">
                  Total Orders
                </span>
                {renderTrendBadge(kpis.ordersTrend)}
              </div>

              <p className="mt-3 text-2xl font-semibold tracking-tight text-[#F4F4F5] tabular-nums sm:text-3xl">
                {animatedTotalOrders.toLocaleString('en-IN')}
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-[#A1A1AA] tabular-nums">
                <span>
                  AOV{' '}
                  <strong className="font-medium text-[#F4F4F5]">
                    {formatInr(animatedAov)}
                  </strong>
                </span>
                <span className="text-amber-300/90">
                  {kpis.cancellationRate.toFixed(1)}% cancelled (
                  {kpis.cancelledOrders})
                </span>
              </div>
            </div>

            {/* 3. Zomato Performance */}
            <div
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121216] p-5 transition-colors hover:border-[#E23744]/40 hover:bg-[#18181D]/90"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 92% 8%, rgba(226, 55, 68, 0.15), transparent 55%)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-[#F4F4F5]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ZOMATO_COLOR }}
                  />
                  Zomato Performance
                </span>
                {renderTrendBadge(kpis.zomatoTrend)}
              </div>

              <p className="mt-3 text-2xl font-semibold tracking-tight text-[#F4F4F5] tabular-nums sm:text-3xl">
                {formatInr(animatedZomatoSales)}
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-[#A1A1AA] tabular-nums">
                <span>
                  Net{' '}
                  <strong className="font-medium text-[#10B981]">
                    {formatInr(kpis.zomatoNet)}
                  </strong>{' '}
                  · {kpis.zomatoOrders.toLocaleString('en-IN')} orders (
                  {kpis.totalGross > 0
                    ? Math.round((kpis.zomatoSales / kpis.totalGross) * 100)
                    : 0}
                  %)
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-[#F4F4F5]">
                  <Star
                    className="h-3 w-3 fill-amber-400 text-amber-400"
                    aria-hidden="true"
                  />
                  4.4 · 24m
                </span>
              </div>
            </div>

            {/* 4. Swiggy Performance */}
            <div
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121216] p-5 transition-colors hover:border-[#FC8019]/40 hover:bg-[#18181D]/90"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 92% 8%, rgba(252, 128, 25, 0.15), transparent 55%)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-[#F4F4F5]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SWIGGY_COLOR }}
                  />
                  Swiggy Performance
                </span>
                {renderTrendBadge(kpis.swiggyTrend)}
              </div>

              <p className="mt-3 text-2xl font-semibold tracking-tight text-[#F4F4F5] tabular-nums sm:text-3xl">
                {formatInr(animatedSwiggySales)}
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-[#A1A1AA] tabular-nums">
                <span>
                  Net{' '}
                  <strong className="font-medium text-[#10B981]">
                    {formatInr(kpis.swiggyNet)}
                  </strong>{' '}
                  · {kpis.swiggyOrders.toLocaleString('en-IN')} orders (
                  {kpis.totalGross > 0
                    ? Math.round((kpis.swiggySales / kpis.totalGross) * 100)
                    : 0}
                  %)
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-[#F4F4F5]">
                  <Star
                    className="h-3 w-3 fill-amber-400 text-amber-400"
                    aria-hidden="true"
                  />
                  4.3 · 26m
                </span>
              </div>
            </div>
          </div>

          {/* Primary Charts Grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Zomato vs. Swiggy Revenue Trend Area Chart */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-5 sm:p-6 lg:col-span-8">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold text-[#F4F4F5]">
                    Zomato vs. Swiggy Revenue Trend
                  </h3>
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">
                    {chartMetricMode === 'gross'
                      ? 'Daily gross partner sales (₹ INR)'
                      : chartMetricMode === 'net'
                        ? 'Daily net settled payout after deductions (₹ INR)'
                        : 'Daily delivered order count comparison'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Chart Metric Toggle */}
                  <div
                    role="group"
                    aria-label="Chart metric view"
                    className="inline-flex items-center rounded-lg border border-white/[0.08] bg-[#09090B] p-0.5"
                  >
                    {(
                      [
                        { id: 'gross', label: 'Gross Sales (₹)' },
                        { id: 'net', label: 'Net Payout (₹)' },
                        { id: 'orders', label: 'Order Volume' },
                      ] as const
                    ).map((mode) => {
                      const active = chartMetricMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setChartMetricMode(mode.id);
                            setHoveredIdx(null);
                          }}
                          className={`relative cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                            active
                              ? 'text-[#F4F4F5]'
                              : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="analytics-chart-mode"
                              transition={{
                                type: 'spring',
                                stiffness: 420,
                                damping: 32,
                              }}
                              className="absolute inset-0 rounded-md border border-white/[0.1] bg-[#18181D]"
                            />
                          )}
                          <span className="relative z-10">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium text-[#A1A1AA]">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: ZOMATO_COLOR }}
                      />
                      Zomato
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: SWIGGY_COLOR }}
                      />
                      Swiggy
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="relative mt-5 w-full select-none"
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {dailyChartData.length === 0 ? (
                  <div className="flex h-[250px] items-center justify-center text-xs text-[#A1A1AA]">
                    No entries in selected date range.
                  </div>
                ) : (
                  <>
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="h-[250px] w-full overflow-visible"
                      role="img"
                      aria-label="Zomato versus Swiggy revenue trend area chart"
                    >
                      <defs>
                        <linearGradient
                          id="zomatoDarkGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={ZOMATO_COLOR}
                            stopOpacity="0.32"
                          />
                          <stop
                            offset="100%"
                            stopColor={ZOMATO_COLOR}
                            stopOpacity="0.0"
                          />
                        </linearGradient>
                        <linearGradient
                          id="swiggyDarkGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={SWIGGY_COLOR}
                            stopOpacity="0.28"
                          />
                          <stop
                            offset="100%"
                            stopColor={SWIGGY_COLOR}
                            stopOpacity="0.0"
                          />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Dashed Gridlines */}
                      {yTicks.map((tick) => (
                        <g key={tick.value}>
                          <line
                            x1={padLeft}
                            y1={tick.y}
                            x2={chartWidth - padRight}
                            y2={tick.y}
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="1"
                            strokeDasharray="3 4"
                          />
                          <text
                            x={padLeft - 10}
                            y={tick.y + 3.5}
                            textAnchor="end"
                            fill="#A1A1AA"
                            fontSize="10.5"
                            className="tabular-nums"
                          >
                            {chartMetricMode === 'orders'
                              ? tick.value
                              : tick.value === 0
                                ? '₹0'
                                : formatCompactInr(tick.value)}
                          </text>
                        </g>
                      ))}

                      {/* Area Fills */}
                      <path
                        d={buildAreaSvgPath(
                          swiggyCoords,
                          padTop + plotHeight,
                        )}
                        fill="url(#swiggyDarkGrad)"
                      />
                      <path
                        d={buildAreaSvgPath(
                          zomatoCoords,
                          padTop + plotHeight,
                        )}
                        fill="url(#zomatoDarkGrad)"
                      />

                      {/* Smooth Splines */}
                      <path
                        d={buildSmoothSvgPath(swiggyCoords)}
                        fill="none"
                        stroke={SWIGGY_COLOR}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      <path
                        d={buildSmoothSvgPath(zomatoCoords)}
                        fill="none"
                        stroke={ZOMATO_COLOR}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />

                      {/* Single-point visible dots */}
                      {dailyChartData.length === 1 &&
                        zomatoCoords[0] &&
                        swiggyCoords[0] && (
                          <>
                            <circle
                              cx={zomatoCoords[0].x}
                              cy={zomatoCoords[0].y}
                              r="5"
                              fill={ZOMATO_COLOR}
                              stroke="#121216"
                              strokeWidth="2"
                            />
                            <circle
                              cx={swiggyCoords[0].x}
                              cy={swiggyCoords[0].y}
                              r="5"
                              fill={SWIGGY_COLOR}
                              stroke="#121216"
                              strokeWidth="2"
                            />
                          </>
                        )}

                      {/* Active Crosshair & Glowing Nodes */}
                      {hoveredIdx !== null && zomatoCoords[hoveredIdx] && (
                        <>
                          <line
                            x1={zomatoCoords[hoveredIdx].x}
                            y1={padTop}
                            x2={zomatoCoords[hoveredIdx].x}
                            y2={padTop + plotHeight}
                            stroke="rgba(255,255,255,0.22)"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={zomatoCoords[hoveredIdx].x}
                            cy={zomatoCoords[hoveredIdx].y}
                            r="7"
                            fill="rgba(226, 55, 68, 0.28)"
                          />
                          <circle
                            cx={zomatoCoords[hoveredIdx].x}
                            cy={zomatoCoords[hoveredIdx].y}
                            r="4.5"
                            fill={ZOMATO_COLOR}
                            stroke="#F4F4F5"
                            strokeWidth="1.75"
                          />
                          <circle
                            cx={swiggyCoords[hoveredIdx].x}
                            cy={swiggyCoords[hoveredIdx].y}
                            r="7"
                            fill="rgba(252, 128, 25, 0.28)"
                          />
                          <circle
                            cx={swiggyCoords[hoveredIdx].x}
                            cy={swiggyCoords[hoveredIdx].y}
                            r="4.5"
                            fill={SWIGGY_COLOR}
                            stroke="#F4F4F5"
                            strokeWidth="1.75"
                          />
                        </>
                      )}

                      {/* Date Axis Labels */}
                      {dailyChartData.map((pt, i) => {
                        const showLabel =
                          dailyChartData.length <= 8 ||
                          i === 0 ||
                          i === dailyChartData.length - 1 ||
                          i % Math.ceil(dailyChartData.length / 6) === 0;
                        if (!showLabel) return null;
                        return (
                          <text
                            key={pt.date}
                            x={zomatoCoords[i]?.x ?? padLeft}
                            y={chartHeight - 8}
                            textAnchor="middle"
                            fill="#A1A1AA"
                            fontSize="10.5"
                          >
                            {pt.label}
                          </text>
                        );
                      })}

                      {/* Hover Capture Columns */}
                      {dailyChartData.map((pt, i) => {
                        const x = zomatoCoords[i]?.x ?? padLeft;
                        const step =
                          dailyChartData.length > 1
                            ? plotWidth / (dailyChartData.length - 1)
                            : plotWidth;
                        return (
                          <rect
                            key={`hit-${pt.date}`}
                            x={Math.max(padLeft - 8, x - step / 2)}
                            y={padTop}
                            width={Math.max(16, step)}
                            height={plotHeight + 16}
                            fill="transparent"
                            className="cursor-crosshair"
                            onMouseEnter={() => setHoveredIdx(i)}
                            onFocus={() => setHoveredIdx(i)}
                          />
                        );
                      })}
                    </svg>

                    {/* Dark Glassmorphic Crosshair Tooltip */}
                    <AnimatePresence>
                      {activeHoverPoint && hoveredIdx !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.14 }}
                          style={{
                            left: `${Math.min(
                              56,
                              Math.max(
                                2,
                                ((zomatoCoords[hoveredIdx]?.x ?? padLeft) /
                                  chartWidth) *
                                  100 -
                                  12,
                              ),
                            )}%`,
                          }}
                          className="pointer-events-none absolute top-2 z-10 w-60 max-w-[calc(100%-1rem)] rounded-xl border border-white/[0.12] bg-[#18181D]/95 p-3.5 shadow-2xl backdrop-blur-md"
                        >
                          <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                            <p className="text-[11px] font-semibold text-[#F4F4F5]">
                              {activeHoverPoint.label} · {activeHoverPoint.date}
                            </p>
                            <span className="text-[11px] font-medium text-[#A1A1AA] tabular-nums">
                              {activeHoverPoint.totalOrders} orders
                            </span>
                          </div>

                          <div className="mt-2 space-y-1.5 text-xs tabular-nums">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[#A1A1AA]">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: ZOMATO_COLOR }}
                                />
                                Zomato ({activeHoverPoint.zomatoOrders})
                              </span>
                              <span className="font-semibold text-[#F4F4F5]">
                                {chartMetricMode === 'orders'
                                  ? `${activeHoverPoint.zomatoOrders} ord`
                                  : chartMetricMode === 'net'
                                    ? formatInr(activeHoverPoint.zomatoNet)
                                    : formatInr(activeHoverPoint.zomatoGross)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[#A1A1AA]">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: SWIGGY_COLOR }}
                                />
                                Swiggy ({activeHoverPoint.swiggyOrders})
                              </span>
                              <span className="font-semibold text-[#F4F4F5]">
                                {chartMetricMode === 'orders'
                                  ? `${activeHoverPoint.swiggyOrders} ord`
                                  : chartMetricMode === 'net'
                                    ? formatInr(activeHoverPoint.swiggyNet)
                                    : formatInr(activeHoverPoint.swiggyGross)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between border-t border-white/[0.08] pt-1.5">
                              <span className="text-[11px] text-[#A1A1AA]">
                                Total Net Payout
                              </span>
                              <span className="font-semibold text-[#10B981]">
                                {formatInr(activeHoverPoint.totalNetPayout)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
              <span className="sr-only">Scale peak {formatInr(maxY)}</span>
            </div>

            {/* Interactive Order Split & Deductions Breakdown Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#121216] p-5 sm:p-6 lg:col-span-4">
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Order Split &amp; Fee Mix
                </h3>
                <p className="mt-0.5 text-xs text-[#A1A1AA]">
                  Hover a partner arc to inspect volume share
                </p>
              </div>

              <div className="my-4 flex items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <svg
                    width={donutSize}
                    height={donutSize}
                    viewBox={`0 0 ${donutSize} ${donutSize}`}
                    className="-rotate-90"
                    role="img"
                    aria-label={`Zomato ${kpis.zomatoOrderPct.toFixed(1)}% vs Swiggy ${kpis.swiggyOrderPct.toFixed(1)}% order split`}
                  >
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth={donutStroke}
                    />
                    {/* Swiggy Arc */}
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke={SWIGGY_COLOR}
                      strokeWidth={
                        hoveredDonutPlatform === 'Swiggy'
                          ? donutStroke + 3
                          : donutStroke
                      }
                      strokeOpacity={
                        hoveredDonutPlatform &&
                        hoveredDonutPlatform !== 'Swiggy'
                          ? 0.35
                          : 1
                      }
                      strokeDasharray={`${swiggyArcLength} ${donutCircumference}`}
                      strokeDashoffset={-zomatoArcLength}
                      strokeLinecap="butt"
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredDonutPlatform('Swiggy')}
                      onMouseLeave={() => setHoveredDonutPlatform(null)}
                    />
                    {/* Zomato Arc */}
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke={ZOMATO_COLOR}
                      strokeWidth={
                        hoveredDonutPlatform === 'Zomato'
                          ? donutStroke + 3
                          : donutStroke
                      }
                      strokeOpacity={
                        hoveredDonutPlatform &&
                        hoveredDonutPlatform !== 'Zomato'
                          ? 0.35
                          : 1
                      }
                      strokeDasharray={`${zomatoArcLength} ${donutCircumference}`}
                      strokeDashoffset={0}
                      strokeLinecap="butt"
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredDonutPlatform('Zomato')}
                      onMouseLeave={() => setHoveredDonutPlatform(null)}
                    />
                  </svg>

                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-medium text-[#A1A1AA]">
                      {hoveredDonutPlatform === 'Zomato'
                        ? 'Zomato Share'
                        : hoveredDonutPlatform === 'Swiggy'
                          ? 'Swiggy Share'
                          : 'Total Orders'}
                    </span>
                    <span className="mt-0.5 text-2xl font-semibold tracking-tight text-[#F4F4F5] tabular-nums">
                      {hoveredDonutPlatform === 'Zomato'
                        ? `${kpis.zomatoOrderPct.toFixed(1)}%`
                        : hoveredDonutPlatform === 'Swiggy'
                          ? `${kpis.swiggyOrderPct.toFixed(1)}%`
                          : kpis.totalOrders.toLocaleString('en-IN')}
                    </span>
                    {hoveredDonutPlatform && (
                      <span className="text-[11px] text-[#A1A1AA] tabular-nums">
                        {hoveredDonutPlatform === 'Zomato'
                          ? `${kpis.zomatoOrders} orders`
                          : `${kpis.swiggyOrders} orders`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-white/[0.08] pt-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onMouseEnter={() => setHoveredDonutPlatform('Zomato')}
                    onMouseLeave={() => setHoveredDonutPlatform(null)}
                    className="cursor-pointer rounded-xl border border-white/[0.06] bg-[#18181D] px-3 py-2 transition-colors hover:border-[#E23744]/40"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: ZOMATO_COLOR }}
                      />
                      <span>Zomato</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#F4F4F5] tabular-nums">
                      {kpis.zomatoOrderPct.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-[#A1A1AA] tabular-nums">
                      {kpis.zomatoOrders.toLocaleString('en-IN')} orders
                    </p>
                  </div>

                  <div
                    onMouseEnter={() => setHoveredDonutPlatform('Swiggy')}
                    onMouseLeave={() => setHoveredDonutPlatform(null)}
                    className="cursor-pointer rounded-xl border border-white/[0.06] bg-[#18181D] px-3 py-2 transition-colors hover:border-[#FC8019]/40"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: SWIGGY_COLOR }}
                      />
                      <span>Swiggy</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#F4F4F5] tabular-nums">
                      {kpis.swiggyOrderPct.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-[#A1A1AA] tabular-nums">
                      {kpis.swiggyOrders.toLocaleString('en-IN')} orders
                    </p>
                  </div>
                </div>

                {/* Compact Deductions Composition Bar */}
                <div className="rounded-xl border border-white/[0.06] bg-[#09090B]/70 px-3 py-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#A1A1AA]">Deductions Split</span>
                    <span className="font-medium text-[#F4F4F5] tabular-nums">
                      -{formatInr(kpis.totalDeductions)}
                    </span>
                  </div>
                  <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    {kpis.totalDeductions > 0 && (
                      <>
                        <div
                          title={`Commission: ${formatInr(kpis.commissionTotal)}`}
                          style={{
                            width: `${(kpis.commissionTotal / kpis.totalDeductions) * 100}%`,
                          }}
                          className="bg-[#E23744]"
                        />
                        <div
                          title={`GST on Commission: ${formatInr(kpis.gstTotal)}`}
                          style={{
                            width: `${(kpis.gstTotal / kpis.totalDeductions) * 100}%`,
                          }}
                          className="bg-[#FC8019]"
                        />
                        <div
                          title={`Packaging & Ads: ${formatInr(kpis.packagingTotal + kpis.adsTotal)}`}
                          style={{
                            width: `${((kpis.packagingTotal + kpis.adsTotal) / kpis.totalDeductions) * 100}%`,
                          }}
                          className="bg-amber-300"
                        />
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#A1A1AA] tabular-nums">
                    <span>Comm {formatCompactInr(kpis.commissionTotal)}</span>
                    <span>GST {formatCompactInr(kpis.gstTotal)}</span>
                    <span>
                      Pkg/Ads{' '}
                      {formatCompactInr(kpis.packagingTotal + kpis.adsTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Commission Leakage & Margin Recovery Simulator */}
          <MarginRecoverySimulator
            thirtyDayEntries={thirtyDayEntries}
            activeWindowEntries={filteredEntries}
            activeRangeLabel={dateRange}
            onShowToast={onShowToast}
          />

          {/* Top Selling Items on Delivery */}
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#121216] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-2 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#18181D] text-amber-400">
                  <Flame className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#F4F4F5]">
                    Top Selling Items on Delivery
                  </h3>
                  <p className="text-xs text-[#A1A1AA]">
                    Andhra Ruchulu bestsellers ranked by partner delivery revenue (
                    {dateRange})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#A1A1AA]">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ZOMATO_COLOR }}
                  />
                  Zomato Volume
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SWIGGY_COLOR }}
                  />
                  Swiggy Volume
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topDeliveryItems.map((dish, idx) => {
                const barWidthPct = Math.max(
                  14,
                  Math.round((dish.revenue / maxDishRevenue) * 100),
                );
                return (
                  <div
                    key={dish.id}
                    className="rounded-xl border border-white/[0.06] bg-[#18181D]/65 p-4 transition-colors hover:border-white/[0.14] hover:bg-[#18181D]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#09090B] text-[10px] font-semibold text-[#A1A1AA] tabular-nums">
                            #{idx + 1}
                          </span>
                          <p className="truncate text-xs font-semibold text-[#F4F4F5]">
                            {dish.name}
                          </p>
                        </div>
                        <p className="mt-1 pl-7 text-[11px] text-[#A1A1AA]">
                          {dish.category} · {formatInr(dish.unitPriceInr)} ·{' '}
                          <span className="text-amber-300">{dish.rating} ★</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[#10B981] tabular-nums">
                        {formatInr(dish.revenue)}
                      </span>
                    </div>

                    <div className="mt-3 pl-7">
                      <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] tabular-nums">
                        <span>{dish.totalQty.toLocaleString('en-IN')} plates</span>
                        <span>
                          Z {dish.zQty} · S {dish.sQty}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="flex h-full overflow-hidden rounded-full transition-all duration-300"
                          style={{ width: `${barWidthPct}%` }}
                        >
                          <div
                            style={{
                              width: `${dish.zSharePct}%`,
                              backgroundColor: ZOMATO_COLOR,
                            }}
                          />
                          <div
                            style={{
                              width: `${100 - dish.zSharePct}%`,
                              backgroundColor: SWIGGY_COLOR,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Searchable & Filterable Recent Payouts / Settlement Ledger Table */}
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#121216]">
            <div className="flex flex-col justify-between gap-3 border-b border-white/[0.08] px-5 py-4 lg:flex-row lg:items-center lg:px-6">
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F5]">
                  Recent Payouts &amp; Order Ledger
                </h3>
                <p className="mt-0.5 text-xs text-[#A1A1AA] tabular-nums">
                  {filteredTableEntries.length} matching settlement{' '}
                  {filteredTableEntries.length === 1 ? 'record' : 'records'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[210px] flex-1 sm:flex-none">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#A1A1AA]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search date, order ID, notes..."
                    aria-label="Search settlement ledger"
                    className="h-9 w-full rounded-xl border border-white/[0.08] bg-[#09090B] pr-3 pl-8 text-xs text-[#F4F4F5] placeholder:text-[#A1A1AA]/60 focus:border-white/25 focus:outline-none"
                  />
                </div>

                <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#09090B] p-1">
                  {(['All', 'Zomato', 'Swiggy'] as const).map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setTablePlatformFilter(plat)}
                      className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                        tablePlatformFilter === plat
                          ? 'bg-[#18181D] text-[#F4F4F5] shadow-2xs'
                          : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                      }`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visibleTableEntries.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[#A1A1AA]">
                No partner settlements match your current filter. Click{' '}
                <button
                  type="button"
                  onClick={openCreateDrawer}
                  className="cursor-pointer font-semibold text-[#F4F4F5] underline hover:text-white"
                >
                  + Log Orders
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  onClick={() => {
                    setCsvError(null);
                    setCsvModalOpen(true);
                  }}
                  className="cursor-pointer font-semibold text-[#F4F4F5] underline hover:text-white"
                >
                  Import CSV
                </button>{' '}
                to record partner payouts.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[11px] font-medium tracking-wider text-[#A1A1AA] uppercase">
                        <th className="py-3.5 pr-4 pl-6">Date</th>
                        <th className="px-4 py-3.5">Platform</th>
                        <th className="px-4 py-3.5">Ref / Notes</th>
                        <th className="px-4 py-3.5 text-right">Orders</th>
                        <th className="px-4 py-3.5 text-right">Gross Sales</th>
                        <th className="px-4 py-3.5 text-right">Deductions</th>
                        <th className="px-4 py-3.5 text-right">Net Settled</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="py-3.5 pr-6 pl-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] text-[#F4F4F5]">
                      {visibleTableEntries.map((entry) => {
                        const isProcessing =
                          entry.settlementStatus === 'Processing';
                        return (
                          <tr
                            key={entry.id}
                            className="transition-colors hover:bg-[#18181D]"
                          >
                            <td className="py-3.5 pr-4 pl-6 font-medium whitespace-nowrap text-[#F4F4F5] tabular-nums">
                              {formatShortDate(entry.date)}
                              <span className="ml-2 text-[11px] font-normal text-[#A1A1AA]">
                                {entry.date}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-medium ${
                                  entry.platform === 'Zomato'
                                    ? 'border-[#E23744]/35 bg-[#E23744]/15 text-[#FF8A93]'
                                    : 'border-[#FC8019]/35 bg-[#FC8019]/15 text-[#FFB373]'
                                }`}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      entry.platform === 'Zomato'
                                        ? ZOMATO_COLOR
                                        : SWIGGY_COLOR,
                                  }}
                                />
                                {entry.platform}
                              </span>
                            </td>

                            <td className="max-w-[190px] truncate px-4 py-3.5 text-[#A1A1AA]">
                              {entry.orderId ? (
                                <span className="font-mono text-[11px] text-[#F4F4F5]">
                                  {entry.orderId}
                                </span>
                              ) : (
                                entry.notes || entry.source
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-right font-medium text-[#F4F4F5] tabular-nums">
                              {entry.orders.toLocaleString('en-IN')}
                            </td>

                            <td className="px-4 py-3.5 text-right text-[#F4F4F5] tabular-nums">
                              {formatInr(entry.grossSalesInr)}
                            </td>

                            <td className="px-4 py-3.5 text-right text-[#A1A1AA] tabular-nums">
                              -{formatInr(entry.deductionsInr)}
                            </td>

                            <td className="px-4 py-3.5 text-right font-semibold text-[#10B981] tabular-nums">
                              {formatInr(entry.netPayoutInr)}
                            </td>

                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                                  isProcessing
                                    ? 'border-amber-400/30 bg-amber-400/12 text-amber-300'
                                    : 'border-[#10B981]/30 bg-[#10B981]/12 text-[#10B981]'
                                }`}
                              >
                                {isProcessing ? (
                                  <Clock
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Check
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                )}
                                {entry.settlementStatus ?? 'Settled'}
                              </span>
                            </td>

                            <td className="py-3.5 pr-6 pl-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {confirmDeleteId === entry.id ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={deletingId === entry.id}
                                      onClick={() =>
                                        void handleDeleteEntry(entry)
                                      }
                                      className="cursor-pointer rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                                    >
                                      {deletingId === entry.id
                                        ? 'Removing...'
                                        : 'Confirm'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingId === entry.id}
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="cursor-pointer rounded-lg border border-white/[0.1] bg-[#18181D] px-2 py-1 text-[11px] font-medium text-[#A1A1AA] hover:text-[#F4F4F5]"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditDrawer(entry)}
                                      aria-label={`Edit ${entry.platform} entry on ${entry.date}`}
                                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#A1A1AA] transition-colors hover:bg-white/[0.08] hover:text-[#F4F4F5]"
                                    >
                                      <Pencil
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingId === entry.id}
                                      onClick={() =>
                                        setConfirmDeleteId(entry.id)
                                      }
                                      aria-label={`Delete ${entry.platform} entry on ${entry.date}`}
                                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#A1A1AA] transition-colors hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-50"
                                    >
                                      <Trash2
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredTableEntries.length > 14 && !ledgerSearch.trim() && (
                  <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-3 text-xs text-[#A1A1AA]">
                    <span className="tabular-nums">
                      Showing {visibleTableEntries.length} of{' '}
                      {filteredTableEntries.length} entries
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllLedgerRows((prev) => !prev)}
                      className="inline-flex cursor-pointer items-center gap-1 font-medium text-[#F4F4F5] hover:text-white"
                    >
                      <span>
                        {showAllLedgerRows
                          ? 'Show recent 14'
                          : `View all ${filteredTableEntries.length} rows`}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showAllLedgerRows ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Dark Glassmorphic Quick Log Slide-Over Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={
                editingEntry ? 'Edit Aggregator Entry' : 'Log Aggregator Orders'
              }
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto flex h-full w-full max-w-md flex-col justify-between overflow-y-auto border-l border-white/[0.1] bg-[#121216] p-6 text-[#F4F4F5] shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div>
                    <p className="text-xs font-medium text-[#A1A1AA]">
                      Partner Settlement Ledger
                    </p>
                    <h3 className="text-lg font-semibold text-[#F4F4F5]">
                      {editingEntry
                        ? 'Edit Settlement Log'
                        : 'Log Partner Orders'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close drawer"
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/[0.1] bg-[#18181D] text-[#A1A1AA] hover:text-[#F4F4F5]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <form
                  id="aggregator-log-form"
                  onSubmit={handleSaveEntry}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <span className="block text-xs font-medium text-[#A1A1AA]">
                      Delivery Platform
                    </span>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-[#09090B] p-1">
                      {(['Zomato', 'Swiggy'] as AggregatorPlatform[]).map(
                        (plat) => (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => setFormPlatform(plat)}
                            className={`flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all ${
                              formPlatform === plat
                                ? plat === 'Zomato'
                                  ? 'border border-[#E23744]/40 bg-[#E23744]/15 text-[#F4F4F5]'
                                  : 'border border-[#FC8019]/40 bg-[#FC8019]/15 text-[#F4F4F5]'
                                : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                            }`}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor:
                                  plat === 'Zomato'
                                    ? ZOMATO_COLOR
                                    : SWIGGY_COLOR,
                              }}
                            />
                            {plat}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="agg-date"
                        className="block text-xs font-medium text-[#A1A1AA]"
                      >
                        Settlement Date
                      </label>
                      <input
                        id="agg-date"
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 text-xs text-[#F4F4F5] focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="agg-status"
                        className="block text-xs font-medium text-[#A1A1AA]"
                      >
                        Settlement Status
                      </label>
                      <select
                        id="agg-status"
                        value={formStatus}
                        onChange={(e) =>
                          setFormStatus(
                            e.target.value as AggregatorSettlementStatus,
                          )
                        }
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 text-xs text-[#F4F4F5] focus:border-white/30 focus:outline-none"
                      >
                        <option value="Settled">Settled</option>
                        <option value="Processing">Processing</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="agg-orders"
                        className="block text-xs font-medium text-[#A1A1AA]"
                      >
                        Delivered Orders
                      </label>
                      <input
                        id="agg-orders"
                        type="number"
                        min={0}
                        required
                        value={formOrders}
                        onChange={(e) => setFormOrders(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 text-xs text-[#F4F4F5] tabular-nums focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="agg-cancelled"
                        className="block text-xs font-medium text-[#A1A1AA]"
                      >
                        Cancelled / Rejected
                      </label>
                      <input
                        id="agg-cancelled"
                        type="number"
                        min={0}
                        value={formCancelledOrders}
                        onChange={(e) => setFormCancelledOrders(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 text-xs text-[#F4F4F5] tabular-nums focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="agg-gross"
                        className="block text-xs font-medium text-[#A1A1AA]"
                      >
                        Gross Sales (₹)
                      </label>
                      <input
                        id="agg-gross"
                        type="number"
                        min={0}
                        required
                        value={formGross}
                        onChange={(e) => setFormGross(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 text-xs text-[#F4F4F5] tabular-nums focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="agg-deductions"
                          className="block text-xs font-medium text-[#A1A1AA]"
                        >
                          Deductions (₹)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const g = Number(formGross) || 0;
                            const rate =
                              formPlatform === 'Zomato' ? 0.22 : 0.23;
                            setFormDeductions(String(Math.round(g * rate)));
                          }}
                          className="cursor-pointer text-[10px] font-medium text-[#10B981] hover:underline"
                        >
                          Auto {formPlatform === 'Zomato' ? '22%' : '23%'}
                        </button>
                      </div>
                      <input
                        id="agg-deductions"
                        type="number"
                        min={0}
                        required
                        value={formDeductions}
                        onChange={(e) => setFormDeductions(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 text-xs text-[#F4F4F5] tabular-nums focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#10B981]/25 bg-[#10B981]/8 px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#A1A1AA]">
                        Calculated Net Payout
                      </span>
                      <span
                        className={`text-base font-semibold tabular-nums ${
                          livePreviewNet >= 0
                            ? 'text-[#10B981]'
                            : 'text-rose-400'
                        }`}
                      >
                        {formatInr(livePreviewNet)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="agg-order-id"
                        className="block text-xs font-medium text-[#A1A1AA]"
                      >
                        Order / Batch ID (Opt.)
                      </label>
                      <input
                        id="agg-order-id"
                        type="text"
                        value={formOrderId}
                        onChange={(e) => setFormOrderId(e.target.value)}
                        placeholder="e.g. ZMT-98412"
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 font-mono text-xs text-[#F4F4F5] placeholder:text-[#A1A1AA]/50 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="agg-notes"
                        className="block text-xs font-medium text-[#A1A1AA]"
                      >
                        Notes (Optional)
                      </label>
                      <input
                        id="agg-notes"
                        type="text"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Weekend dinner rush"
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#18181D] px-3 text-xs text-[#F4F4F5] placeholder:text-[#A1A1AA]/50 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  {formError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-rose-500/30 bg-rose-500/12 px-3 py-2 text-xs text-rose-300"
                    >
                      {formError}
                    </p>
                  )}
                </form>
              </div>

              <div className="mt-6 flex items-center gap-2.5 border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="min-h-[42px] flex-1 cursor-pointer rounded-xl border border-white/[0.1] bg-[#18181D] px-4 text-xs font-medium text-[#F4F4F5] hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="aggregator-log-form"
                  disabled={isSavingForm}
                  className="inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#F4F4F5] px-4 text-xs font-semibold text-[#09090B] hover:bg-white disabled:opacity-60"
                >
                  {isSavingForm ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{editingEntry ? 'Save Changes' : 'Save Entry'}</span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dark Dropzone CSV Report Import Modal */}
      <AnimatePresence>
        {csvModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
            onClick={() => !isImportingCsv && setCsvModalOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Import Aggregator CSV Report"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-[#121216] p-6 text-[#F4F4F5] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#18181D] text-[#10B981]">
                    <FileSpreadsheet className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#F4F4F5]">
                      Import Zomato / Swiggy Partner CSV
                    </h3>
                    <p className="text-xs text-[#A1A1AA]">
                      Maps Date, Platform, Order_ID, Gross_Amount, Commission,
                      GST, Net_Payout, Status
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isImportingCsv}
                  onClick={() => setCsvModalOpen(false)}
                  aria-label="Close CSV modal"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.1] bg-[#18181D] text-[#A1A1AA] hover:text-[#F4F4F5] disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOverCsv(true);
                  }}
                  onDragLeave={() => setIsDragOverCsv(false)}
                  onDrop={handleCsvDrop}
                  className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                    isDragOverCsv
                      ? 'border-[#10B981] bg-[#10B981]/10'
                      : 'border-white/[0.14] bg-[#18181D]/60 hover:border-white/25'
                  }`}
                >
                  <Upload
                    className="h-5 w-5 text-[#A1A1AA]"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-xs font-medium text-[#F4F4F5]">
                    {csvFileName
                      ? `Loaded file: ${csvFileName}`
                      : 'Drag and drop partner settlement .csv file here'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#18181D] px-3 py-1.5 text-xs font-medium text-[#F4F4F5] hover:bg-white/[0.08]">
                      <span>Choose .CSV File</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCsvFileUpload}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setCsvRawText(SAMPLE_AGGREGATOR_CSV);
                        setCsvFileName('sample_partner_payouts.csv');
                        setCsvError(null);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-1.5 text-xs font-medium text-[#10B981] hover:bg-[#10B981]/20"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Load Sample Partner CSV</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={(e) => {
                    setCsvRawText(e.target.value);
                    setCsvFileName(null);
                    setCsvError(null);
                  }}
                  placeholder="Or paste CSV rows here (Date,Platform,Order_ID,Gross_Amount,Commission,GST,Net_Payout,Status)..."
                  className="w-full rounded-xl border border-white/[0.1] bg-[#09090B] p-3 font-mono text-xs text-[#F4F4F5] placeholder:text-[#A1A1AA]/50 focus:border-white/25 focus:outline-none"
                />

                {isImportingCsv ? (
                  <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#18181D] p-3.5">
                    <div className="flex items-center gap-2 text-xs text-[#10B981]">
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Reconciling settlements &amp; updating KPIs...</span>
                    </div>
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="h-7 animate-pulse rounded-lg bg-white/[0.06]"
                      />
                    ))}
                  </div>
                ) : (
                  csvPreview && (
                    <div className="rounded-xl border border-white/[0.08] bg-[#18181D] p-3.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#F4F4F5] tabular-nums">
                          Preview: {csvPreview.entries.length} valid partner
                          rows detected
                        </span>
                        {csvPreview.skippedRows > 0 && (
                          <span className="text-amber-300 tabular-nums">
                            {csvPreview.skippedRows} skipped
                          </span>
                        )}
                      </div>

                      {csvPreview.errors.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-rose-400">
                          {csvPreview.errors[0]}
                        </p>
                      )}

                      {csvPreview.entries.length > 0 && (
                        <div className="mt-2.5 max-h-40 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#09090B]">
                          <table className="w-full text-left text-[11px]">
                            <thead className="border-b border-white/[0.08] text-[#A1A1AA]">
                              <tr>
                                <th className="px-3 py-2">Platform</th>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Order / Qty</th>
                                <th className="px-3 py-2 text-right">Gross</th>
                                <th className="px-3 py-2 text-right">Net</th>
                                <th className="px-3 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06] text-[#F4F4F5]">
                              {csvPreview.entries
                                .slice(0, 6)
                                .map((row, idx) => (
                                  <tr
                                    key={`${row.platform}-${row.date}-${idx}`}
                                  >
                                    <td className="px-3 py-1.5 font-medium">
                                      {row.platform}
                                    </td>
                                    <td className="px-3 py-1.5 text-[#A1A1AA] tabular-nums">
                                      {row.date}
                                    </td>
                                    <td className="px-3 py-1.5 font-mono text-[#A1A1AA] tabular-nums">
                                      {row.orderId || `${row.orders} ord`}
                                    </td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">
                                      {formatInr(row.grossSalesInr)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-semibold text-[#10B981] tabular-nums">
                                      {formatInr(
                                        row.grossSalesInr - row.deductionsInr,
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 text-[#A1A1AA]">
                                      {row.settlementStatus ?? 'Settled'}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                )}

                {csvError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-rose-500/30 bg-rose-500/12 px-3 py-2 text-xs text-rose-300"
                  >
                    {csvError}
                  </p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  disabled={isImportingCsv}
                  onClick={() => setCsvModalOpen(false)}
                  className="min-h-[40px] cursor-pointer rounded-xl border border-white/[0.1] bg-[#18181D] px-4 text-xs font-medium text-[#F4F4F5] hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    !csvPreview ||
                    csvPreview.entries.length === 0 ||
                    isImportingCsv
                  }
                  onClick={handleConfirmCsvImport}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#F4F4F5] px-4 text-xs font-semibold text-[#09090B] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImportingCsv ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>
                    Import {csvPreview?.entries.length || 0} Rows
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
