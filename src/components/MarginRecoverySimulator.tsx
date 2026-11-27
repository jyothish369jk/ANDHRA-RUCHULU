import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { AggregatorAnalyticsEntry } from '../types/restaurant';

interface MarginRecoverySimulatorProps {
  thirtyDayEntries: AggregatorAnalyticsEntry[];
  activeWindowEntries: AggregatorAnalyticsEntry[];
  activeRangeLabel: string;
  onShowToast: (title: string, description: string) => void;
}

const DIRECT_CUSTOMER_PERK_RATE = 0.05;

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function MarginRecoverySimulator({
  thirtyDayEntries,
  activeWindowEntries,
  activeRangeLabel,
  onShowToast,
}: MarginRecoverySimulatorProps) {
  const [shiftPct, setShiftPct] = useState<number>(20);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const sourceEntries =
    activeWindowEntries.length > 0 ? activeWindowEntries : thirtyDayEntries;

  const metrics = useMemo(() => {
    let grossSales = 0;
    let deductions = 0;
    let orders = 0;
    const uniqueDates = new Set<string>();

    for (const entry of sourceEntries) {
      grossSales += entry.grossSalesInr;
      deductions += entry.deductionsInr;
      orders += entry.orders;
      if (entry.date) uniqueDates.add(entry.date);
    }

    const daySpan = Math.max(1, uniqueDates.size || 30);
    const monthlyScale = 30 / daySpan;
    const monthlyGross = grossSales * monthlyScale;

    const feeRate = grossSales > 0 ? deductions / grossSales : 0;
    const feeRatePct = feeRate * 100;
    const retainedPct = Math.max(0, 100 - feeRatePct);

    const shiftedMonthlyGross = monthlyGross * (shiftPct / 100);
    const netSpreadRate = Math.max(0, feeRate - DIRECT_CUSTOMER_PERK_RATE);
    const extraNetProfitPerMonth = Math.max(
      0,
      Math.round(shiftedMonthlyGross * netSpreadRate),
    );
    const annualSavings = extraNetProfitPerMonth * 12;
    const shiftedMonthlyOrders = Math.round(
      orders * monthlyScale * (shiftPct / 100),
    );

    return {
      grossSales,
      deductions,
      feeRatePct,
      retainedPct,
      extraNetProfitPerMonth,
      annualSavings,
      shiftedMonthlyOrders,
      daySpan,
    };
  }, [shiftPct, sourceEntries]);

  const handleCopySummary = async () => {
    const summary = [
      `Andhra Ruchulu — Margin Recovery Summary (${activeRangeLabel})`,
      `• Gross Sales: ${formatInr(metrics.grossSales)} (${metrics.daySpan}d)`,
      `• Platform Deductions: -${formatInr(metrics.deductions)} (${metrics.feeRatePct.toFixed(1)}% effective fee rate)`,
      `• Direct Pickup Shift Target: ${shiftPct}% of repeat orders (5% customer perk)`,
      `• Extra Net Profit / Month: +${formatInr(metrics.extraNetProfitPerMonth)} (~${metrics.shiftedMonthlyOrders} orders/mo)`,
      `• Annual Savings: +${formatInr(metrics.annualSavings)}/yr`,
    ].join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summary);
      } else {
        const helper = document.createElement('textarea');
        helper.value = summary;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
      }
      setCopiedSummary(true);
      onShowToast(
        'Summary Copied',
        `Annual savings of +${formatInr(metrics.annualSavings)}/yr copied to clipboard.`,
      );
      window.setTimeout(() => setCopiedSummary(false), 2400);
    } catch {
      onShowToast('Copy Failed', 'Could not access clipboard.');
    }
  };

  const sliderProgress = `${((shiftPct - 5) / 40) * 100}%`;

  return (
    <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#121216] p-5 sm:p-6">
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Left Side: 3 Clean Numbers + Thin Progress Bar */}
        <div className="lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F4F4F5]">
              Commission Leakage &amp; Recovery Simulator
            </h3>
            <span className="text-[11px] font-medium text-[#A1A1AA]">
              {activeRangeLabel} Totals
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-[#A1A1AA]">Gross Sales</p>
              <p className="mt-1 text-base font-semibold text-[#F4F4F5] tabular-nums sm:text-lg">
                {formatInr(metrics.grossSales)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-[#A1A1AA]">Platform Deductions</p>
              <p className="mt-1 text-base font-semibold text-[#F4F4F5] tabular-nums sm:text-lg">
                -{formatInr(metrics.deductions)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-[#A1A1AA]">Effective Fee Rate</p>
              <p className="mt-1 text-base font-semibold text-[#F4F4F5] tabular-nums sm:text-lg">
                {metrics.feeRatePct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Thin Horizontal Progress Bar */}
          <div className="mt-4">
            <div
              className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
              role="img"
              aria-label={`${metrics.retainedPct.toFixed(1)}% net retained versus ${metrics.feeRatePct.toFixed(1)}% aggregator deductions`}
            >
              <div
                style={{ width: `${metrics.retainedPct}%` }}
                className="bg-[#10B981] transition-all duration-250"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#A1A1AA] tabular-nums">
              <span>{metrics.retainedPct.toFixed(1)}% Retained</span>
              <span>{metrics.feeRatePct.toFixed(1)}% Fee Leakage</span>
            </div>
          </div>
        </div>

        {/* Right Side: Single Interactive Slider + Live Emerald Output */}
        <div className="border-t border-white/[0.08] pt-5 lg:col-span-7 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor="compact-shift-slider"
                  className="text-xs font-medium text-[#F4F4F5]"
                >
                  Shift Repeat Orders to Direct Pickup
                </label>
                <span className="rounded-lg border border-white/[0.08] bg-[#09090B] px-2.5 py-0.5 text-sm font-semibold text-[#10B981] tabular-nums">
                  {shiftPct}%
                </span>
              </div>

              <div className="mt-3">
                <input
                  id="compact-shift-slider"
                  type="range"
                  min={5}
                  max={45}
                  step={1}
                  value={shiftPct}
                  onChange={(e) => setShiftPct(Number(e.target.value))}
                  style={
                    {
                      '--range-progress': sliderProgress,
                      '--range-accent': '#10B981',
                      '--range-glow': 'rgba(16, 185, 129, 0.4)',
                    } as React.CSSProperties
                  }
                  className="luxury-range"
                />
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#A1A1AA] tabular-nums">
                  <span>5%</span>
                  <span>Assumes 5% direct pickup perk</span>
                  <span>45%</span>
                </div>
              </div>
            </div>

            {/* Live Emerald Profit Results + Copy Button */}
            <div className="flex flex-wrap items-center justify-between gap-5 sm:justify-end">
              <div className="flex items-center gap-5">
                <div>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Extra Net Profit / Mo
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-[#10B981] tabular-nums sm:text-xl">
                    +{formatInr(metrics.extraNetProfitPerMonth)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-[#A1A1AA]">Annual Savings</p>
                  <p className="mt-0.5 text-lg font-semibold text-[#10B981] tabular-nums sm:text-xl">
                    +{formatInr(metrics.annualSavings)}/yr
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleCopySummary()}
                className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-250 ${
                  copiedSummary
                    ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]'
                    : 'border-white/[0.1] bg-[#09090B] text-[#F4F4F5] hover:border-white/25'
                }`}
              >
                {copiedSummary ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#A1A1AA]" aria-hidden="true" />
                )}
                <span>
                  {copiedSummary ? 'Copied' : 'Copy Owner Summary'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
