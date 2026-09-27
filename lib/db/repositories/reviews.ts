import { query, execute, isDbConfigured } from '../mysql';
import { ProductReview } from '@/types';
import { RowDataPacket } from 'mysql2/promise';

interface ReviewRow extends RowDataPacket {
  id: string;
  product_id: string;
  author: string;
  author_email: string | null;
  rating: number;
  title: string | null;
  comment: string;
  verified: number;
  date: string;
}

function mapRowToReview(r: ReviewRow): ProductReview {
  return {
    id: r.id,
    productId: r.product_id,
    author: r.author,
    authorEmail: r.author_email || undefined,
    rating: Number(r.rating),
    title: r.title || '',
    comment: r.comment,
    verified: Boolean(r.verified),
    date: r.date,
  };
}

export async function getAllReviewsFromDb(): Promise<ProductReview[]> {
  if (!isDbConfigured()) return [];

  const rows = await query<ReviewRow[]>(
    'SELECT * FROM product_reviews ORDER BY date DESC'
  );

  return rows.map(mapRowToReview);
}

export async function getReviewsByProductIdFromDb(productId: string): Promise<ProductReview[]> {
  if (!isDbConfigured()) return [];

  const rows = await query<ReviewRow[]>(
    'SELECT * FROM product_reviews WHERE product_id = ? ORDER BY date DESC',
    [productId]
  );

  return rows.map(mapRowToReview);
}

export async function getReviewsByCustomerEmailFromDb(email: string): Promise<ProductReview[]> {
  if (!isDbConfigured() || !email) return [];

  const rows = await query<ReviewRow[]>(
    'SELECT * FROM product_reviews WHERE LOWER(author_email) = LOWER(?) ORDER BY date DESC',
    [email.trim()]
  );

  return rows.map(mapRowToReview);
}

export async function insertReviewInDb(review: {
  id?: string;
  productId: string;
  author: string;
  authorEmail?: string;
  rating: number;
  title?: string;
  comment: string;
  verified?: boolean;
}): Promise<ProductReview> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const id = review.id || `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const author = (review.author || 'Verified Buyer').trim();
  const authorEmail = review.authorEmail ? review.authorEmail.trim().toLowerCase() : null;
  const rating = Math.min(5, Math.max(1, Math.round(review.rating || 5)));
  const title = (review.title || '').trim();
  const comment = (review.comment || '').trim();
  const verified = review.verified !== false ? 1 : 0;

  await execute(
    `INSERT INTO product_reviews (id, product_id, author, author_email, rating, title, comment, verified, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       author = VALUES(author),
       author_email = VALUES(author_email),
       rating = VALUES(rating),
       title = VALUES(title),
       comment = VALUES(comment),
       verified = VALUES(verified)`,
    [id, review.productId, author, authorEmail, rating, title, comment, verified]
  );

  // Recalculate and update parent product rating & review_count
  try {
    const [stats]: any = await query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt, AVG(rating) as avg_rating FROM product_reviews WHERE product_id = ?',
      [review.productId]
    );
    if (stats && stats.length > 0) {
      const cnt = stats[0].cnt || 0;
      const avgRating = stats[0].avg_rating ? parseFloat(Number(stats[0].avg_rating).toFixed(2)) : 5.0;
      await execute(
        'UPDATE products SET rating = ?, review_count = ? WHERE id = ?',
        [avgRating, cnt, review.productId]
      );
    }
  } catch (err) {
    console.warn('Notice updating product review stats:', err);
  }

  return {
    id,
    productId: review.productId,
    author,
    authorEmail: authorEmail || undefined,
    rating,
    title,
    comment,
    verified: Boolean(verified),
    date: new Date().toISOString(),
  };
}

export async function deleteReviewInDb(id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;

  // Find product_id before delete to update stats
  const rows = await query<ReviewRow[]>('SELECT product_id FROM product_reviews WHERE id = ? LIMIT 1', [id]);
  const productId = rows.length > 0 ? rows[0].product_id : null;

  const result = await execute('DELETE FROM product_reviews WHERE id = ?', [id]);

  if (productId) {
    try {
      const [stats]: any = await query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt, AVG(rating) as avg_rating FROM product_reviews WHERE product_id = ?',
        [productId]
      );
      if (stats && stats.length > 0) {
        const cnt = stats[0].cnt || 0;
        const avgRating = cnt > 0 && stats[0].avg_rating ? parseFloat(Number(stats[0].avg_rating).toFixed(2)) : 5.0;
        await execute(
          'UPDATE products SET rating = ?, review_count = ? WHERE id = ?',
          [avgRating, cnt, productId]
        );
      }
    } catch {}
  }

  return result.affectedRows > 0;
}
