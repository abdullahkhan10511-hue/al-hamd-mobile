import { ProductReview } from '@/types';
import { getStoredCollection, persistCollection } from './storage';
import { getCustomerOrdersForCustomer } from './customers';

const STORAGE_KEY = 'product_reviews';

const seedReviews: ProductReview[] = [];

export async function getAllReviews(): Promise<ProductReview[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/reviews', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.reviews)) {
          await persistCollection(STORAGE_KEY, data.reviews);
          return data.reviews;
        }
      }
    } catch {
      // Fall back to stored collection
    }
  }
  return getStoredCollection<ProductReview>(STORAGE_KEY, seedReviews);
}

export async function getCustomerReviews(customerIdOrEmail: string): Promise<ProductReview[]> {
  const normalized = customerIdOrEmail.trim().toLowerCase();
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/reviews?email=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.reviews)) {
          return data.reviews;
        }
      }
    } catch {}
  }
  const reviews = await getAllReviews();
  return reviews.filter(
    (r) =>
      (r.customerId && r.customerId.toLowerCase() === normalized) ||
      (r.authorEmail && r.authorEmail.toLowerCase() === normalized)
  );
}

export interface EligibleReviewProduct {
  productId: string;
  productName: string;
  productImage: string;
  orderId: string;
  orderDate: string;
}

/**
 * Returns products purchased by the customer that are eligible for review,
 * filtering out products already reviewed by this customer.
 */
export async function getEligibleUnreviewedProducts(customerIdOrEmail: string): Promise<EligibleReviewProduct[]> {
  const orders = await getCustomerOrdersForCustomer(customerIdOrEmail);
  const existingReviews = await getCustomerReviews(customerIdOrEmail);
  const reviewedProductIds = new Set(existingReviews.map((r) => r.productId).filter(Boolean));

  const eligibleMap = new Map<string, EligibleReviewProduct>();

  orders.forEach((ord) => {
    // Only orders that are confirmed, processing, shipped, or delivered are eligible
    if (ord.status === 'Cancelled') return;

    ord.items.forEach((item) => {
      if (!reviewedProductIds.has(item.productId) && !eligibleMap.has(item.productId)) {
        eligibleMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          productImage: item.image,
          orderId: ord.id,
          orderDate: ord.createdAt,
        });
      }
    });
  });

  return Array.from(eligibleMap.values());
}

/**
 * Submit verified purchase review.
 * Only allows review if customer has actually purchased the product.
 */
export async function submitCustomerReview(params: {
  customerId: string;
  customerEmail?: string;
  authorName: string;
  productId: string;
  productName: string;
  productImage?: string;
  rating: number;
  title: string;
  comment: string;
}): Promise<ProductReview> {
  const { customerId, customerEmail, authorName, productId, productName, productImage, rating, title, comment } = params;

  if (!productId || !title.trim() || !comment.trim()) {
    throw new Error('Title and review description are required.');
  }

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5 stars.');
  }

  // Verify legitimate purchase
  const orders = await getCustomerOrdersForCustomer(customerId);
  const hasPurchased = orders.some((ord) =>
    ord.status !== 'Cancelled' && ord.items.some((item) => item.productId === productId)
  );

  if (!hasPurchased) {
    throw new Error('Verified purchase required: You can only review products you have purchased.');
  }

  const reviews = await getAllReviews();

  const newReview: ProductReview = {
    id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    author: authorName.trim() || 'Verified Buyer',
    authorEmail: (customerEmail || '').trim().toLowerCase(),
    customerId,
    productId,
    productName,
    productImage: productImage || '',
    rating,
    date: new Date().toISOString(),
    title: title.trim(),
    comment: comment.trim(),
    verified: true,
  };

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          author: newReview.author,
          authorEmail: newReview.authorEmail,
          rating: newReview.rating,
          title: newReview.title,
          comment: newReview.comment,
          verified: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.review) {
          newReview.id = data.review.id;
        }
      }
    } catch (err) {
      console.warn('Failed to sync review with server:', err);
    }
  }

  const updated = [newReview, ...reviews];
  await persistCollection(STORAGE_KEY, updated);
  return newReview;
}

/**
 * Edit an existing customer review.
 */
export async function updateCustomerReview(
  customerIdOrEmail: string,
  reviewId: string,
  updates: { rating: number; title: string; comment: string }
): Promise<ProductReview> {
  const reviews = await getAllReviews();
  const index = reviews.findIndex((r) => r.id === reviewId);
  if (index === -1) {
    throw new Error('Review not found.');
  }

  const target = reviews[index];
  const normalized = customerIdOrEmail.trim().toLowerCase();
  const isOwner =
    (target.customerId && target.customerId.toLowerCase() === normalized) ||
    (target.authorEmail && target.authorEmail.toLowerCase() === normalized);

  if (!isOwner) {
    throw new Error('Permission denied: You can only edit your own reviews.');
  }

  reviews[index] = {
    ...target,
    rating: updates.rating,
    title: updates.title.trim(),
    comment: updates.comment.trim(),
    date: new Date().toISOString(),
  };

  await persistCollection(STORAGE_KEY, reviews);
  return reviews[index];
}

/**
 * Delete an existing customer review.
 */
export async function deleteCustomerReview(customerIdOrEmail: string, reviewId: string): Promise<boolean> {
  const reviews = await getAllReviews();
  const target = reviews.find((r) => r.id === reviewId);
  if (!target) return false;

  const normalized = customerIdOrEmail.trim().toLowerCase();
  const isOwner =
    (target.customerId && target.customerId.toLowerCase() === normalized) ||
    (target.authorEmail && target.authorEmail.toLowerCase() === normalized);

  if (!isOwner) {
    throw new Error('Permission denied: You can only delete your own reviews.');
  }

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Failed to delete review on server:', err);
    }
  }

  const updated = reviews.filter((r) => r.id !== reviewId);
  await persistCollection(STORAGE_KEY, updated);
  return true;
}
