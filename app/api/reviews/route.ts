import { NextRequest, NextResponse } from 'next/server';
import {
  getAllReviewsFromDb,
  getReviewsByProductIdFromDb,
  getReviewsByCustomerEmailFromDb,
  insertReviewInDb,
} from '@/lib/db/repositories/reviews';
import { isDbConfigured } from '@/lib/db/mysql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const email = searchParams.get('email');

    if (productId) {
      const reviews = await getReviewsByProductIdFromDb(productId);
      return NextResponse.json({ success: true, reviews });
    }

    if (email) {
      const reviews = await getReviewsByCustomerEmailFromDb(email);
      return NextResponse.json({ success: true, reviews });
    }

    const reviews = await getAllReviewsFromDb();
    return NextResponse.json({ success: true, reviews });
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
      // Return accepted with mock/local structure if db not configured
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
