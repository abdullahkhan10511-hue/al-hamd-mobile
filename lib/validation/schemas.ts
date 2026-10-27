import { z } from 'zod';

/**
 * Standard collection & array validation schemas using Zod.
 * Enforces bounded collection lengths to protect against memory exhaustion (GHSA-mrhx-c7xc-m3w5).
 */

export const BoundedArrayLimit = 200;

export const cartItemSchema = z.object({
  productId: z.string().optional(),
  dealId: z.string().optional(),
  productName: z.string().optional(),
  price: z.number().nonnegative().optional(),
  quantity: z.number().int().positive().max(1000),
  selectedModel: z.string().optional(),
  selectedColor: z.string().optional(),
  image: z.string().optional(),
}).refine(data => Boolean(data.productId || data.dealId), {
  message: 'Item must have either a productId or dealId',
});

export const orderSubmissionSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Cart is empty').max(BoundedArrayLimit, 'Cart exceeds maximum allowed items'),
  customer: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  shopName: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentMethodId: z.string().optional(),
  paymentStatus: z.string().optional(),
  paymentReference: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const promoValidationItemsSchema = z.array(
  z.object({
    productId: z.string().optional(),
    dealId: z.string().optional(),
    price: z.number().optional(),
    quantity: z.number().optional(),
  })
).max(BoundedArrayLimit, 'Items list exceeds maximum allowed size');
