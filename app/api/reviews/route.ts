import { NextRequest, NextResponse } from 'next/server';
import {
  getAllReviewsFromDb,
  getReviewsByProductIdFromDb,
  getReviewsByCustomerEmailFromDb,
  insertReviewInDb,
} from '@/lib/db/repositories/reviews';
import { isDbConfigured } from '@/lib/db/mysql';
import { allowDevMockFallback } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const email = searchParams.get('email');

    if (!isDbConfigured()) {
      if (!allowDevMockFallback()) {
        return NextResponse.json(
          { success: false, error: 'Database service is currently unavailable.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json({ success: true, reviews: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (productId) {
      const reviews = await getReviewsByProductIdFromDb(productId);
      return NextResponse.json({ success: true, reviews }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (email) {
      const reviews = await getReviewsByCustomerEmailFromDb(email);
      return NextResponse.json({ success: true, reviews }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const reviews = await getAllReviewsFromDb();
    return NextResponse.json({ success: true, reviews }, { headers: { 'Cache-Control': 'no-store' } });
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
    const body = await request.json();
    const { productId, author, authorEmail, rating, title, comment, verified } = body;

    if (!productId || !comment?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product ID and comment are required.' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      if (!allowDevMockFallback()) {
        return NextResponse.json(
          { success: false, error: 'Database service is currently unavailable.' },
          { status: 503 }
        );
      }
      // Return accepted with mock/local structure if db not configured in dev
      return NextResponse.json({
        success: true,
        review: {
          id: `rev-${Date.now()}`,
          productId,
          author: author || 'Verified Buyer',
          authorEmail,
          rating: Number(rating) || 5,
          title: title || '',
          comment,
          verified: verified !== false,
          date: new Date().toISOString(),
        },
      });
    }

    const review = await insertReviewInDb({
      productId,
      author: author || 'Verified Buyer',
      authorEmail,
      rating: Number(rating) || 5,
      title: title || '',
      comment,
      verified: verified !== false,
    });

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit review' },
      { status: 500 }
    );
  }
}
