import { Injectable } from '@nestjs/common';

export interface PricingInput {
  monthlyFixed: number;
  perWorkCenter: number;
  perWorker: number;
  workCenters: number;
  workers: number;
  /** Discount percent applied to the gross subtotal (0–100). */
  discountPct?: number;
  /** VAT percent applied after discount (0–100). */
  vatPct?: number;
  /** If set, every component is multiplied by (proratedDays / daysInMonth). */
  proratedDays?: number;
  daysInMonth?: number;
}

export interface PricingBreakdown {
  fixedAmount: number;
  workcenterAmount: number;
  workerAmount: number;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  discountedSubtotal: number;
  vatPct: number;
  vatAmount: number;
  total: number;
  isProrated: boolean;
  prorationFactor: number;
}

/**
 * Pure-math billing calculator. No DB writes, no side effects.
 * Used by the create-invoice flow and by the live preview.
 */
@Injectable()
export class PricingService {
  calculate(input: PricingInput): PricingBreakdown {
    const discountPct = clamp(input.discountPct ?? 0, 0, 100);
    const vatPct = clamp(input.vatPct ?? 0, 0, 100);

    const isProrated =
      typeof input.proratedDays === 'number' &&
      typeof input.daysInMonth === 'number' &&
      input.daysInMonth > 0 &&
      input.proratedDays !== input.daysInMonth;

    const prorationFactor = isProrated
      ? (input.proratedDays as number) / (input.daysInMonth as number)
      : 1;

    const fixedAmount = round2(num(input.monthlyFixed) * prorationFactor);
    const workcenterAmount = round2(
      num(input.perWorkCenter) * num(input.workCenters) * prorationFactor,
    );
    const workerAmount = round2(
      num(input.perWorker) * num(input.workers) * prorationFactor,
    );

    const subtotal = round2(fixedAmount + workcenterAmount + workerAmount);
    const discountAmount = round2((subtotal * discountPct) / 100);
    const discountedSubtotal = round2(subtotal - discountAmount);
    const vatAmount = round2((discountedSubtotal * vatPct) / 100);
    const total = round2(discountedSubtotal + vatAmount);

    return {
      fixedAmount,
      workcenterAmount,
      workerAmount,
      subtotal,
      discountPct,
      discountAmount,
      discountedSubtotal,
      vatPct,
      vatAmount,
      total,
      isProrated,
      prorationFactor,
    };
  }
}

function num(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function round2(v: number): number {
  // Round half up to 2 decimals.
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
