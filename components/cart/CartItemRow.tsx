'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2, Package } from 'lucide-react';
import { CartItem as CartItemType } from '@/types';
import { useCart } from '@/context/CartContext';
import { formatPrice, getValidImageSrc } from '@/lib/utils';
import { getProductEffectivePrice, getModelEffectivePrice } from '@/lib/wholesale';

interface CartItemRowProps {
  item: CartItemType;
  onItemClick?: () => void;
}

export function CartItemRow({ item, onItemClick }: CartItemRowProps) {
  const { updateQuantity, removeFromCart, isWholesale, isSuperWholesale } = useCart();
  const customerTier = isSuperWholesale ? 'SUPER_WHOLESALE' : isWholesale ? 'WHOLESALE' : 'RETAIL';
  const { product, quantity, selectedSize, selectedColor, selectedModel, selectedImage, selectedPrice } = item;

  let unitPrice: number;
  if (selectedModel && product.models && Array.isArray(product.models)) {
    const modelObj = product.models.find(
      (m) => m.name.toLowerCase() === selectedModel.toLowerCase() || m.id === selectedModel
    );
    if (modelObj) {
      unitPrice = getModelEffectivePrice(product, modelObj, customerTier);
    } else {
      unitPrice = selectedPrice ?? getProductEffectivePrice(product, customerTier);
    }
  } else {
    unitPrice = selectedPrice ?? getProductEffectivePrice(product, customerTier);
  }

  const lineTotal = unitPrice * quantity;
  const isWholesaleActive = (isWholesale || isSuperWholesale) && product.wholesalePrice && Number(product.wholesalePrice) > 0;
  const validImage = selectedImage || getValidImageSrc(product?.images);

  return (
    <div className="flex gap-4 py-4 border-b border-neutral-100 last:border-none group">
      {/* Thumbnail */}
      <Link
        href={`/product/${product.slug}`}
        onClick={onItemClick}
        className="relative w-20 h-24 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/60 group-hover:opacity-95 transition-opacity flex items-center justify-center"
      >
        {validImage ? (
          <Image
            src={validImage}
            alt={product.name || 'Product'}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 text-neutral-400 p-2 text-center">
            <Package className="w-6 h-6 stroke-1 text-neutral-400 mb-1" />
            <span className="text-[9px] font-medium text-neutral-400 uppercase tracking-tighter">No Image</span>
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/product/${product.slug}`}
              onClick={onItemClick}
              className="text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors line-clamp-1"
            >
              {product.name}
            </Link>
            <button
              onClick={() => removeFromCart(item.id)}
              className="text-neutral-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
              aria-label={`Remove ${product.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Variants */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-neutral-500">
            {selectedModel && <span className="font-semibold text-neutral-800">Model: {selectedModel}</span>}
            {selectedModel && (selectedColor || selectedSize) && <span>•</span>}
            {selectedColor && <span>Color: {selectedColor}</span>}
            {selectedColor && selectedSize && <span>•</span>}
            {selectedSize && <span>Size: {selectedSize}</span>}
          </div>

          {isWholesaleActive && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white uppercase tracking-wider">
                Wholesale Price
              </span>
              <span className="text-[11px] text-neutral-400 line-through font-mono">
                Retail: {formatPrice(product.price)}
              </span>
            </div>
          )}
        </div>

        {/* Price & Quantity Controls */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center border border-neutral-200 rounded-full bg-neutral-50/50 p-0.5">
            <button
              onClick={() => updateQuantity(item.id, quantity - 1)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-950 transition-colors cursor-pointer disabled:opacity-30"
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center text-xs font-semibold font-mono text-neutral-900">
              {quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.id, quantity + 1)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-950 transition-colors cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="text-right">
            <span className="text-sm font-semibold text-neutral-900 font-mono">
              {formatPrice(lineTotal)}
            </span>
            <p className="text-[11px] text-neutral-500 font-mono">
              {formatPrice(unitPrice)} ea
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
