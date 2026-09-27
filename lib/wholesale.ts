import { Product, ProductModelVariant } from '@/types';
import { Customer, CustomerType } from '@/types/admin';

/**
 * Determines whether a given customer record or session object has active WHOLESALE authorization.
 */
export function isWholesaleCustomer(
  customer?: { customerType?: CustomerType | string; status?: string } | null
): boolean {
  if (!customer) return false;
  return customer.customerType === 'WHOLESALE' && customer.status !== 'inactive' && customer.status !== 'deactivated';
}

/**
 * Determines whether a given customer record or session object has active SUPER_WHOLESALE authorization.
 */
export function isSuperWholesaleCustomer(
  customer?: { customerType?: CustomerType | string; status?: string } | null
): boolean {
  if (!customer) return false;
  return customer.customerType === 'SUPER_WHOLESALE' && customer.status !== 'inactive' && customer.status !== 'deactivated';
}

/**
 * Determines whether a customer is in any wholesale tier (WHOLESALE or SUPER_WHOLESALE).
 */
export function isAnyWholesaleCustomer(
  customer?: { customerType?: CustomerType | string; status?: string } | null
): boolean {
  return isWholesaleCustomer(customer) || isSuperWholesaleCustomer(customer);
}

/**
 * Calculates the exact price applicable for an item according to the authenticated customer type.
 * Server and client both use this central logic.
 *
 * Rules:
 * 1. For authenticated SUPER_WHOLESALE customers:
 *    - If product has configured superWholesalePrice (> 0), use that.
 *    - Fallback: If not configured, use wholesalePrice (> 0) to ensure protected wholesale rate.
 *    - Fallback: If neither configured, safe fallback to standard retail product.price.
 * 2. For authenticated WHOLESALE customers:
 *    - If product has configured wholesalePrice (> 0), use that.
 *    - Fallback: standard retail product.price.
 * 3. For standard RETAIL customers or guests:
 *    - Always use the standard retail product.price.
 */
export function resolveCustomerTier(
  customerOrTier?: { customerType?: CustomerType | string } | CustomerType | string | null
): string | undefined {
  if (!customerOrTier) return undefined;
  if (typeof customerOrTier === 'object' && customerOrTier !== null && 'customerType' in customerOrTier) {
    return customerOrTier.customerType;
  }
  if (typeof customerOrTier === 'string') {
    return customerOrTier;
  }
  return undefined;
}

/**
 * Calculates the exact price applicable for an item according to the authenticated customer type.
 * Server and client both use this central logic.
 *
 * Rules:
 * 1. For authenticated SUPER_WHOLESALE customers:
 *    - If product has configured superWholesalePrice (> 0), use that.
 *    - Fallback: If not configured, use wholesalePrice (> 0) to ensure protected wholesale rate.
 *    - Fallback: If neither configured, safe fallback to standard retail product.price.
 * 2. For authenticated WHOLESALE customers:
 *    - If product has configured wholesalePrice (> 0), use that.
 *    - Fallback: standard retail product.price.
 * 3. For standard RETAIL customers or guests:
 *    - Always use the standard retail product.price.
 */
export function getProductEffectivePrice(
  product: Product,
  customerOrTier?: { customerType?: CustomerType | string } | CustomerType | string | null
): number {
  if (!product) return 0;
  const tier = resolveCustomerTier(customerOrTier);
  const isSuperWholesale = tier === 'SUPER_WHOLESALE';
  const isWholesale = tier === 'WHOLESALE';

  if (isSuperWholesale) {
    if (
      product.superWholesalePrice !== undefined &&
      product.superWholesalePrice !== null &&
      !isNaN(Number(product.superWholesalePrice)) &&
      Number(product.superWholesalePrice) > 0
    ) {
      return Number(product.superWholesalePrice);
    }
    // Safe fallback to wholesale price if super wholesale not configured
    if (
      product.wholesalePrice !== undefined &&
      product.wholesalePrice !== null &&
      !isNaN(Number(product.wholesalePrice)) &&
      Number(product.wholesalePrice) > 0
    ) {
      return Number(product.wholesalePrice);
    }
    return Number(product.price) || 0;
  }

  if (isWholesale) {
    if (
      product.wholesalePrice !== undefined &&
      product.wholesalePrice !== null &&
      !isNaN(Number(product.wholesalePrice)) &&
      Number(product.wholesalePrice) > 0
    ) {
      return Number(product.wholesalePrice);
    }
    return Number(product.price) || 0;
  }

  return Number(product.price) || 0;
}

/**
 * Calculates the exact price applicable for a model variant according to the authenticated customer type.
 */
export function getModelEffectivePrice(
  product: Product,
  model: ProductModelVariant,
  customerOrTier?: { customerType?: CustomerType | string } | CustomerType | string | null
): number {
  if (!model) return getProductEffectivePrice(product, customerOrTier);
  const tier = resolveCustomerTier(customerOrTier);
  const isSuperWholesale = tier === 'SUPER_WHOLESALE';
  const isWholesale = tier === 'WHOLESALE';

  if (isSuperWholesale) {
    // 1. Explicit model-specific super wholesale price
    if (
      model.superWholesalePrice !== undefined &&
      model.superWholesalePrice !== null &&
      !isNaN(Number(model.superWholesalePrice)) &&
      Number(model.superWholesalePrice) > 0
    ) {
      return Number(model.superWholesalePrice);
    }

    // 2. Safe fallback to explicit model-specific wholesale price
    if (
      model.wholesalePrice !== undefined &&
      model.wholesalePrice !== null &&
      !isNaN(Number(model.wholesalePrice)) &&
      Number(model.wholesalePrice) > 0
    ) {
      return Number(model.wholesalePrice);
    }

    // 3. Proportionate super wholesale discount based on parent product if set
    if (
      product.superWholesalePrice !== undefined &&
      product.superWholesalePrice !== null &&
      product.price &&
      product.price > 0 &&
      Number(product.superWholesalePrice) > 0 &&
      Number(product.superWholesalePrice) < product.price
    ) {
      const discountRatio = Number(product.superWholesalePrice) / product.price;
      return Math.round(Number(model.price) * discountRatio);
    }

    // 4. Safe fallback to proportionate wholesale discount based on parent product
    if (
      product.wholesalePrice !== undefined &&
      product.wholesalePrice !== null &&
      product.price &&
      product.price > 0 &&
      Number(product.wholesalePrice) > 0 &&
      Number(product.wholesalePrice) < product.price
    ) {
      const discountRatio = Number(product.wholesalePrice) / product.price;
      return Math.round(Number(model.price) * discountRatio);
    }

    return Number(model.price) || 0;
  }

  if (isWholesale) {
    // 1. Explicit model-specific wholesale price
    if (
      model.wholesalePrice !== undefined &&
      model.wholesalePrice !== null &&
      !isNaN(Number(model.wholesalePrice)) &&
      Number(model.wholesalePrice) > 0
    ) {
      return Number(model.wholesalePrice);
    }
    // 2. Proportionate wholesale discount based on parent product if set
    if (
      product.wholesalePrice !== undefined &&
      product.wholesalePrice !== null &&
      product.price &&
      product.price > 0 &&
      Number(product.wholesalePrice) > 0 &&
      Number(product.wholesalePrice) < product.price
    ) {
      const discountRatio = Number(product.wholesalePrice) / product.price;
      return Math.round(Number(model.price) * discountRatio);
    }
  }

  return Number(model.price) || 0;
}

/**
 * Computes the savings achieved by a wholesale customer compared to retail price.
 */
export function getWholesaleSavings(
  product: Product
): { hasSavings: boolean; amount: number; percentage: number } {
  const retail = Number(product.price) || 0;
  const wholesale = Number(product.wholesalePrice) || 0;

  if (wholesale > 0 && wholesale < retail) {
    const amount = retail - wholesale;
    const percentage = Math.round((amount / retail) * 100);
    return { hasSavings: true, amount, percentage };
  }

  return { hasSavings: false, amount: 0, percentage: 0 };
}

/**
 * Computes the savings achieved by a super wholesale customer compared to retail price.
 */
export function getSuperWholesaleSavings(
  product: Product
): { hasSavings: boolean; amount: number; percentage: number; wholesaleDiff: number } {
  const retail = Number(product.price) || 0;
  const superWholesale = getProductEffectivePrice(product, 'SUPER_WHOLESALE');
  const wholesale = Number(product.wholesalePrice) || 0;

  if (superWholesale > 0 && superWholesale < retail) {
    const amount = retail - superWholesale;
    const percentage = Math.round((amount / retail) * 100);
    const wholesaleDiff = wholesale > superWholesale ? wholesale - superWholesale : 0;
    return { hasSavings: true, amount, percentage, wholesaleDiff };
  }

  return { hasSavings: false, amount: 0, percentage: 0, wholesaleDiff: 0 };
}
