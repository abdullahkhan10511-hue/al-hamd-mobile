import { query, execute, isDbConfigured } from '../mysql';
import {
  CustomerInquiry,
  InquiryType,
  InquiryStatus,
  InquiryPriority,
  InquiryFilterOptions,
} from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

interface InquiryRow extends RowDataPacket {
  id: string;
  reference_no: string;
  name: string;
  email: string | null;
  phone: string;
  inquiry_type: InquiryType;
  order_number: string | null;
  subject: string;
  message: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToInquiry(row: InquiryRow): CustomerInquiry {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    name: row.name,
    email: row.email || null,
    phone: row.phone,
    inquiryType: row.inquiry_type,
    orderNumber: row.order_number || null,
    subject: row.subject,
    message: row.message,
    status: row.status,
    priority: row.priority,
    adminNotes: row.admin_notes || null,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ----------------------------------------------------------------------------
// Offline Development & Fallback Storage (Used only when MySQL is not configured)
// ----------------------------------------------------------------------------
const DEV_FILE_PATH = path.join(process.cwd(), 'data', 'dev-inquiries.json');

function readDevInquiries(): CustomerInquiry[] {
  try {
    if (fs.existsSync(DEV_FILE_PATH)) {
      const content = fs.readFileSync(DEV_FILE_PATH, 'utf8');
      return JSON.parse(content) || [];
    }
  } catch (err) {
    console.warn('Could not read dev inquiries file:', err);
  }
  return [];
}

function saveDevInquiries(inquiries: CustomerInquiry[]): void {
  try {
    const dir = path.dirname(DEV_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DEV_FILE_PATH, JSON.stringify(inquiries, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save dev inquiries file:', err);
  }
}

/**
 * Generate a sequential, human-friendly public reference number:
 * Format: INQ-YYYY-000001
 */
export async function generateNextInquiryReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INQ-${year}-`;

  if (!isDbConfigured()) {
    const list = readDevInquiries();
    let maxSeq = 0;
    for (const item of list) {
      if (item.referenceNo && item.referenceNo.startsWith(prefix)) {
        const parts = item.referenceNo.split('-');
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
    const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
    return `${prefix}${nextSeq}`;
  }

  const rows = await query<RowDataPacket[]>(
    'SELECT reference_no FROM customer_inquiries WHERE reference_no LIKE ? ORDER BY reference_no DESC LIMIT 20',
    [`${prefix}%`]
  );

  let maxSeq = 0;
  for (const r of rows) {
    const parts = (r.reference_no || '').split('-');
    if (parts.length >= 3) {
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
  return `${prefix}${nextSeq}`;
}

export interface CreateInquiryInput {
  name: string;
  email?: string | null;
  phone: string;
  inquiryType: InquiryType;
  orderNumber?: string | null;
  subject: string;
  message: string;
  priority?: InquiryPriority;
}

/**
 * Create and persist a new customer inquiry.
 */
export async function createInquiryInDb(input: CreateInquiryInput): Promise<CustomerInquiry> {
  const id = `inq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const referenceNo = await generateNextInquiryReference();
  const status: InquiryStatus = 'NEW';
  const priority: InquiryPriority = input.priority || 'NORMAL';
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (!isDbConfigured()) {
    const newInquiry: CustomerInquiry = {
      id,
      referenceNo,
      name: input.name.trim(),
      email: input.email ? input.email.trim() : null,
      phone: input.phone.trim(),
      inquiryType: input.inquiryType,
      orderNumber: input.orderNumber ? input.orderNumber.trim() : null,
      subject: input.subject.trim(),
      message: input.message.trim(),
      status,
      priority,
      adminNotes: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    const list = readDevInquiries();
    list.unshift(newInquiry);
    saveDevInquiries(list);
    return newInquiry;
  }

  await execute(
    `INSERT INTO customer_inquiries (
      id, reference_no, name, email, phone, inquiry_type,
      order_number, subject, message, status, priority,
      admin_notes, resolved_at, resolved_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      NULL, NULL, NULL, NOW(), NOW()
    )`,
    [
      id,
      referenceNo,
      input.name.trim(),
      input.email ? input.email.trim() : null,
      input.phone.trim(),
      input.inquiryType,
      input.orderNumber ? input.orderNumber.trim() : null,
      input.subject.trim(),
      input.message.trim(),
      status,
      priority,
    ]
  );

  const created = await getInquiryByIdFromDb(id);
  if (!created) {
    throw new Error('Inquiry creation verification failed.');
  }
  return created;
}

/**
 * Get inquiry by ID or Reference Number.
 */
export async function getInquiryByIdFromDb(idOrRef: string): Promise<CustomerInquiry | null> {
  if (!idOrRef) return null;
  const clean = idOrRef.trim();

  if (!isDbConfigured()) {
    const list = readDevInquiries();
    const found = list.find((item) => item.id === clean || item.referenceNo.toLowerCase() === clean.toLowerCase());
    return found || null;
  }

  const rows = await query<InquiryRow[]>(
    'SELECT * FROM customer_inquiries WHERE id = ? OR reference_no = ? LIMIT 1',
    [clean, clean]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToInquiry(rows[0]);
}

/**
 * Fetch inquiries with filtering, search, and pagination.
 */
export async function getAllInquiriesFromDb(options: InquiryFilterOptions = {}): Promise<{
  inquiries: CustomerInquiry[];
  total: number;
}> {
  const {
    search,
    status,
    priority,
    inquiryType,
    page = 1,
    limit = 50,
  } = options;

  if (!isDbConfigured()) {
    let list = readDevInquiries();

    if (status && status !== 'ALL') {
      list = list.filter((i) => i.status === status);
    }
    if (priority && priority !== 'ALL') {
      list = list.filter((i) => i.priority === priority);
    }
    if (inquiryType && inquiryType !== 'ALL') {
      list = list.filter((i) => i.inquiryType === inquiryType);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.phone.toLowerCase().includes(q) ||
          (i.email && i.email.toLowerCase().includes(q)) ||
          i.subject.toLowerCase().includes(q) ||
          i.referenceNo.toLowerCase().includes(q) ||
          (i.orderNumber && i.orderNumber.toLowerCase().includes(q))
      );
    }

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return { inquiries: paginated, total };
  }

  const conditions: string[] = [];
  const params: any[] = [];

  if (status && status !== 'ALL') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (priority && priority !== 'ALL') {
    conditions.push('priority = ?');
    params.push(priority);
  }

  if (inquiryType && inquiryType !== 'ALL') {
    conditions.push('inquiry_type = ?');
    params.push(inquiryType);
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(
      '(name LIKE ? OR phone LIKE ? OR email LIKE ? OR subject LIKE ? OR reference_no LIKE ? OR order_number LIKE ?)'
    );
    params.push(q, q, q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM customer_inquiries ${whereClause}`,
    params
  );
  const total = countResult && countResult.length > 0 ? Number(countResult[0].count) : 0;

  // Get paginated items
  const offset = Math.max(0, (page - 1) * limit);
  const rows = await query<InquiryRow[]>(
    `SELECT * FROM customer_inquiries ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    inquiries: rows.map(mapRowToInquiry),
    total,
  };
}

export interface UpdateInquiryInput {
  status?: InquiryStatus;
  priority?: InquiryPriority;
  adminNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}

/**
 * Update inquiry status, priority, or internal admin notes.
 */
export async function updateInquiryInDb(
  id: string,
  updates: UpdateInquiryInput
): Promise<CustomerInquiry | null> {
  const existing = await getInquiryByIdFromDb(id);
  if (!existing) return null;

  let resolvedAt = updates.resolvedAt !== undefined ? updates.resolvedAt : existing.resolvedAt;
  if ((updates.status === 'RESOLVED' || updates.status === 'CLOSED') && !resolvedAt) {
    resolvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  } else if (updates.status === 'NEW' || updates.status === 'IN_PROGRESS') {
    if (updates.status !== existing.status && updates.resolvedAt === undefined) {
      resolvedAt = null;
    }
  }

  if (!isDbConfigured()) {
    const list = readDevInquiries();
    const idx = list.findIndex((i) => i.id === existing.id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        status: updates.status || list[idx].status,
        priority: updates.priority || list[idx].priority,
        adminNotes: updates.adminNotes !== undefined ? updates.adminNotes : list[idx].adminNotes,
        resolvedBy: updates.resolvedBy !== undefined ? updates.resolvedBy : list[idx].resolvedBy,
        resolvedAt: resolvedAt,
        updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      };
      saveDevInquiries(list);
      return list[idx];
    }
    return null;
  }

  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }

  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }

  if (updates.adminNotes !== undefined) {
    setClauses.push('admin_notes = ?');
    params.push(updates.adminNotes);
  }

  if (updates.resolvedBy !== undefined) {
    setClauses.push('resolved_by = ?');
    params.push(updates.resolvedBy);
  }

  if (resolvedAt !== undefined) {
    setClauses.push('resolved_at = ?');
    params.push(resolvedAt);
  }

  params.push(existing.id);

  await execute(
    `UPDATE customer_inquiries SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );

  return getInquiryByIdFromDb(existing.id);
}

/**
 * Summary statistics for the inquiries admin dashboard widget.
 */
export async function getInquiriesStatsFromDb(): Promise<{
  total: number;
  newCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  highOrUrgentCount: number;
}> {
  if (!isDbConfigured()) {
    const list = readDevInquiries();
    return {
      total: list.length,
      newCount: list.filter((i) => i.status === 'NEW').length,
      inProgressCount: list.filter((i) => i.status === 'IN_PROGRESS').length,
      resolvedCount: list.filter((i) => i.status === 'RESOLVED').length,
      closedCount: list.filter((i) => i.status === 'CLOSED').length,
      highOrUrgentCount: list.filter((i) => i.priority === 'HIGH' || i.priority === 'URGENT').length,
    };
  }

  const rows = await query<RowDataPacket[]>(
`SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_count,
      SUM(CASE WHEN priority IN ('HIGH', 'URGENT') THEN 1 ELSE 0 END) as high_urgent_count
    FROM customer_inquiries`
  );

  if (!rows || rows.length === 0) {
    return {
      total: 0,
      newCount: 0,
      inProgressCount: 0,
      resolvedCount: 0,
      closedCount: 0,
      highOrUrgentCount: 0,
    };
  }

  const r = rows[0];
  return {
    total: Number(r.total || 0),
    newCount: Number(r.new_count || 0),
    inProgressCount: Number(r.in_progress_count || 0),
    resolvedCount: Number(r.resolved_count || 0),
    closedCount: Number(r.closed_count || 0),
    highOrUrgentCount: Number(r.high_urgent_count || 0),
  };
}
