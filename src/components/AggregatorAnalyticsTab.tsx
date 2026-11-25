import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  AggregatorAnalyticsEntry,
  AggregatorEntryInput,
  AggregatorPlatform,
} from '../types/restaurant';
import {
  dataService,
  SAMPLE_AGGREGATOR_CSV,
  UnauthorizedAggregatorError,
} from '../services/dataService';

type DateRangeFilter = '7D' | '30D' | 'Month' | 'All';

interface AggregatorAnalyticsTabProps {
  sessionToken: string;
  onUnauthorized: () => void;
  onShowToast: (title: string, description: string) => void;
}

interface DailyChartPoint {
  date: string;
  label: string;
  zomatoSales: number;
  swiggySales: number;
  zomatoOrders: number;
  swiggyOrders: number;
  netPayout: number;
}

const ZOMATO_COLOR = '#E23744';
const SWIGGY_COLOR = '#FC8019';

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
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

export function AggregatorAnalyticsTab({
  sessionToken,
  onUnauthorized,
  onShowToast,
}: AggregatorAnalyticsTabProps) {
  const [entries, setEntries] = useState<AggregatorAnalyticsEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('7D');
  const [tablePlatformFilter, setTablePlatformFilter] = useState<
    'All' | AggregatorPlatform
  >('All');

  // Interactive Chart Hover State
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  // Quick Log Drawer State (Create or Edit)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] =
    useState<AggregatorAnalyticsEntry | null>(null);
  const [formPlatform, setFormPlatform] =
    useState<AggregatorPlatform>('Zomato');
  const [formDate, setFormDate] = useState(getTodayIso);
  const [formOrders, setFormOrders] = useState('32');
  const [formGross, setFormGross] = useState('25600');
  const [formDeductions, setFormDeductions] = useState('5632');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);

  // CSV Import Modal State
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await dataService.listAggregatorEntries(sessionToken);
      setEntries(Array.isArray(list) ? list : []);
    } catch (error) {
      if (error instanceof UnauthorizedAggregatorError) {
        onUnauthorized();
        return;
      }
      setLoadError('Could not load Zomato & Swiggy analytics right now.');
      onShowToast(
        'Analytics Unavailable',
        'Could not load Zomato & Swiggy analytics data.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, onUnauthorized, onShowToast]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const { filteredEntries, previousWindowEntries } = useMemo(() => {
    if (entries.length === 0) {
      return {
        filteredEntries: [] as AggregatorAnalyticsEntry[],
        previousWindowEntries: [] as AggregatorAnalyticsEntry[],
      };
    }

    const validDatedEntries = entries.filter((item) =>
      /^\d{4}-\d{2}-\d{2}$/.test(item?.date || ''),
    );
    if (validDatedEntries.length === 0) {
      return {
        filteredEntries: entries,
        previousWindowEntries: [] as AggregatorAnalyticsEntry[],
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

    if (dateRange === 'All') {
      return {
        filteredEntries: entries,
        previousWindowEntries: [] as AggregatorAnalyticsEntry[],
      };
    }

    if (dateRange === 'Month') {
      const currentMonthPrefix = latestDateStr.slice(0, 7);
      const prevMonthDate = new Date(y, m - 2, 1);
      const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(
        prevMonthDate.getMonth() + 1,
      ).padStart(2, '0')}`;
      return {
        filteredEntries: entries.filter((e) =>
          e.date.startsWith(currentMonthPrefix),
        ),
        previousWindowEntries: entries.filter((e) =>
          e.date.startsWith(prevMonthPrefix),
        ),
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
    };
  }, [entries, dateRange]);

  const kpis = useMemo(() => {
    const summarize = (list: AggregatorAnalyticsEntry[]) => {
      let netPayout = 0;
      let totalOrders = 0;
      let zomatoSales = 0;
      let swiggySales = 0;
      let zomatoOrders = 0;
      let swiggyOrders = 0;
      let totalDeductions = 0;

      for (const item of list) {
        netPayout += item.netPayoutInr;
        totalOrders += item.orders;
        totalDeductions += item.deductionsInr;
        if (item.platform === 'Zomato') {
          zomatoSales += item.grossSalesInr;
          zomatoOrders += item.orders;
        } else {
          swiggySales += item.grossSalesInr;
          swiggyOrders += item.orders;
        }
      }
      return {
        netPayout,
        totalOrders,
        zomatoSales,
        swiggySales,
        zomatoOrders,
        swiggyOrders,
        totalDeductions,
      };
    };

    const curr = summarize(filteredEntries);
    const prev = summarize(previousWindowEntries);

    const totalGross = curr.zomatoSales + curr.swiggySales;
    const zomatoOrderPct =
      curr.totalOrders > 0 ? (curr.zomatoOrders / curr.totalOrders) * 100 : 50;
    const swiggyOrderPct =
      curr.totalOrders > 0 ? (curr.swiggyOrders / curr.totalOrders) * 100 : 50;

    return {
      ...curr,
      totalGross,
      zomatoOrderPct,
      swiggyOrderPct,
      netTrend: computeDeltaPercent(curr.netPayout, prev.netPayout),
      ordersTrend: computeDeltaPercent(curr.totalOrders, prev.totalOrders),
      zomatoTrend: computeDeltaPercent(curr.zomatoSales, prev.zomatoSales),
      swiggyTrend: computeDeltaPercent(curr.swiggySales, prev.swiggySales),
      avgOrderValue:
        curr.totalOrders > 0 ? Math.round(totalGross / curr.totalOrders) : 0,
    };
  }, [filteredEntries, previousWindowEntries]);

  const dailyChartData = useMemo<DailyChartPoint[]>(() => {
    const byDate = new Map<string, DailyChartPoint>();
    for (const item of filteredEntries) {
      const existing = byDate.get(item.date) || {
        date: item.date,
        label: formatShortDate(item.date),
        zomatoSales: 0,
        swiggySales: 0,
        zomatoOrders: 0,
        swiggyOrders: 0,
        netPayout: 0,
      };
      if (item.platform === 'Zomato') {
        existing.zomatoSales += item.grossSalesInr;
        existing.zomatoOrders += item.orders;
      } else {
        existing.swiggySales += item.grossSalesInr;
        existing.swiggyOrders += item.orders;
      }
      existing.netPayout += item.netPayoutInr;
      byDate.set(item.date, existing);
    }
    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [filteredEntries]);

  // SVG Chart Geometry
  const chartWidth = 680;
  const chartHeight = 240;
  const padLeft = 52;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 34;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  const { maxY, yTicks, zomatoCoords, swiggyCoords } = useMemo(() => {
    const highest = dailyChartData.reduce(
      (max, pt) => Math.max(max, pt.zomatoSales, pt.swiggySales),
      0,
    );
    const niceMax = Math.max(10000, Math.ceil((highest * 1.15) / 5000) * 5000);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: Math.round(niceMax * ratio),
      y: padTop + plotHeight - ratio * plotHeight,
    }));

    const count = dailyChartData.length;
    const zPts = dailyChartData.map((pt, i) => ({
      x:
        count <= 1
          ? padLeft + plotWidth / 2
          : padLeft + (i / (count - 1)) * plotWidth,
      y: padTop + plotHeight - (pt.zomatoSales / niceMax) * plotHeight,
    }));
    const sPts = dailyChartData.map((pt, i) => ({
      x:
        count <= 1
          ? padLeft + plotWidth / 2
          : padLeft + (i / (count - 1)) * plotWidth,
      y: padTop + plotHeight - (pt.swiggySales / niceMax) * plotHeight,
    }));

    return {
      maxY: niceMax,
      yTicks: ticks,
      zomatoCoords: zPts,
      swiggyCoords: sPts,
    };
  }, [dailyChartData, plotHeight, plotWidth]);

  const csvPreview = useMemo(
    () => (csvRawText.trim() ? dataService.parseCsv(csvRawText) : null),
    [csvRawText],
  );

  const visibleTableEntries = useMemo(() => {
    return filteredEntries.filter((e) =>
      tablePlatformFilter === 'All' ? true : e.platform === tablePlatformFilter,
    );
  }, [filteredEntries, tablePlatformFilter]);

  const openCreateDrawer = () => {
    setEditingEntry(null);
    setFormPlatform('Zomato');
    setFormDate(getTodayIso());
    setFormOrders('32');
    setFormGross('25600');
    setFormDeductions('5632');
    setFormNotes('');
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (entry: AggregatorAnalyticsEntry) => {
    setEditingEntry(entry);
    setFormPlatform(entry.platform);
    setFormDate(entry.date);
    setFormOrders(String(entry.orders));
    setFormGross(String(entry.grossSalesInr));
    setFormDeductions(String(entry.deductionsInr));
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
    const grossNum = Number(formGross);
    const dedNum = Number(formDeductions || 0);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(formDate) ||
      !Number.isFinite(ordersNum) ||
      ordersNum < 0 ||
      !Number.isFinite(grossNum) ||
      grossNum < 0 ||
      !Number.isFinite(dedNum) ||
      dedNum < 0
    ) {
      setFormError('Please enter valid date, orders, gross sales, and deductions.');
      return;
    }

    const payload: AggregatorEntryInput = {
      platform: formPlatform,
      date: formDate,
      orders: Math.round(ordersNum),
      grossSalesInr: Math.round(grossNum),
      deductionsInr: Math.round(dedNum),
      source: editingEntry ? editingEntry.source : 'Manual',
      notes: formNotes.trim() || undefined,
    };

    setIsSavingForm(true);
    try {
      if (editingEntry) {
        const updated = await dataService.updateAggregatorEntry(
          sessionToken,
          editingEntry.id,
          payload,
        );
        setEntries((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => b.date.localeCompare(a.date)),
        );
        onShowToast('Entry Updated', `${updated.platform} · ${formatShortDate(updated.date)} saved.`);
      } else {
        const created = await dataService.createAggregatorEntry(
          sessionToken,
          payload,
        );
        setEntries((prev) =>
          [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
        );
        onShowToast('Entry Logged', `${created.platform} · ${formatInr(created.netPayoutInr)} net payout added.`);
      }
      setDrawerOpen(false);
    } catch (error) {
      if (error instanceof UnauthorizedAggregatorError) {
        onUnauthorized();
        return;
      }
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
      await dataService.deleteAggregatorEntry(sessionToken, entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setConfirmDeleteId((prev) => (prev === entry.id ? null : prev));
      onShowToast('Entry Deleted', `Removed ${entry.platform} log for ${formatShortDate(entry.date)}.`);
    } catch (error) {
      if (error instanceof UnauthorizedAggregatorError) {
        onUnauthorized();
        return;
      }
      onShowToast('Delete Failed', 'Could not remove analytics entry.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvRawText(typeof reader.result === 'string' ? reader.result : '');
      setCsvError(null);
    };
    reader.onerror = () => {
      setCsvError('Unable to read the selected CSV file.');
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = async () => {
    if (!csvPreview || csvPreview.entries.length === 0 || isImportingCsv) return;
    setIsImportingCsv(true);
    setCsvError(null);
    try {
      const imported = await dataService.importAggregatorEntries(
        sessionToken,
        csvPreview.entries,
      );
      setEntries((prev) =>
        [...imported, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
      );
      setCsvModalOpen(false);
      setCsvRawText('');
      onShowToast(
        'CSV Imported',
        `Imported ${imported.length} aggregator settlement rows.`,
      );
    } catch (error) {
      if (error instanceof UnauthorizedAggregatorError) {
        onUnauthorized();
        return;
      }
      setCsvError(
        error instanceof Error ? error.message : 'Failed to import CSV rows.',
      );
    } finally {
      setIsImportingCsv(false);
    }
  };

  // Donut Ring Geometry
  const donutSize = 168;
  const donutStroke = 14;
  const donutRadius = (donutSize - donutStroke) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const zomatoArcLength = (kpis.zomatoOrderPct / 100) * donutCircumference;
  const swiggyArcLength = Math.max(0, donutCircumference - zomatoArcLength);

  const renderTrendBadge = (delta: number | null) => {
    if (delta === null) {
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          Baseline
        </span>
      );
    }
    const positive = delta >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
          positive
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-rose-50 text-rose-700'
        }`}
      >
        {positive ? (
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
        )}
        {Math.abs(delta)}%
      </span>
    );
  };

  const activeHoverPoint =
    hoveredIdx !== null && dailyChartData[hoveredIdx]
      ? dailyChartData[hoveredIdx]
      : null;

  return (
    <section
      aria-label="Zomato and Swiggy Order Tracking and Analytics"
      className="mt-6 rounded-3xl border border-slate-200/90 bg-[#F8FAFC] p-5 text-slate-900 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.45)] sm:p-8"
    >
      {/* Executive Header & Action Bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500">
            Delivery Partner Intelligence
          </p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Zomato &amp; Swiggy Analytics
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pill Date Filter */}
          <div
            role="group"
            aria-label="Analytics date window"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-2xs"
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
                  }}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt}
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
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Log Orders</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="cursor-pointer rounded-lg border border-rose-300 bg-white px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && entries.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-slate-700" aria-hidden="true" />
          <span>Loading partner revenue metrics...</span>
        </div>
      ) : (
        <>
          {/* 4 Refined Minimal KPI Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Net Payout (₹)
                </span>
                {renderTrendBadge(kpis.netTrend)}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-3xl">
                {formatInr(kpis.netPayout)}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                After {formatInr(kpis.totalDeductions)} platform deductions
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Total Orders
                </span>
                {renderTrendBadge(kpis.ordersTrend)}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-3xl">
                {kpis.totalOrders.toLocaleString('en-IN')}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                Avg order value {formatInr(kpis.avgOrderValue)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ZOMATO_COLOR }}
                  />
                  Zomato Sales (₹)
                </span>
                {renderTrendBadge(kpis.zomatoTrend)}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-3xl">
                {formatInr(kpis.zomatoSales)}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {kpis.zomatoOrders.toLocaleString('en-IN')} orders ·{' '}
                {kpis.totalGross > 0
                  ? Math.round((kpis.zomatoSales / kpis.totalGross) * 100)
                  : 0}
                % gross share
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SWIGGY_COLOR }}
                  />
                  Swiggy Sales (₹)
                </span>
                {renderTrendBadge(kpis.swiggyTrend)}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-3xl">
                {formatInr(kpis.swiggySales)}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {kpis.swiggyOrders.toLocaleString('en-IN')} orders ·{' '}
                {kpis.totalGross > 0
                  ? Math.round((kpis.swiggySales / kpis.totalGross) * 100)
                  : 0}
                % gross share
              </p>
            </div>
          </div>

          {/* Minimalist Visualizations Grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Revenue Trend Area Chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Zomato vs. Swiggy Revenue Trend
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Daily gross sales comparison (₹ INR)
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
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

              <div
                ref={chartContainerRef}
                className="relative mt-5 w-full select-none"
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {dailyChartData.length === 0 ? (
                  <div className="flex h-[240px] items-center justify-center text-xs text-slate-400">
                    No entries in selected date range.
                  </div>
                ) : (
                  <>
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="h-[240px] w-full overflow-visible"
                      role="img"
                      aria-label="Zomato versus Swiggy revenue trend area chart"
                    >
                      <defs>
                        <linearGradient
                          id="zomatoAreaGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={ZOMATO_COLOR}
                            stopOpacity="0.16"
                          />
                          <stop
                            offset="100%"
                            stopColor={ZOMATO_COLOR}
                            stopOpacity="0.0"
                          />
                        </linearGradient>
                        <linearGradient
                          id="swiggyAreaGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={SWIGGY_COLOR}
                            stopOpacity="0.14"
                          />
                          <stop
                            offset="100%"
                            stopColor={SWIGGY_COLOR}
                            stopOpacity="0.0"
                          />
                        </linearGradient>
                      </defs>

                      {/* Faint Horizontal Dashed Gridlines Only */}
                      {yTicks.map((tick) => (
                        <g key={tick.value}>
                          <line
                            x1={padLeft}
                            y1={tick.y}
                            x2={chartWidth - padRight}
                            y2={tick.y}
                            stroke="#E2E8F0"
                            strokeWidth="1"
                            strokeDasharray="3 4"
                          />
                          <text
                            x={padLeft - 10}
                            y={tick.y + 3.5}
                            textAnchor="end"
                            fill="#94A3B8"
                            fontSize="10.5"
                            className="tabular-nums"
                          >
                            {tick.value === 0
                              ? '₹0'
                              : `₹${Math.round(tick.value / 1000)}k`}
                          </text>
                        </g>
                      ))}

                      {/* Area Fills */}
                      <path
                        d={buildAreaSvgPath(
                          swiggyCoords,
                          padTop + plotHeight,
                        )}
                        fill="url(#swiggyAreaGrad)"
                      />
                      <path
                        d={buildAreaSvgPath(
                          zomatoCoords,
                          padTop + plotHeight,
                        )}
                        fill="url(#zomatoAreaGrad)"
                      />

                      {/* Smooth Splines */}
                      <path
                        d={buildSmoothSvgPath(swiggyCoords)}
                        fill="none"
                        stroke={SWIGGY_COLOR}
                        strokeWidth="2.25"
                        strokeLinecap="round"
                      />
                      <path
                        d={buildSmoothSvgPath(zomatoCoords)}
                        fill="none"
                        stroke={ZOMATO_COLOR}
                        strokeWidth="2.25"
                        strokeLinecap="round"
                      />

                      {/* Hover Hairline + Active Nodes */}
                      {hoveredIdx !== null && zomatoCoords[hoveredIdx] && (
                        <>
                          <line
                            x1={zomatoCoords[hoveredIdx].x}
                            y1={padTop}
                            x2={zomatoCoords[hoveredIdx].x}
                            y2={padTop + plotHeight}
                            stroke="#CBD5E1"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={zomatoCoords[hoveredIdx].x}
                            cy={zomatoCoords[hoveredIdx].y}
                            r="4.5"
                            fill={ZOMATO_COLOR}
                            stroke="#FFFFFF"
                            strokeWidth="2"
                          />
                          <circle
                            cx={swiggyCoords[hoveredIdx].x}
                            cy={swiggyCoords[hoveredIdx].y}
                            r="4.5"
                            fill={SWIGGY_COLOR}
                            stroke="#FFFFFF"
                            strokeWidth="2"
                          />
                        </>
                      )}

                      {/* Sparse Clean Date Labels */}
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
                            fill="#94A3B8"
                            fontSize="10.5"
                          >
                            {pt.label}
                          </text>
                        );
                      })}

                      {/* Invisible Hover Columns for Crisp Tooltip Tracking */}
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

                    {/* Floating Glassmorphic Hover Tooltip */}
                    <AnimatePresence>
                      {activeHoverPoint && hoveredIdx !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.14 }}
                          style={{
                            left: `${Math.min(
                              58,
                              Math.max(
                                2,
                                ((zomatoCoords[hoveredIdx]?.x ?? padLeft) /
                                  chartWidth) *
                                  100 -
                                  12,
                              ),
                            )}%`,
                          }}
                          className="pointer-events-none absolute top-2 z-10 w-52 max-w-[calc(100%-1rem)] rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-md"
                        >
                          <p className="text-[11px] font-semibold text-slate-900">
                            {activeHoverPoint.label} · {activeHoverPoint.date}
                          </p>
                          <div className="mt-2 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-slate-600">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: ZOMATO_COLOR }}
                                />
                                Zomato ({activeHoverPoint.zomatoOrders})
                              </span>
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {formatInr(activeHoverPoint.zomatoSales)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-slate-600">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: SWIGGY_COLOR }}
                                />
                                Swiggy ({activeHoverPoint.swiggyOrders})
                              </span>
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {formatInr(activeHoverPoint.swiggySales)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                              <span className="text-[11px] text-slate-500">
                                Net Payout
                              </span>
                              <span className="font-semibold text-emerald-700 tabular-nums">
                                {formatInr(activeHoverPoint.netPayout)}
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

            {/* Sleek Order Split Donut Ring */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Order Split Ring
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Order volume distribution by platform
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
                      stroke="#F1F5F9"
                      strokeWidth={donutStroke}
                    />
                    {/* Swiggy Arc */}
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke={SWIGGY_COLOR}
                      strokeWidth={donutStroke}
                      strokeDasharray={`${swiggyArcLength} ${donutCircumference}`}
                      strokeDashoffset={-zomatoArcLength}
                      strokeLinecap="butt"
                    />
                    {/* Zomato Arc */}
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke={ZOMATO_COLOR}
                      strokeWidth={donutStroke}
                      strokeDasharray={`${zomatoArcLength} ${donutCircumference}`}
                      strokeDashoffset={0}
                      strokeLinecap="butt"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-medium text-slate-400">
                      Total Orders
                    </span>
                    <span className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {kpis.totalOrders.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ZOMATO_COLOR }}
                    />
                    <span>Zomato</span>
                  </div>
                  <p className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                    {kpis.zomatoOrderPct.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {kpis.zomatoOrders} orders
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: SWIGGY_COLOR }}
                    />
                    <span>Swiggy</span>
                  </div>
                  <p className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                    {kpis.swiggyOrderPct.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {kpis.swiggyOrders} orders
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Minimal Spacious Entries Table */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Daily Settlement Ledger
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {visibleTableEntries.length} logged partner summaries
                </p>
              </div>

              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                {(['All', 'Zomato', 'Swiggy'] as const).map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setTablePlatformFilter(plat)}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      tablePlatformFilter === plat
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            {visibleTableEntries.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No entries recorded for this filter. Click{' '}
                <span className="font-semibold text-slate-800">+ Log Orders</span>{' '}
                or{' '}
                <span className="font-semibold text-slate-800">Import CSV</span>{' '}
                to add partner settlements.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 pr-4 pl-6">Date</th>
                      <th className="px-4 py-3.5">Platform</th>
                      <th className="px-4 py-3.5 text-right">Orders</th>
                      <th className="px-4 py-3.5 text-right">Gross Sales</th>
                      <th className="px-4 py-3.5 text-right">Deductions</th>
                      <th className="px-4 py-3.5 text-right">Net Payout</th>
                      <th className="px-4 py-3.5">Source</th>
                      <th className="py-3.5 pr-6 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {visibleTableEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="py-3.5 pr-4 pl-6 font-medium text-slate-900 tabular-nums">
                          {formatShortDate(entry.date)}
                          <span className="ml-2 text-[11px] font-normal text-slate-400">
                            {entry.date}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              entry.platform === 'Zomato'
                                ? 'bg-[#E23744]/10 text-[#C81E2B]'
                                : 'bg-[#FC8019]/12 text-[#C25400]'
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
                        <td className="px-4 py-3.5 text-right font-medium text-slate-900 tabular-nums">
                          {entry.orders}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          {formatInr(entry.grossSalesInr)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-500 tabular-nums">
                          -{formatInr(entry.deductionsInr)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-700 tabular-nums">
                          {formatInr(entry.netPayoutInr)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {entry.source}
                        </td>
                        <td className="py-3.5 pr-6 pl-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {confirmDeleteId === entry.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={deletingId === entry.id}
                                  onClick={() => void handleDeleteEntry(entry)}
                                  className="cursor-pointer rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {deletingId === entry.id ? 'Removing...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === entry.id}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
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
                                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingId === entry.id}
                                  onClick={() => setConfirmDeleteId(entry.id)}
                                  aria-label={`Delete ${entry.platform} entry on ${entry.date}`}
                                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Quick Log Slide-Over Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs"
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
              className="ml-auto flex h-full w-full max-w-md flex-col justify-between bg-white p-6 text-slate-900 shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Aggregator Ledger
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {editingEntry ? 'Edit Settlement Log' : 'Log Partner Orders'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close drawer"
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
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
                    <span className="block text-xs font-medium text-slate-600">
                      Platform
                    </span>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                      {(['Zomato', 'Swiggy'] as AggregatorPlatform[]).map(
                        (plat) => (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => setFormPlatform(plat)}
                            className={`flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all ${
                              formPlatform === plat
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
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
                        className="block text-xs font-medium text-slate-600"
                      >
                        Settlement Date
                      </label>
                      <input
                        id="agg-date"
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="agg-orders"
                        className="block text-xs font-medium text-slate-600"
                      >
                        Orders Count
                      </label>
                      <input
                        id="agg-orders"
                        type="number"
                        min={0}
                        required
                        value={formOrders}
                        onChange={(e) => setFormOrders(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="agg-gross"
                        className="block text-xs font-medium text-slate-600"
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
                        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="agg-deductions"
                        className="block text-xs font-medium text-slate-600"
                      >
                        Deductions (₹)
                      </label>
                      <input
                        id="agg-deductions"
                        type="number"
                        min={0}
                        required
                        value={formDeductions}
                        onChange={(e) => setFormDeductions(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500">
                        Calculated Net Payout
                      </span>
                      <span
                        className={`text-base font-semibold tabular-nums ${
                          livePreviewNet >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {formatInr(livePreviewNet)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="agg-notes"
                      className="block text-xs font-medium text-slate-600"
                    >
                      Notes (Optional)
                    </label>
                    <input
                      id="agg-notes"
                      type="text"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="e.g. Weekend dinner promo"
                      className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  {formError && (
                    <p
                      role="alert"
                      className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
                    >
                      {formError}
                    </p>
                  )}
                </form>
              </div>

              <div className="flex items-center gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="min-h-[42px] flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="aggregator-log-form"
                  disabled={isSavingForm}
                  className="inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingForm ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
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

      {/* CSV Report Import Modal */}
      <AnimatePresence>
        {csvModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
            onClick={() => setCsvModalOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Import Aggregator CSV Report"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet
                    className="h-5 w-5 text-slate-700"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Import Zomato / Swiggy CSV Report
                    </h3>
                    <p className="text-xs text-slate-500">
                      Columns: Platform, Date, Orders, Gross Sales, Deductions, Notes
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(false)}
                  aria-label="Close CSV modal"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
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
                      setCsvError(null);
                    }}
                    className="cursor-pointer text-xs font-medium text-slate-600 underline hover:text-slate-900"
                  >
                    Load Sample CSV
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={(e) => {
                    setCsvRawText(e.target.value);
                    setCsvError(null);
                  }}
                  placeholder="Paste CSV text here or upload a .csv file above..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
                />

                {csvPreview && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        Preview: {csvPreview.entries.length} valid rows detected
                      </span>
                      {csvPreview.skippedRows > 0 && (
                        <span className="text-amber-700">
                          {csvPreview.skippedRows} skipped
                        </span>
                      )}
                    </div>

                    {csvPreview.errors.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-rose-600">
                        {csvPreview.errors[0]}
                      </p>
                    )}

                    {csvPreview.entries.length > 0 && (
                      <div className="mt-2.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left text-[11px]">
                          <thead className="border-b border-slate-100 text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Platform</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2 text-right">Orders</th>
                              <th className="px-3 py-2 text-right">Gross</th>
                              <th className="px-3 py-2 text-right">Net</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {csvPreview.entries.slice(0, 6).map((row, idx) => (
                              <tr key={`${row.platform}-${row.date}-${idx}`}>
                                <td className="px-3 py-1.5 font-medium">
                                  {row.platform}
                                </td>
                                <td className="px-3 py-1.5 tabular-nums">
                                  {row.date}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {row.orders}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {formatInr(row.grossSalesInr)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 tabular-nums">
                                  {formatInr(
                                    row.grossSalesInr - row.deductionsInr,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {csvError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
                  >
                    {csvError}
                  </p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(false)}
                  className="min-h-[40px] cursor-pointer rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImportingCsv ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
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
