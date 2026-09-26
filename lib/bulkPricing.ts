import { BulkPricingRule } from '@/types';

/**
 * Validates quantity-based discount rules.
 * Rules:
 * - Quantities must be positive integers (>= 1).
 * - Maximum Quantity must be >= Minimum Quantity.
 * - Discount percentage must be between 0% and 100%.
 * - Quantity ranges must not overlap.
 * - No duplicate/conflicting quantity ranges.
 */
export function validateBulkPricingRules(rules: BulkPricingRule[]): { valid: boolean; error?: string } {
  if (!rules || rules.length === 0) {
    return { valid: true };
  }

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];

    if (
      r.minQty === undefined ||
      r.minQty === null ||
      isNaN(r.minQty) ||
      r.minQty < 1 ||
      !Number.isInteger(Number(r.minQty))
    ) {
      return {
        valid: false,
        error: `Rule #${i + 1}: Minimum Quantity must be a valid positive integer (at least 1).`,
      };
    }

    if (
      r.maxQty === undefined ||
      r.maxQty === null ||
      isNaN(r.maxQty) ||
      r.maxQty < 1 ||
      !Number.isInteger(Number(r.maxQty))
    ) {
      return {
        valid: false,
        error: `Rule #${i + 1}: Maximum Quantity must be a valid positive integer (at least 1).`,
      };
    }

    if (Number(r.maxQty) < Number(r.minQty)) {
      return {
        valid: false,
        error: `Rule #${i + 1}: Maximum Quantity (${r.maxQty}) must be greater than or equal to Minimum Quantity (${r.minQty}).`,
      };
    }

    if (
      r.discountPercentage === undefined ||
      r.discountPercentage === null ||
      isNaN(r.discountPercentage) ||
      Number(r.discountPercentage) < 0 ||
      Number(r.discountPercentage) > 100
    ) {
      return {
        valid: false,
        error: `Rule #${i + 1}: Discount percentage must be between 0% and 100%.`,
      };
    }
  }

  // Check for overlapping ranges by sorting by minQty
  const sorted = [...rules].map((r, index) => ({
    ...r,
    minQty: Number(r.minQty),
    maxQty: Number(r.maxQty),
    originalIndex: index + 1,
  })).sort((a, b) => a.minQty - b.minQty);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.maxQty >= next.minQty) {
      return {
        valid: false,
        error: `Quantity range conflict: Range ${current.minQty}–${current.maxQty} (Rule #${current.originalIndex}) overlaps with range ${next.minQty}–${next.maxQty} (Rule #${next.originalIndex}). Quantity ranges must not overlap.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Finds the applicable bulk pricing rule for a given quantity.
 */
export function getBulkPricingRule(
  bulkPricing: BulkPricingRule[] | undefined,
  quantity: number
): BulkPricingRule | null {
  if (!bulkPricing || !Array.isArray(bulkPricing) || bulkPricing.length === 0 || quantity <= 0) {
    return null;
  }

  const match = bulkPricing.find(
    (rule) =>
      quantity >= Number(rule.minQty) &&
      quantity <= Number(rule.maxQty)
  );

  return match || null;
}

/**
 * @deprecated The old bulk pricing / bulk discount system has been retired in favor of
 * the dedicated Wholesale Account system. These stubs are retained for backwards compatibility.
 */

export interface BulkPriceCalculation {
  unitPrice: number;
  originalUnitPrice: number;
  discountPercentage: number;
  totalPrice: number;
  originalTotalPrice: number;
  savings: number;
  hasBulkDiscount: boolean;
  matchedRule: BulkPricingRule | null;
}

/**
 * @deprecated Legacy calculation - bulk pricing has been disabled. Returns standard retail/base price.
 */
export function calculateBulkPrice(
  basePrice: number,
  _bulkPricing: BulkPricingRule[] | undefined,
  quantity: number
): BulkPriceCalculation {
  const safeBasePrice = Math.max(0, Number(basePrice) || 0);
  const safeQuantity = Math.max(1, Math.round(Number(quantity) || 1));
  const totalPrice = safeBasePrice * safeQuantity;

  return {
    unitPrice: safeBasePrice,
    originalUnitPrice: safeBasePrice,
    discountPercentage: 0,
    totalPrice,
    originalTotalPrice: totalPrice,
    savings: 0,
    hasBulkDiscount: false,
    matchedRule: null,
  };
}

/**
 * @deprecated Legacy helper - returns 0 as bulk discounts are disabled.
 */
export function getMaxBulkDiscount(_bulkPricing: BulkPricingRule[] | undefined): number {
  return 0;
}
