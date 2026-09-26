import { Product } from '@/types';
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
 * Calculates the exact price applicable for an item according to the authenticated customer type.
 * Server and client both use this logic.
 *
 * Rules:
 * 1. For authenticated WHOLESALE customers:
 *    If the product has a configured wholesalePrice (> 0), use that wholesalePrice.
 *    If the product does not have a wholesalePrice configured, safely fallback to the standard retail price (never 0 or undefined).
 * 2. For standard RETAIL customers or guests:
 *    Always use the standard retail product.price.
 */
export function getProductEffectivePrice(
  product: Product,
  customerType?: CustomerType | string | null
): number {
  if (!product) return 0;
  const isWholesale = customerType === 'WHOLESALE';
  if (
    isWholesale &&
    product.wholesalePrice !== undefined &&
    product.wholesalePrice !== null &&
    !isNaN(Number(product.wholesalePrice)) &&
    Number(product.wholesalePrice) > 0
  ) {
    return Number(product.wholesalePrice);
  }
  return Number(product.price) || 0;
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
