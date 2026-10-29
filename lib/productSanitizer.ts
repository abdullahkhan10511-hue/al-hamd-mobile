import { AdminSession } from '@/lib/db/sessionToken';
import { hasAdminPermission } from '@/lib/db/adminAuth';

export function sanitizeProductForSession(product: any, session: AdminSession | any): any {
  if (!product || !session) return product;

  // Root owner has access to all pricing & data
  const isOwner = Boolean(
    session.isOwner ||
    session.id === 'staff-owner-1' ||
    session.sub === 'staff-owner-1' ||
    (session.email && session.email.toLowerCase() === 'admin@alhamdmobile.com') ||
    (process.env.ADMIN_EMAIL && session.email && session.email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase())
  );
  if (isOwner) return product;

  const canViewRetail = hasAdminPermission(session, 'pricing.retail.view');
  const canViewWholesale = hasAdminPermission(session, 'pricing.wholesale.view');
  const canViewSuperWholesale = hasAdminPermission(session, 'pricing.super_wholesale.view');
  const canViewCost = hasAdminPermission(session, 'pricing.cost.view');
  const canViewMargin = hasAdminPermission(session, 'pricing.margin.view');

  const clone = { ...product };

  if (!canViewRetail) {
    delete clone.price;
    delete clone.compareAtPrice;
    delete clone.discountPercentage;
  }

  if (!canViewWholesale) {
    delete clone.wholesalePrice;
  }

  if (!canViewSuperWholesale) {
    delete clone.superWholesalePrice;
  }

  if (!canViewCost) {
    delete clone.costPrice;
    delete clone.purchasePrice;
  }

  if (!canViewMargin) {
    delete clone.profit;
    delete clone.margin;
  }

  if (Array.isArray(clone.models)) {
    clone.models = clone.models.map((m: any) => {
      const modelClone = { ...m };
      if (!canViewRetail) {
        delete modelClone.price;
        delete modelClone.compareAtPrice;
      }
      if (!canViewWholesale) {
        delete modelClone.wholesalePrice;
      }
      if (!canViewSuperWholesale) {
        delete modelClone.superWholesalePrice;
      }
      if (!canViewCost) {
        delete modelClone.costPrice;
      }
      if (!canViewMargin) {
        delete modelClone.profit;
        delete modelClone.margin;
      }
      return modelClone;
    });
  }

  return clone;
}

export function sanitizeProductsForSession(products: any[], session: AdminSession | any): any[] {
  if (!Array.isArray(products)) return [];
  return products.map((p) => sanitizeProductForSession(p, session));
}

/**
 * Validates whether the incoming product creation/update payload violates granular write permissions.
 * Returns null if allowed, or an error string if unauthorized.
 */
export function validateProductWritePermissions(
  body: any,
  session: AdminSession | any,
  existingProduct?: any
): string | null {
  if (!session) return 'Unauthorized: Admin session required.';

  // Owner bypass
  const isOwner = Boolean(
    session.isOwner ||
    session.id === 'staff-owner-1' ||
    session.sub === 'staff-owner-1' ||
    (session.email && session.email.toLowerCase() === 'admin@alhamdmobile.com') ||
    (process.env.ADMIN_EMAIL && session.email && session.email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase())
  );
  if (isOwner) return null;

  // 1. Retail Price validation
  const modifiesRetail =
    (body.price !== undefined && (!existingProduct || Number(body.price) !== Number(existingProduct.price))) ||
    (body.compareAtPrice !== undefined && (!existingProduct || Number(body.compareAtPrice) !== Number(existingProduct.compareAtPrice)));

  if (modifiesRetail && !hasAdminPermission(session, 'pricing.retail.edit')) {
    return 'Forbidden: Insufficient permissions to add or edit retail pricing.';
  }

  if (Array.isArray(body.models)) {
    for (const m of body.models) {
      const existingM = existingProduct?.models?.find((em: any) => em.id === m.id);
      if (m.price !== undefined && (!existingM || Number(m.price) !== Number(existingM.price))) {
        if (!hasAdminPermission(session, 'pricing.retail.edit')) {
          return 'Forbidden: Insufficient permissions to add or edit retail pricing on variants.';
        }
      }
    }
  }

  // 2. Wholesale Price validation
  const modifiesWholesale =
    body.wholesalePrice !== undefined &&
    (!existingProduct || Number(body.wholesalePrice) !== Number(existingProduct.wholesalePrice));

  if (modifiesWholesale && !hasAdminPermission(session, 'pricing.wholesale.edit')) {
    return 'Forbidden: Insufficient permissions to add or edit wholesale pricing.';
  }

  if (Array.isArray(body.models)) {
    for (const m of body.models) {
      const existingM = existingProduct?.models?.find((em: any) => em.id === m.id);
      if (
        m.wholesalePrice !== undefined &&
        (!existingM || Number(m.wholesalePrice) !== Number(existingM.wholesalePrice))
      ) {
        if (!hasAdminPermission(session, 'pricing.wholesale.edit')) {
          return 'Forbidden: Insufficient permissions to add or edit wholesale pricing on variants.';
        }
      }
    }
  }

  // 3. Super Wholesale Price validation
  const modifiesSuperWholesale =
    body.superWholesalePrice !== undefined &&
    (!existingProduct || Number(body.superWholesalePrice) !== Number(existingProduct.superWholesalePrice));

  if (modifiesSuperWholesale && !hasAdminPermission(session, 'pricing.super_wholesale.edit')) {
    return 'Forbidden: Insufficient permissions to add or edit super wholesale pricing.';
  }

  if (Array.isArray(body.models)) {
    for (const m of body.models) {
      const existingM = existingProduct?.models?.find((em: any) => em.id === m.id);
      if (
        m.superWholesalePrice !== undefined &&
        (!existingM || Number(m.superWholesalePrice) !== Number(existingM.superWholesalePrice))
      ) {
        if (!hasAdminPermission(session, 'pricing.super_wholesale.edit')) {
          return 'Forbidden: Insufficient permissions to add or edit super wholesale pricing on variants.';
        }
      }
    }
  }

  // 4. Cost Price validation
  const modifiesCost =
    (body.costPrice !== undefined || body.purchasePrice !== undefined) &&
    (!existingProduct || Number(body.costPrice ?? body.purchasePrice) !== Number(existingProduct.costPrice ?? existingProduct.purchasePrice));

  if (modifiesCost && !hasAdminPermission(session, 'pricing.cost.edit')) {
    return 'Forbidden: Insufficient permissions to add or edit cost/purchase pricing.';
  }

  if (Array.isArray(body.models)) {
    for (const m of body.models) {
      const existingM = existingProduct?.models?.find((em: any) => em.id === m.id);
      if (
        m.costPrice !== undefined &&
        (!existingM || Number(m.costPrice) !== Number(existingM.costPrice))
      ) {
        if (!hasAdminPermission(session, 'pricing.cost.edit')) {
          return 'Forbidden: Insufficient permissions to add or edit cost pricing on variants.';
        }
      }
    }
  }

  // 5. Stock / Inventory validation
  if (existingProduct) {
    // When updating an existing product:
    // Only flag as stock modification if warehouse or shop stock has actually changed
    const modifiesWarehouseStock =
      body.stock !== undefined && Number(body.stock) !== Number(existingProduct.stock ?? 0);
    const modifiesShopStock =
      body.shopStock !== undefined && Number(body.shopStock) !== Number(existingProduct.shopStock ?? 0);

    if ((modifiesWarehouseStock || modifiesShopStock) && !hasAdminPermission(session, ['inventory.stock.edit', 'inventory.adjust_stock'])) {
      return 'Forbidden: Insufficient permissions to directly modify inventory stock levels.';
    }

    if (Array.isArray(body.models)) {
      for (const m of body.models) {
        const existingM = existingProduct?.models?.find((em: any) => em.id === m.id || em.name === m.name);
        const prevMStock = existingM ? Number(existingM.stock ?? 0) : 0;
        const prevMShopStock = existingM ? Number(existingM.shopStock ?? 0) : 0;
        const newMStock = m.stock !== undefined ? Number(m.stock) : prevMStock;
        const newMShopStock = m.shopStock !== undefined ? Number(m.shopStock) : prevMShopStock;

        if (
          (newMStock !== prevMStock || newMShopStock !== prevMShopStock) &&
          !hasAdminPermission(session, ['inventory.stock.edit', 'inventory.adjust_stock'])
        ) {
          return 'Forbidden: Insufficient permissions to modify variant stock levels.';
        }
      }
    }
  } else {
    // When creating a new product (!existingProduct):
    // Creating a product in the catalog is authorized by products.create / products.add.
    // If stock is 0 or omitted, it is an unstocked product registration and does NOT require inventory permissions.
    // If the user specifies non-zero initial stock (> 0), that is an inventory stock allocation
    // which legitimately requires inventory stock permission.
    const initialWarehouseStock = body.stock !== undefined ? Number(body.stock) : 0;
    const initialShopStock = body.shopStock !== undefined ? Number(body.shopStock) : 0;
    const hasInitialProductStock = initialWarehouseStock > 0 || initialShopStock > 0;

    let hasInitialVariantStock = false;
    if (Array.isArray(body.models)) {
      for (const m of body.models) {
        if (
          (m.stock !== undefined && Number(m.stock) > 0) ||
          (m.shopStock !== undefined && Number(m.shopStock) > 0)
        ) {
          hasInitialVariantStock = true;
          break;
        }
      }
    }

    if (
      (hasInitialProductStock || hasInitialVariantStock) &&
      !hasAdminPermission(session, ['inventory.stock.edit', 'inventory.adjust_stock'])
    ) {
      return 'Forbidden: Insufficient permissions to directly modify inventory stock levels. New products can only be created with 0 stock unless inventory permissions are granted.';
    }
  }

  // 6. SKU / Barcode validation
  const modifiesSku =
    body.sku !== undefined && (!existingProduct || body.sku !== existingProduct.sku);

  if (
    modifiesSku &&
    !hasAdminPermission(session, [
      'products.sku_barcode',
      'products.edit',
      'products.create',
      'products.add',
    ])
  ) {
    return 'Forbidden: Insufficient permissions to manage product SKU or barcodes.';
  }

  // 7. Media validation
  const modifiesMedia =
    (body.images !== undefined && (!existingProduct || JSON.stringify(body.images) !== JSON.stringify(existingProduct.images))) ||
    (body.videos !== undefined && (!existingProduct || JSON.stringify(body.videos) !== JSON.stringify(existingProduct.videos)));

  if (
    modifiesMedia &&
    !hasAdminPermission(session, [
      'products.media',
      'products.edit',
      'products.create',
      'products.add',
    ])
  ) {
    return 'Forbidden: Insufficient permissions to manage product media.';
  }

  return null;
}
