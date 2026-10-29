import { NextRequest, NextResponse } from 'next/server';
import {
  getAllReviewsFromDb,
  getReviewsByProductIdFromDb,
  getReviewsByCustomerEmailFromDb,
  insertReviewInDb,
} from '@/lib/db/repositories/reviews';
import { isDbConfigured } from '@/lib/db/mysql';
import { allowDevMockFallback } from '@/lib/env';
import { getAdminSession } from '@/lib/db/adminAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function maskEmail(email?: string): string | undefined {
  if (!email || !email.includes('@')) return undefined;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const email = searchParams.get('email');
    const isAdmin = Boolean(getAdminSession(request));

    if (!isDbConfigured()) {
      if (!allowDevMockFallback()) {
        return NextResponse.json(
          { success: false, error: 'Database service is currently unavailable.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json({ success: true, reviews: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    let reviews: any[] = [];

    if (productId) {
      reviews = await getReviewsByProductIdFromDb(productId);
    } else if (email) {
      reviews = await getReviewsByCustomerEmailFromDb(email);
    } else {
      reviews = await getAllReviewsFromDb();
    }

    // Mask customer email addresses in public responses to prevent web scrapers from harvesting PII
    const safeReviews = isAdmin
      ? reviews
      : reviews.map((r) => ({
          ...r,
          authorEmail: maskEmail(r.authorEmail || r.author_email),
          author_email: maskEmail(r.author_email || r.authorEmail),
        }));

    return NextResponse.json({ success: true, reviews: safeReviews }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`review_submit_${ip}`, 10, 60000); // 10 reviews/min per IP
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many review submissions. Please wait ${rateCheck.retryAfterSeconds} seconds before submitting again.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { productId, author, authorEmail, rating, title, comment, verified } = body;

    const resolvedAuthor = (author || body.userName || body.authorName || body.name || '').trim() || 'Verified Buyer';

    if (!productId || !comment?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product ID and comment are required.' },
        { status: 400 }
      );
    }

    const safeRating = Math.min(5, Math.max(1, Number(rating) || 5));

    if (!isDbConfigured()) {
      if (!allowDevMockFallback()) {
        return NextResponse.json(
          { success: false, error: 'Database service is currently unavailable.' },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        review: {
          id: `rev-${Date.now()}`,
          productId,
          author: resolvedAuthor,
          authorEmail: maskEmail(authorEmail),
          rating: safeRating,
          title: title || '',
          comment: comment.trim(),
          verified: verified !== false,
          date: new Date().toISOString(),
        },
      });
    }

    const review = await insertReviewInDb({
      productId,
      author: resolvedAuthor,
      authorEmail,
      rating: safeRating,
      title: title || '',
      comment: comment.trim(),
      verified: verified !== false,
    });

    return NextResponse.json({
      success: true,
      review: {
        ...review,
        authorEmail: maskEmail(review.authorEmail),
      },
    });
  } catch (error: any) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit review' },
      { status: 500 }
    );
  }
}
