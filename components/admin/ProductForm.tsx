'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Check,
  CheckCircle2,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  Play,
  Video,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Maximize2,
  Film,
  X,
  ArrowUpDown,
  GripVertical,
  Smartphone,
  Palette,
  Warehouse,
  Store,
} from 'lucide-react';
import { getCategories, deduplicateCategoriesById } from '@/lib/db/categories';
import { getBrands, getActiveBrands, syncBrandsFromApi } from '@/lib/db/brands';
import { createProduct, updateProduct } from '@/lib/db/products';
import { ProductMediaItem, ProductModelVariant, ProductColorVariant } from '@/types';
import { Brand } from '@/types/admin';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface ProductFormProps {
  initialProduct?: any;
  isNew?: boolean;
}

export function ProductForm({ initialProduct, isNew = false }: ProductFormProps) {
  const router = useRouter();
  const { admin } = useAdminAuth();
  const categories = deduplicateCategoriesById(getCategories());

  // Form Fields - All fields are completely optional
  const [name, setName] = useState(initialProduct?.name || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [brand, setBrand] = useState(initialProduct?.brand || '');
  const [brandsList, setBrandsList] = useState<Brand[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBrands = async () => {
      const active = getActiveBrands();
      setBrandsList(active);
      const synced = await syncBrandsFromApi();
      if (synced && synced.length > 0) {
        setBrandsList(synced);
      }
    };
    loadBrands();

    const handleBrandUpdate = () => {
      setBrandsList(getActiveBrands());
    };
    window.addEventListener('alhamd:data-updated', handleBrandUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleBrandUpdate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBrandUpdate = () => {
    setBrandsList(getActiveBrands());
  };

  const selectableBrands = useMemo(() => {
    const active = brandsList.filter((b) => b.status === 'active');
    // If the product being edited already has a brand that is inactive or not in active list, preserve it!
    if (brand && brand.trim() && !active.some((b) => b.name.toLowerCase() === brand.trim().toLowerCase())) {
      const all = getBrands();
      const existingBrandObj = all.find((b) => b.name.toLowerCase() === brand.trim().toLowerCase());
      return [
        existingBrandObj || {
          id: `brand-${brand}`,
          name: brand,
          slug: brand.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'inactive' as const,
          productCount: 0,
        },
        ...active,
      ];
    }
    return active;
  }, [brandsList, brand]);

  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return selectableBrands;
    const q = brandSearch.trim().toLowerCase();
    return selectableBrands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q)
    );
  }, [selectableBrands, brandSearch]);

  const selectedBrand = useMemo(() => {
    if (!brand) return null;
    return (
      selectableBrands.find((b) => b.name.toLowerCase() === brand.trim().toLowerCase()) ||
      getBrands().find((b) => b.name.toLowerCase() === brand.trim().toLowerCase()) ||
      null
    );
  }, [selectableBrands, brand]);

  const [categorySlug, setCategorySlug] = useState(initialProduct?.categorySlug || '');
  const [inventoryLocation, setInventoryLocation] = useState<'WAREHOUSE' | 'SHOP'>(
    initialProduct?.inventoryLocation === 'SHOP' ? 'SHOP' : 'WAREHOUSE'
  );
  const [price, setPrice] = useState<number | ''>(
    initialProduct?.price !== undefined ? initialProduct.price : ''
  );
  const [compareAtPrice, setCompareAtPrice] = useState<number | ''>(
    initialProduct?.compareAtPrice !== undefined ? initialProduct.compareAtPrice : ''
  );
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>(
    initialProduct?.wholesalePrice !== undefined ? initialProduct.wholesalePrice : ''
  );
  const [superWholesalePrice, setSuperWholesalePrice] = useState<number | ''>(
    initialProduct?.superWholesalePrice !== undefined ? initialProduct.superWholesalePrice : ''
  );
  const [stock, setStock] = useState<number | ''>(
    initialProduct?.stock !== undefined ? initialProduct.stock : ''
  );
  const [shopStock, setShopStock] = useState<number | ''>(
    initialProduct?.shopStock !== undefined ? initialProduct.shopStock : ''
  );
  const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(
    initialProduct?.lowStockThreshold !== undefined ? initialProduct.lowStockThreshold : ''
  );

  const [description, setDescription] = useState(initialProduct?.description || '');
  const [longDescription, setLongDescription] = useState(initialProduct?.longDescription || '');

  // Badges & Status - Optional toggles
  const [status, setStatus] = useState<'active' | 'inactive'>(
    initialProduct?.status === 'inactive' ? 'inactive' : 'active'
  );
  const [badgeNew, setBadgeNew] = useState(initialProduct?.isNewArrival ?? initialProduct?.isNew ?? false);
  const [badgeBestSeller, setBadgeBestSeller] = useState(initialProduct?.isBestSeller ?? false);
  const [badgeTrending, setBadgeTrending] = useState(initialProduct?.trending ?? false);
  const [featured, setFeatured] = useState(initialProduct?.featured ?? false);

  // Media items - Multi-media support (Images & Videos)
  const getInitialMedia = (): ProductMediaItem[] => {
    if (!initialProduct) return [];
    if (Array.isArray(initialProduct.media) && initialProduct.media.length > 0) {
      return initialProduct.media.map((m: any, idx: number) => ({
        id: m.id || `med-init-${idx}`,
        url: typeof m === 'string' ? m : m.url,
        type: typeof m === 'object' && m.type === 'video' ? 'video' : 'image',
        name: typeof m === 'object' ? m.name : undefined,
        size: typeof m === 'object' ? m.size : undefined,
      }));
    }
    const items: ProductMediaItem[] = [];
    if (Array.isArray(initialProduct.images)) {
      initialProduct.images.forEach((img: string, idx: number) => {
        if (img && typeof img === 'string' && img.trim()) {
          items.push({
            id: `img-${idx}`,
            url: img.trim(),
            type: 'image',
            name: `Image ${idx + 1}`,
          });
        }
      });
    }
    if (Array.isArray(initialProduct.videos)) {
      initialProduct.videos.forEach((vid: string, idx: number) => {
        if (vid && typeof vid === 'string' && vid.trim()) {
          items.push({
            id: `vid-${idx}`,
            url: vid.trim(),
            type: 'video',
            name: `Video ${idx + 1}`,
          });
        }
      });
    }
    return items;
  };

  const [mediaList, setMediaList] = useState<ProductMediaItem[]>(getInitialMedia());
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'auto' | 'image' | 'video'>('auto');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [previewMediaModal, setPreviewMediaModal] = useState<ProductMediaItem | null>(null);
  const [isArrangeModalOpen, setIsArrangeModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Model Variants - Optional
  const [enableModelSelection, setEnableModelSelection] = useState<boolean>(
    initialProduct?.enableModelSelection ?? false
  );
  const [models, setModels] = useState<ProductModelVariant[]>(
    Array.isArray(initialProduct?.models) ? initialProduct.models : []
  );

  // Color Variants - Optional
  const [enableColorSelection, setEnableColorSelection] = useState<boolean>(
    initialProduct?.enableColorSelection ??
      Boolean(
        (initialProduct?.colors && initialProduct.colors.length > 0) ||
        (initialProduct?.variants?.colors && initialProduct.variants.colors.length > 0)
      )
  );
  const [colors, setColors] = useState<ProductColorVariant[]>(
    Array.isArray(initialProduct?.colors) && initialProduct.colors.length > 0
      ? initialProduct.colors
      : Array.isArray(initialProduct?.variants?.colors) && initialProduct.variants.colors.length > 0
      ? initialProduct.variants.colors.map((c: any) => ({ name: c.name, hex: c.hex, isActive: true }))
      : []
  );

  // Specifications - Optional array
  const [specs, setSpecs] = useState<{ key: string; val: string }[]>(
    initialProduct?.specifications
      ? Object.entries(initialProduct.specifications).map(([key, val]) => ({ key, val: String(val) }))
      : []
  );

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddModel = () => {
    const newModel: ProductModelVariant = {
      id: `mod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      price: price === '' ? 0 : Number(price),
      compareAtPrice: compareAtPrice === '' ? undefined : Number(compareAtPrice),
      wholesalePrice: wholesalePrice === '' ? undefined : Number(wholesalePrice),
      superWholesalePrice: superWholesalePrice === '' ? undefined : Number(superWholesalePrice),
      stock: stock === '' ? 0 : Number(stock),
      shopStock: shopStock === '' ? 0 : Number(shopStock),
      sku: '',
      isActive: true,
      images: [],
      videos: [],
    };
    setModels((prev) => [...prev, newModel]);
  };

  const handleUpdateModel = (index: number, updates: Partial<ProductModelVariant>) => {
    setModels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveModel = (index: number) => {
    setModels((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadModelImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/products/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success && data.items?.[0]?.url) {
        setModels((prev) => {
          const next = [...prev];
          const currentImgs = next[index].images || [];
          next[index] = { ...next[index], images: [...currentImgs, data.items[0].url] };
          return next;
        });
      } else {
        alert(data.error || 'Failed to upload model image');
      }
    } catch (err: any) {
      console.error('Failed to upload model image', err);
      alert(err?.message || 'Failed to upload model image');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveModelImage = (modelIndex: number, imgIndex: number) => {
    setModels((prev) => {
      const next = [...prev];
      const currentImgs = next[modelIndex].images || [];
      next[modelIndex] = {
        ...next[modelIndex],
        images: currentImgs.filter((_, i) => i !== imgIndex),
      };
      return next;
    });
  };

  const handleAddColor = () => {
    const newColor: ProductColorVariant = {
      id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      hex: '#000000',
      isActive: true,
    };
    setColors((prev) => [...prev, newColor]);
  };

  const handleUpdateColor = (index: number, updates: Partial<ProductColorVariant>) => {
    setColors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveColor = (index: number) => {
    setColors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (isNew && (!slug || slug.trim() === '')) {
      setSlug(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
    }
  };

  const handleUploadMediaFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = '';

    setMediaError('');
    setIsUploading(true);
    setUploadProgressText(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const res = await fetch('/api/admin/products/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload media files.');
      }

      if (data.items && Array.isArray(data.items)) {
        setMediaList((prev) => [
          ...prev,
          ...data.items.map((item: any) => ({
            id: item.id || `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            url: item.url,
            type: item.type === 'video' ? 'video' : 'image',
            name: item.name,
            size: item.size,
          })),
        ]);
      }

      if (data.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
        setMediaError(data.warnings.join(' '));
      }
    } catch (err: any) {
      console.error('Product media upload error:', err);
      setMediaError(err?.message || 'Failed to upload media files. Please check file format (JPG, PNG, WebP, MP4) and size.');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  };

  const handleAddMediaUrl = async () => {
    const raw = newMediaUrl.trim();
    if (!raw) return;

    // If it is already an internal persistent path, add directly
    if (raw.startsWith('/uploads/') || raw.startsWith('uploads/')) {
      const normalizedUrl = raw.startsWith('/') ? raw : `/${raw}`;
      const isVid = newMediaType === 'video' || normalizedUrl.includes('/videos/') || normalizedUrl.endsWith('.mp4');
      setMediaList((prev) => [
        ...prev,
        {
          id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: normalizedUrl,
          type: isVid ? 'video' : 'image',
          name: normalizedUrl.split('/').pop() || (isVid ? 'Product Video' : 'Product Image'),
        },
      ]);
      setNewMediaUrl('');
      setNewMediaType('auto');
      return;
    }

    // External URL: Download & persist directly into PERSISTENT_UPLOADS_DIR
    setMediaError('');
    setIsUploading(true);
    setUploadProgressText('Importing remote media into persistent storage...');

    try {
      const res = await fetch('/api/admin/products/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: raw,
          folder: newMediaType === 'video' ? 'videos' : 'products',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.item) {
        throw new Error(data.error || 'Failed to import remote media.');
      }

      setMediaList((prev) => [
        ...prev,
        {
          id: data.item.id || `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: data.item.url,
          type: data.item.type === 'video' ? 'video' : 'image',
          name: data.item.name || (data.item.type === 'video' ? 'Product Video' : 'Product Image'),
          size: data.item.size,
        },
      ]);

      setNewMediaUrl('');
      setNewMediaType('auto');
    } catch (err: any) {
      console.error('Remote media import error:', err);
      setMediaError(err?.message || 'Failed to import remote media. Please check URL and format.');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  };


  const handleRemoveMedia = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveMedia = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mediaList.length) return;
    setMediaList((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setMediaList((prev) => {
      const next = [...prev];
      const [movedItem] = next.splice(draggedIndex, 1);
      next.splice(dropIndex, 0, movedItem);
      return next;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setError('');
    setSuccessMessage('');



    // Every field is completely optional - NO mandatory/required fields

    const matchedCat = categories.find((c) => c.slug === categorySlug);
    const categoryName = matchedCat ? matchedCat.name : (categorySlug || '');

    // Convert specs array back to Record
    const specRecord: Record<string, string> = {};
    specs.forEach((s) => {
      if (s.key && s.key.trim()) specRecord[s.key.trim()] = (s.val || '').trim();
    });

    const numPrice = price === '' || price === undefined || price === null ? 0 : Number(price);
    const numCompareAtPrice =
      compareAtPrice === '' || compareAtPrice === undefined || compareAtPrice === null
        ? undefined
        : Number(compareAtPrice);
    const numWholesalePrice =
      wholesalePrice === '' || wholesalePrice === undefined || wholesalePrice === null || Number(wholesalePrice) <= 0
        ? undefined
        : Number(wholesalePrice);
    const numSuperWholesalePrice =
      superWholesalePrice === '' || superWholesalePrice === undefined || superWholesalePrice === null || Number(superWholesalePrice) <= 0
        ? undefined
        : Number(superWholesalePrice);

    if (
      numPrice < 0 ||
      (numCompareAtPrice !== undefined && numCompareAtPrice < 0) ||
      (numWholesalePrice !== undefined && numWholesalePrice < 0) ||
      (numSuperWholesalePrice !== undefined && numSuperWholesalePrice < 0)
    ) {
      setError('Prices cannot be negative. Please enter valid numeric values.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const isShopLoc = inventoryLocation === 'SHOP';
    const rawStock = stock === '' || stock === undefined || stock === null ? 0 : Number(stock);
    const rawShopStock = shopStock === '' || shopStock === undefined || shopStock === null ? 0 : Number(shopStock);

    const numStock = isShopLoc ? 0 : rawStock;
    const numShopStock = isShopLoc
      ? (rawShopStock > 0 ? rawShopStock : rawStock)
      : (isNew ? 0 : rawShopStock);

    const numLowStock =
      lowStockThreshold === '' || lowStockThreshold === undefined || lowStockThreshold === null
        ? 0
        : Number(lowStockThreshold);

    // Validation for Models when enabled
    if (enableModelSelection && models.length > 0) {
      const emptyModel = models.find((m) => !m.name || !m.name.trim());
      if (emptyModel) {
        setError('Please enter a name for all mobile models or remove empty model rows.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const seenNames = new Set<string>();
      for (const m of models) {
        const norm = m.name.trim().toLowerCase();
        if (seenNames.has(norm)) {
          setError(`Duplicate model name "${m.name}". Each model must have a unique name.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        seenNames.add(norm);
      }
    }

    // Validation for Colors when enabled
    if (enableColorSelection && colors.length > 0) {
      const emptyColor = colors.find((c) => !c.name || !c.name.trim());
      if (emptyColor) {
        setError('Please enter a name for all colors or remove empty color rows.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      sku: sku.trim().toUpperCase(),
      brand: brand.trim(),
      brandId: selectedBrand?.id || (initialProduct as any)?.brandId,
      brandSlug: selectedBrand?.slug || (initialProduct as any)?.brandSlug,
      category: categoryName,
      categorySlug: categorySlug || '',
      inventoryLocation,
      price: numPrice,
      compareAtPrice: numCompareAtPrice,
      wholesalePrice: numWholesalePrice,
      superWholesalePrice: numSuperWholesalePrice,
      discountPercentage:
        numCompareAtPrice && numCompareAtPrice > numPrice
          ? Math.round(((numCompareAtPrice - numPrice) / numCompareAtPrice) * 100)
          : undefined,
      stock: numStock,
      shopStock: numShopStock,
      lowStockThreshold: numLowStock,

      description: description.trim(),
      longDescription: longDescription.trim(),
      images: mediaList.filter((m) => m.type === 'image').map((m) => m.url),
      videos: mediaList.filter((m) => m.type === 'video').map((m) => m.url),
      media: mediaList.map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        name: m.name,
        size: m.size,
      })),
      enableModelSelection,
      models: enableModelSelection
        ? models
            .filter((m) => m.name && m.name.trim() !== '')
            .map((m) => {
              const mRawStock = m.stock !== undefined ? Number(m.stock) : 0;
              const mRawShopStock = m.shopStock !== undefined ? Number(m.shopStock) : 0;
              return {
                ...m,
                name: m.name.trim(),
                sku: m.sku ? m.sku.trim().toUpperCase() : undefined,
                price: Number(m.price) || 0,
                compareAtPrice: m.compareAtPrice ? Number(m.compareAtPrice) : undefined,
                wholesalePrice: m.wholesalePrice ? Number(m.wholesalePrice) : undefined,
                superWholesalePrice: m.superWholesalePrice ? Number(m.superWholesalePrice) : undefined,
                stock: isShopLoc ? 0 : mRawStock,
                shopStock: isShopLoc
                  ? (mRawShopStock > 0 ? mRawShopStock : mRawStock)
                  : (isNew ? 0 : mRawShopStock),
                isActive: m.isActive !== false,
                images: Array.isArray(m.images) ? m.images.filter(Boolean) : [],
                videos: Array.isArray(m.videos) ? m.videos.filter(Boolean) : [],
              };
            })
        : [],
      enableColorSelection,
      colors: enableColorSelection
        ? colors
            .filter((c) => c.name && c.name.trim() !== '')
            .map((c) => ({
              id: c.id,
              name: c.name.trim(),
              hex: c.hex || '#000000',
              isActive: c.isActive !== false,
            }))
        : [],
      variants: {
        colors: enableColorSelection
          ? colors
              .filter((c) => c.name && c.name.trim() !== '' && c.isActive !== false)
              .map((c) => ({ name: c.name.trim(), hex: c.hex || '#000000' }))
          : undefined,
      },
      rating: initialProduct?.rating || 5.0,
      reviewCount: initialProduct?.reviewCount || 0,
      isNew: badgeNew,
      isNewArrival: badgeNew,
      isBestSeller: badgeBestSeller,
      isSale: !!(numCompareAtPrice && numCompareAtPrice > numPrice),
      featured,
      trending: badgeTrending,
      status,
      specifications: specRecord,
    };

    setIsSaving(true);

    try {
      if (isNew) {
        const res = await createProduct(payload, admin?.email || 'admin@alhamd.com');
        if (!res.success) {
          setIsSaving(false);
          setError(res.error || 'Unable to save product. Please try again.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } else {
        const res = await updateProduct(initialProduct.id, payload, admin?.email || 'admin@alhamd.com');
        if (!res.success) {
          setIsSaving(false);
          setError(res.error || 'Unable to save product. Please try again.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      // Backend confirmed successful save
      setIsSaving(false);
      setSuccessMessage('Product published successfully!');
      router.push('/admin/products');
    } catch (err: any) {
      console.error('Save product error:', err);
      setIsSaving(false);
      setError('Unable to save product. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectLocation = (loc: 'WAREHOUSE' | 'SHOP') => {
    setInventoryLocation(loc);
    if (loc === 'SHOP') {
      if (stock !== '' && Number(stock) > 0 && (shopStock === '' || Number(shopStock) === 0)) {
        setShopStock(stock);
      }
      setStock(0);
    } else {
      if (isNew && (stock === '' || Number(stock) === 0) && shopStock !== '' && Number(shopStock) > 0) {
        setStock(shopStock);
        setShopStock(0);
      }
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </Link>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : isNew ? 'Publish Product' : 'Save Changes'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Details, Descriptions & Specs (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Inventory Location Selection */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight flex items-center gap-2">
                  <Store className="w-4 h-4 text-neutral-800" />
                  <span>Inventory Location</span>
                </h2>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Select where this product belongs. Shop products are kept strictly separate from Warehouse Inventory.
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                inventoryLocation === 'SHOP' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-blue-100 text-blue-900 border border-blue-200'
              }`}>
                Active: {inventoryLocation}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* SHOP Button */}
              <button
                type="button"
                onClick={() => handleSelectLocation('SHOP')}
                className={`p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 cursor-pointer relative ${
                  inventoryLocation === 'SHOP'
                    ? 'border-neutral-950 bg-neutral-950 text-white shadow-md'
                    : 'border-neutral-200 bg-neutral-50 hover:bg-white hover:border-neutral-300 text-neutral-900'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  inventoryLocation === 'SHOP' ? 'bg-white/15 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}>
                  <Store className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm tracking-wider uppercase">SHOP</span>
                    {inventoryLocation === 'SHOP' && (
                      <span className="w-5 h-5 rounded-full bg-white text-neutral-950 flex items-center justify-center text-xs font-bold shadow-xs">✓</span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${inventoryLocation === 'SHOP' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    Created exclusively for retail shop. Does NOT appear in Warehouse Inventory.
                  </p>
                </div>
              </button>

              {/* WAREHOUSE Button */}
              <button
                type="button"
                onClick={() => handleSelectLocation('WAREHOUSE')}
                className={`p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 cursor-pointer relative ${
                  inventoryLocation === 'WAREHOUSE'
                    ? 'border-neutral-950 bg-neutral-950 text-white shadow-md'
                    : 'border-neutral-200 bg-neutral-50 hover:bg-white hover:border-neutral-300 text-neutral-900'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  inventoryLocation === 'WAREHOUSE' ? 'bg-white/15 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}>
                  <Warehouse className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm tracking-wider uppercase">WAREHOUSE</span>
                    {inventoryLocation === 'WAREHOUSE' && (
                      <span className="w-5 h-5 rounded-full bg-white text-neutral-950 flex items-center justify-center text-xs font-bold shadow-xs">✓</span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${inventoryLocation === 'WAREHOUSE' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    Standard warehouse product. Transferred to shop stock only through Shop Bill.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* General Info */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-3">
              1. General Details
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Product Title</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. MagSafe Shockproof Clear Case for iPhone 15 Pro"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Unique SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. ALH-MC-001 (optional)"
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono"
                  />
                  <span className="text-[10px] text-neutral-400 mt-1 block">Validated for global uniqueness if provided.</span>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">URL Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="magsafe-shockproof-clear-case (optional)"
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Short Tagline</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Military-grade 10ft drop protection with N52 strong magnetic ring"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Long Description</label>
                <textarea
                  rows={4}
                  value={longDescription}
                  onChange={(e) => setLongDescription(e.target.value)}
                  placeholder="Detailed specifications, material composition, device compatibility, and charging performance..."
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50"
                />
              </div>
            </div>
          </div>

          {/* Product Media Manager */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                  2. Product Media ({mediaList.length})
                </h2>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {mediaList.filter((m) => m.type === 'image').length} Images, {mediaList.filter((m) => m.type === 'video').length} Videos
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsArrangeModalOpen(true)}
                  disabled={mediaList.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-neutral-950 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  title={mediaList.length === 0 ? "Upload media first to arrange" : "Open visual drag-and-drop media arranger"}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Arrange Media{mediaList.length > 0 ? ` (${mediaList.length})` : ''}</span>
                </button>
                {mediaList.length > 0 && (
                  <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">
                    Item #1 is storefront primary showcase
                  </span>
                )}
              </div>
            </div>

            {mediaError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{mediaError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMediaError('')}
                  className="text-rose-500 hover:text-rose-800 text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mediaList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative aspect-square rounded-2xl overflow-hidden bg-neutral-100 border transition-all group shadow-xs cursor-grab active:cursor-grabbing select-none ${
                    draggedIndex === idx
                      ? 'opacity-40 scale-95 border-dashed border-neutral-950'
                      : dragOverIndex === idx && draggedIndex !== idx
                      ? 'ring-2 ring-neutral-950 scale-102 border-neutral-950'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                  title="Drag and drop to rearrange order"
                >
                  {item.type === 'video' ? (
                    <div className="w-full h-full relative bg-neutral-950 flex items-center justify-center">
                      <video
                        src={item.url}
                        muted
                        preload="metadata"
                        className="w-full h-full object-cover opacity-90"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white shadow-md">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute top-2 right-2 bg-indigo-600/90 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-md shadow-xs z-10 flex items-center gap-1">
                        <Video className="w-2.5 h-2.5" /> Video
                      </span>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name || `Product media ${idx + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  )}

                  {/* Order & Primary Badge */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                    <span className="bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                      #{idx + 1}
                    </span>
                    {idx === 0 && (
                      <span className="bg-neutral-950 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-md shadow-xs">
                        Primary
                      </span>
                    )}
                  </div>

                  {/* Drag Grip Indicator */}
                  <span className="absolute bottom-2 left-2 z-10 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-20 p-2">
                    <button
                      type="button"
                      onClick={() => handleMoveMedia(idx, 'left')}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shadow-xs"
                      title="Move Earlier"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMediaModal(item)}
                      className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-neutral-800 transition-colors cursor-pointer shadow-xs"
                      title="Preview Media"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveMedia(idx, 'right')}
                      disabled={idx === mediaList.length - 1}
                      className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shadow-xs"
                      title="Move Later"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(idx)}
                      className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
                      title="Remove Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {mediaList.length === 0 && (
                <div className="col-span-2 sm:col-span-4 p-8 rounded-2xl border border-dashed border-neutral-200 text-neutral-400 text-xs text-center flex flex-col items-center justify-center gap-2">
                  <Film className="w-8 h-8 text-neutral-300" />
                  <p className="font-semibold text-neutral-600">No media uploaded yet</p>
                  <p className="text-[11px] text-neutral-400 max-w-sm">
                    Upload multiple product images (JPG, JPEG, PNG, WEBP) and videos (MP4, WEBM) or paste direct URLs.
                  </p>
                </div>
              )}
            </div>

            {/* Upload, Arrange & Link Controls */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="px-5 py-2.5 rounded-xl bg-neutral-950 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shrink-0 hover:bg-neutral-800 transition-colors shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading Media...' : 'Upload Media Files'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/jpg,video/mp4,video/webm"
                    onChange={handleUploadMediaFiles}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setIsArrangeModalOpen(true)}
                  disabled={mediaList.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-neutral-300 shadow-2xs"
                  title={mediaList.length === 0 ? "Upload media first to arrange" : "Drag and drop to rearrange order of images and videos"}
                >
                  <ArrowUpDown className="w-4 h-4 text-neutral-700" />
                  <span>Arrange Media{mediaList.length > 0 ? ` (${mediaList.length})` : ''}</span>
                </button>

                {mediaList.length > 1 && (
                  <span className="text-xs text-neutral-500 font-medium flex items-center gap-1.5 ml-auto">
                    <GripVertical className="w-3.5 h-3.5 text-neutral-400" />
                    Drag cards or click Arrange Media to reorder
                  </span>
                )}
              </div>

              {/* Direct Media URL Input Row */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 text-xs pt-1 border-t border-neutral-100">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isUploading && newMediaUrl.trim()) {
                        e.preventDefault();
                        handleAddMediaUrl();
                      }
                    }}
                    placeholder="Or paste direct image or video URL (https://... or .mp4)..."
                    className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono text-[11px] focus:bg-white"
                  />
                </div>

                <select
                  value={newMediaType}
                  onChange={(e) => setNewMediaType(e.target.value as any)}
                  className="p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 font-medium text-xs shrink-0 cursor-pointer"
                  title="Media Type"
                >
                  <option value="auto">Auto Type</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddMediaUrl}
                  disabled={!newMediaUrl.trim() || isUploading}
                  className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold cursor-pointer shrink-0 disabled:opacity-40 transition-colors"
                >
                  {isUploading ? 'Importing...' : 'Add URL'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-neutral-400">
                <span>
                  Supported formats: Images (JPG, JPEG, PNG, WEBP up to 15MB) and Videos (MP4, WEBM up to 100MB). Click &ldquo;Arrange Media&rdquo; to drag &amp; drop order.
                </span>
                {isUploading && (
                  <span className="text-neutral-700 font-semibold flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-ping" />
                    {uploadProgressText || 'Uploading media...'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Models / Models Manager */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-neutral-800" />
                  <span>3. Mobile Models</span>
                </h2>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Add multiple phone models under the same product (e.g. iPhone 13, 14, 15, Samsung S23).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-neutral-700">
                  Enable Model Selection:
                </span>
                <button
                  type="button"
                  onClick={() => setEnableModelSelection(!enableModelSelection)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    enableModelSelection ? 'bg-neutral-950' : 'bg-neutral-300'
                  }`}
                  title="Toggle Mobile Models on/off"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enableModelSelection ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-extrabold uppercase ${
                    enableModelSelection ? 'text-neutral-950' : 'text-neutral-400'
                  }`}
                >
                  {enableModelSelection ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {enableModelSelection ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600">
                    Models ({models.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddModel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Model</span>
                  </button>
                </div>

                {models.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-neutral-50 border border-dashed border-neutral-200 text-neutral-500 text-xs">
                    <Smartphone className="w-6 h-6 mx-auto mb-2 text-neutral-400 opacity-60" />
                    <p className="font-semibold text-neutral-800">No Mobile Models added yet</p>
                    <p className="text-[11px] text-neutral-400 mt-1 mb-3">
                      Click &ldquo;Add Model&rdquo; to add compatible devices (e.g. iPhone 13, iPhone 14, iPhone 15).
                    </p>
                    <button
                      type="button"
                      onClick={handleAddModel}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold text-xs hover:bg-neutral-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add First Model
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {models.map((mod, idx) => (
                      <div
                        key={mod.id || idx}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          mod.isActive !== false
                            ? 'bg-neutral-50/70 border-neutral-200'
                            : 'bg-neutral-100/50 border-neutral-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-neutral-200/60 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 font-bold text-[10px] flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-neutral-900">
                              {mod.name.trim() || 'Untitled Model'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs text-neutral-700 font-medium cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={mod.isActive !== false}
                                onChange={(e) => handleUpdateModel(idx, { isActive: e.target.checked })}
                                className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
                              />
                              <span>Active</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveModel(idx)}
                              className="text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer p-1"
                              title="Remove Model"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                          <div className="sm:col-span-2">
                            <label className="font-semibold text-neutral-700 block mb-1">
                              Model Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={mod.name}
                              onChange={(e) => handleUpdateModel(idx, { name: e.target.value })}
                              placeholder="e.g. iPhone 14 Pro Max"
                              className="w-full p-2 rounded-xl border border-neutral-200 bg-white font-medium"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-neutral-700 block mb-1">
                              Discount Price (PKR) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              value={mod.price ?? ''}
                              onChange={(e) =>
                                handleUpdateModel(idx, {
                                  price: e.target.value === '' ? 0 : Number(e.target.value),
                                })
                              }
                              placeholder="e.g. 1100"
                              className="w-full p-2 rounded-xl border border-neutral-200 bg-white font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-neutral-700 block mb-1">
                              Original Price (PKR)
                            </label>
                            <input
                              type="number"
                              value={mod.compareAtPrice ?? ''}
                              onChange={(e) =>
                                handleUpdateModel(idx, {
                                  compareAtPrice: e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                              placeholder="Optional strike"
                              className="w-full p-2 rounded-xl border border-neutral-200 bg-white font-mono"
                            />
                          </div>

                          {inventoryLocation === 'SHOP' ? (
                            <div>
                              <label className="font-semibold text-amber-900 block mb-1">
                                Shop Stock
                              </label>
                              <input
                                type="number"
                                value={mod.shopStock ?? mod.stock ?? ''}
                                onChange={(e) =>
                                  handleUpdateModel(idx, {
                                    shopStock: e.target.value === '' ? 0 : Number(e.target.value),
                                    stock: 0,
                                  })
                                }
                                placeholder="e.g. 10"
                                className="w-full p-2 rounded-xl border border-amber-300 bg-amber-50/40 font-mono font-bold"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="font-semibold text-neutral-700 block mb-1">
                                Warehouse Stock
                              </label>
                              <input
                                type="number"
                                value={mod.stock ?? ''}
                                onChange={(e) =>
                                  handleUpdateModel(idx, {
                                    stock: e.target.value === '' ? 0 : Number(e.target.value),
                                    shopStock: 0,
                                  })
                                }
                                placeholder="e.g. 15"
                                className="w-full p-2 rounded-xl border border-neutral-200 bg-white font-mono"
                              />
                            </div>
                          )}

                          <div>
                            <label className="font-semibold text-neutral-700 block mb-1">
                              Model SKU
                            </label>
                            <input
                              type="text"
                              value={mod.sku || ''}
                              onChange={(e) => handleUpdateModel(idx, { sku: e.target.value.toUpperCase() })}
                              placeholder="e.g. ALH-IP14-01"
                              className="w-full p-2 rounded-xl border border-neutral-200 bg-white font-mono"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="font-semibold text-neutral-700 block mb-1">
                              Wholesale Price (PKR) <span className="text-neutral-400 font-normal">(optional)</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={mod.wholesalePrice ?? ''}
                              onChange={(e) =>
                                handleUpdateModel(idx, {
                                  wholesalePrice: e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                              placeholder="Special wholesale rate"
                              className="w-full p-2 rounded-xl border border-indigo-200 bg-indigo-50/20 font-mono"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="font-semibold text-purple-900 block mb-1">
                              Super Wholesale Price (PKR) <span className="text-neutral-400 font-normal">(optional)</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={mod.superWholesalePrice ?? ''}
                              onChange={(e) =>
                                handleUpdateModel(idx, {
                                  superWholesalePrice: e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                              placeholder="Super wholesale tier rate"
                              className="w-full p-2 rounded-xl border border-purple-200 bg-purple-50/30 font-mono text-purple-950 font-bold"
                            />
                          </div>
                        </div>

                        {/* Model-Specific Images (Optional) */}
                        <div className="mt-3 pt-3 border-t border-neutral-200/50">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="text-xs font-semibold text-neutral-700">
                                Model Images (Optional)
                              </span>
                              <span className="text-[11px] text-neutral-400 block">
                                If omitted, main product gallery will be shown automatically.
                              </span>
                            </div>
                            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 cursor-pointer shadow-2xs">
                              <Upload className="w-3 h-3 text-neutral-500" />
                              <span>Upload Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadModelImage(idx, e)}
                              />
                            </label>
                          </div>

                          {mod.images && mod.images.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {mod.images.map((imgUrl, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  className="relative w-14 h-14 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 group"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`Model ${mod.name} ${imgIdx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveModelImage(idx, imgIdx)}
                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Remove image"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-neutral-400 italic">
                              No model-specific image uploaded. Fallback to main product gallery active.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">
                Model selection is turned OFF. This product behaves as a normal standard product.
              </p>
            )}
          </div>

          {/* Color Variants Manager */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight flex items-center gap-2">
                  <Palette className="w-4 h-4 text-neutral-800" />
                  <span>4. Color Variants</span>
                </h2>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Configure color options with interactive swatches on the customer product page.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-neutral-700">
                  Enable Colors:
                </span>
                <button
                  type="button"
                  onClick={() => setEnableColorSelection(!enableColorSelection)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    enableColorSelection ? 'bg-neutral-950' : 'bg-neutral-300'
                  }`}
                  title="Toggle Colors on/off"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enableColorSelection ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-extrabold uppercase ${
                    enableColorSelection ? 'text-neutral-950' : 'text-neutral-400'
                  }`}
                >
                  {enableColorSelection ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {enableColorSelection ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600">
                    Colors ({colors.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Color</span>
                  </button>
                </div>

                {colors.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-neutral-50 border border-dashed border-neutral-200 text-neutral-500 text-xs">
                    <Palette className="w-6 h-6 mx-auto mb-2 text-neutral-400 opacity-60" />
                    <p className="font-semibold text-neutral-800">No Colors added yet</p>
                    <p className="text-[11px] text-neutral-400 mt-1 mb-3">
                      Add colors like Black, Silver, Titanium Gray, Deep Blue, or Alpine White.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddColor}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 text-white font-semibold text-xs hover:bg-neutral-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add First Color
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {colors.map((col, idx) => (
                      <div
                        key={col.id || idx}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          col.isActive !== false
                            ? 'bg-neutral-50/70 border-neutral-200'
                            : 'bg-neutral-100/50 border-neutral-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* Color Swatch Picker */}
                          <div className="relative w-8 h-8 rounded-full border border-neutral-300 overflow-hidden shrink-0 shadow-2xs">
                            <input
                              type="color"
                              value={col.hex || '#000000'}
                              onChange={(e) => handleUpdateColor(idx, { hex: e.target.value })}
                              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-none bg-transparent"
                              title="Pick Color Swatch"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => handleUpdateColor(idx, { name: e.target.value })}
                              placeholder="Color Name (e.g. Space Black)"
                              className="w-full p-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-900"
                            />
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-neutral-400 font-mono">Hex:</span>
                              <input
                                type="text"
                                value={col.hex || ''}
                                onChange={(e) => handleUpdateColor(idx, { hex: e.target.value })}
                                placeholder="#000000"
                                className="w-20 p-0.5 px-1.5 rounded border border-neutral-200 bg-white font-mono text-[10px] text-neutral-600 uppercase"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <label className="flex items-center gap-1 text-[11px] text-neutral-600 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={col.isActive !== false}
                              onChange={(e) => handleUpdateColor(idx, { isActive: e.target.checked })}
                              className="rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
                            />
                            <span>Active</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveColor(idx)}
                            className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                            title="Remove Color"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">
                Colors are turned OFF. No color selector will be shown to customers.
              </p>
            )}
          </div>

          {/* Specifications Key-Values */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                5. Technical Specifications
              </h2>
              <button
                type="button"
                onClick={() => setSpecs([...specs, { key: '', val: '' }])}
                className="text-xs font-semibold text-neutral-900 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {specs.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => {
                      const updated = [...specs];
                      updated[idx].key = e.target.value;
                      setSpecs(updated);
                    }}
                    placeholder="e.g. Driver Size"
                    className="w-1/3 p-2 rounded-xl border border-neutral-200 bg-neutral-50 font-medium"
                  />
                  <input
                    type="text"
                    value={item.val}
                    onChange={(e) => {
                      const updated = [...specs];
                      updated[idx].val = e.target.value;
                      setSpecs(updated);
                    }}
                    placeholder="e.g. 40mm Beryllium"
                    className="flex-1 p-2 rounded-xl border border-neutral-200 bg-neutral-50"
                  />
                  <button
                    type="button"
                    onClick={() => setSpecs(specs.filter((_, i) => i !== idx))}
                    className="p-2 text-neutral-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>


        </div>

        {/* Right Sidebar: Pricing, Organization & Badges (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pricing & Stock */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-2">
              Pricing & Inventory
            </h3>

            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Discount Price (PKR)</label>
              <input
                type="number"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2499 (optional)"
                className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Original Price (PKR)</label>
              <input
                type="number"
                step="1"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Optional strike-through"
                className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono"
              />
              {compareAtPrice && Number(compareAtPrice) > Number(price || 0) && (
                <div className="text-[11px] font-semibold text-emerald-600 mt-1">
                  Discount: {Math.round(((Number(compareAtPrice) - Number(price || 0)) / Number(compareAtPrice)) * 100)}% OFF
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-700">Wholesale Price (PKR)</label>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                  Wholesale
                </span>
              </div>
              <input
                type="number"
                step="1"
                min="0"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Special wholesale rate (optional)"
                className="w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/30 font-mono font-bold text-sm text-indigo-950 focus:bg-white focus:border-indigo-400"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                {wholesalePrice && Number(wholesalePrice) > 0 && Number(price || 0) > Number(wholesalePrice) ? (
                  <span className="text-emerald-600 font-semibold">
                    Wholesale savings: Rs. {(Number(price) - Number(wholesalePrice)).toLocaleString('en-PK')} (
                    {Math.round(((Number(price) - Number(wholesalePrice)) / Number(price)) * 100)}% discount)
                  </span>
                ) : (
                  'Leave blank to automatically apply standard retail price to wholesale buyers.'
                )}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-700">Super Wholesale Price (PKR)</label>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                  Super Wholesale
                </span>
              </div>
              <input
                type="number"
                step="1"
                min="0"
                value={superWholesalePrice}
                onChange={(e) => setSuperWholesalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Super wholesale tier rate (optional)"
                className="w-full p-2.5 rounded-xl border border-purple-200 bg-purple-50/30 font-mono font-bold text-sm text-purple-950 focus:bg-white focus:border-purple-400"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                {superWholesalePrice && Number(superWholesalePrice) > 0 && Number(price || 0) > Number(superWholesalePrice) ? (
                  <span className="text-purple-700 font-semibold">
                    Super wholesale savings: Rs. {(Number(price) - Number(superWholesalePrice)).toLocaleString('en-PK')} (
                    {Math.round(((Number(price) - Number(superWholesalePrice)) / Number(price)) * 100)}% discount)
                  </span>
                ) : (
                  'Leave blank or 0 for safe fallback: wholesale price will apply automatically to super wholesale partners.'
                )}
              </span>
            </div>

            {inventoryLocation === 'SHOP' ? (
              <div>
                <label className="font-semibold text-neutral-900 block mb-1">
                  Shop Quantity
                </label>
                <input
                  type="number"
                  value={shopStock !== '' ? shopStock : stock}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setShopStock(val);
                  }}
                  placeholder="e.g. 10 (Shop Stock)"
                  className="w-full p-2.5 rounded-xl border border-amber-300 bg-amber-50/30 font-mono font-bold text-sm text-neutral-950 focus:bg-white focus:border-amber-500"
                />
                <span className="text-[10px] text-amber-700 font-medium mt-1 block">
                  Physical units stored at the retail shop. This product will NOT receive warehouse stock.
                </span>
              </div>
            ) : (
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Warehouse Quantity
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 50 (Warehouse Stock)"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono font-bold text-sm"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Physical units stored in warehouse. Transferred to shop only via Shop Bills.
                </span>
              </div>
            )}

            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Stock Warning</label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 5 (optional)"
                className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-mono"
              />
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Warning triggers when stock reaches this level or below.
              </span>
            </div>
          </div>

          {/* Organization: Brand & Category */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-2">
              Organization
            </h3>

            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Category</label>
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-medium"
              >
                <option value="">Select Category (Optional)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative" ref={brandDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-700 block">Brand</label>
                <Link
                  href="/admin/brands"
                  target="_blank"
                  className="text-[10px] text-neutral-500 hover:text-neutral-900 font-medium underline"
                >
                  Manage Brands
                </Link>
              </div>

              {/* Select Trigger */}
              <button
                type="button"
                onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                  brandDropdownOpen
                    ? 'border-neutral-900 bg-white ring-2 ring-neutral-900/10'
                    : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white'
                }`}
              >
                <span className={brand ? 'font-bold text-neutral-950 flex items-center gap-2' : 'text-neutral-400 font-normal'}>
                  {brand ? (
                    <>
                      <span>{brand}</span>
                      {selectedBrand?.status === 'inactive' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                          Inactive
                        </span>
                      )}
                    </>
                  ) : (
                    'Select Brand'
                  )}
                </span>
                <div className="flex items-center gap-1.5 text-neutral-400">
                  {brand && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrand('');
                      }}
                      className="p-1 hover:text-neutral-900 rounded-md transition-colors"
                      title="Clear brand"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${brandDropdownOpen ? 'rotate-180 text-neutral-900' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {brandDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 overflow-hidden text-xs">
                  {/* Search Input */}
                  <div className="p-2 border-b border-neutral-100 bg-neutral-50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        placeholder="Search brands (e.g. Apple, Samsung)..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none focus:border-neutral-900"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Brand Options List */}
                  <div className="max-h-56 overflow-y-auto p-1 divide-y divide-neutral-50">
                    <button
                      type="button"
                      onClick={() => {
                        setBrand('');
                        setBrandDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                        !brand ? 'bg-neutral-100 font-bold text-neutral-900' : 'hover:bg-neutral-50 text-neutral-500'
                      }`}
                    >
                      <span>-- No Brand / Unbranded --</span>
                      {!brand && <Check className="w-3.5 h-3.5 text-neutral-900" />}
                    </button>

                    {filteredBrands.map((b) => {
                      const isSelected = brand.toLowerCase() === b.name.toLowerCase();
                      return (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => {
                            setBrand(b.name);
                            setBrandDropdownOpen(false);
                            setBrandSearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-900 text-white font-bold'
                              : 'hover:bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{b.name}</span>
                            {b.status === 'inactive' && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                                Inactive
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      );
                    })}

                    {filteredBrands.length === 0 && (
                      <div className="p-3 text-center text-neutral-400 text-xs">
                        No brands found matching &quot;{brandSearch}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visibility Badges */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-neutral-950 uppercase tracking-tight border-b border-neutral-100 pb-2">
              Storefront Badges & Sections
            </h3>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={badgeNew}
                onChange={(e) => setBadgeNew(e.target.checked)}
                className="accent-neutral-950 w-4 h-4"
              />
              <span className="font-medium">New Arrival Badge</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={badgeBestSeller}
                onChange={(e) => setBadgeBestSeller(e.target.checked)}
                className="accent-neutral-950 w-4 h-4"
              />
              <span className="font-medium">Best Seller Badge & Showcase</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={badgeTrending}
                onChange={(e) => setBadgeTrending(e.target.checked)}
                className="accent-neutral-950 w-4 h-4"
              />
              <span className="font-medium">Trending Showcase Feature</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="accent-neutral-950 w-4 h-4"
              />
              <span className="font-medium">Featured on All Items</span>
            </label>

            <div className="pt-3 border-t border-neutral-100">
              <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-neutral-50 hover:bg-neutral-100/80 transition-colors">
                <div>
                  <span className="font-bold text-neutral-900 block text-xs">Product Active Status</span>
                  <span className="text-[10px] text-neutral-500">
                    {status === 'active' ? 'Active & visible on store' : 'Inactive & hidden from store'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={status === 'active'}
                  onChange={(e) => setStatus(e.target.checked ? 'active' : 'inactive')}
                  className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-4 border-t border-neutral-100">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-neutral-950 text-white font-bold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : isNew ? 'Publish Product' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Media Preview Modal */}
      {previewMediaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col max-h-[90vh]">
            <div className="p-4 flex items-center justify-between border-b border-neutral-800 text-white">
              <div className="flex items-center gap-2">
                {previewMediaModal.type === 'video' ? (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-[10px] font-bold uppercase tracking-wider">
                    Video
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-neutral-700 text-[10px] font-bold uppercase tracking-wider">
                    Image
                  </span>
                )}
                <span className="text-xs font-semibold truncate max-w-md">
                  {previewMediaModal.name || 'Media Preview'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMediaModal(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black min-h-[300px]">
              {previewMediaModal.type === 'video' ? (
                <video
                  src={previewMediaModal.url}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-auto max-w-full rounded-xl"
                />
              ) : (
                <img
                  src={previewMediaModal.url}
                  alt={previewMediaModal.name || 'Product Image Preview'}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Arrange Media Modal */}
      {isArrangeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-950 uppercase tracking-tight">
                    Arrange Product Media ({mediaList.length})
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Drag and drop items to set their storefront display order. Item #1 is the primary showcase.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsArrangeModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Drag & Drop Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs text-neutral-600 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span>
                    Drag any card before or after another to reorder. Images and videos can be mixed in any sequence.
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-neutral-500 shrink-0 hidden sm:inline">
                  {mediaList.filter((m) => m.type === 'image').length} Images • {mediaList.filter((m) => m.type === 'video').length} Videos
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {mediaList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`relative rounded-2xl overflow-hidden bg-white border-2 p-2.5 flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing shadow-xs group select-none ${
                      draggedIndex === idx
                        ? 'opacity-40 scale-95 border-dashed border-neutral-900 ring-2 ring-neutral-300'
                        : dragOverIndex === idx && draggedIndex !== idx
                        ? 'ring-2 ring-neutral-950 scale-102 border-neutral-950 bg-neutral-50 shadow-md'
                        : 'border-neutral-200/80 hover:border-neutral-400 hover:shadow-md'
                    }`}
                  >
                    {/* Top order bar */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-4 h-4 text-neutral-400 group-hover:text-neutral-800" />
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                            idx === 0
                              ? 'bg-neutral-950 text-white'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          #{idx + 1} {idx === 0 && '(Primary)'}
                        </span>
                      </div>

                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          item.type === 'video'
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>

                    {/* Thumbnail */}
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-100 border border-neutral-100">
                      {item.type === 'video' ? (
                        <div className="w-full h-full relative bg-neutral-950 flex items-center justify-center">
                          <video
                            src={item.url}
                            muted
                            preload="metadata"
                            className="w-full h-full object-cover opacity-85 pointer-events-none"
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white shadow-sm">
                              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt={item.name || `Media ${idx + 1}`}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      )}
                    </div>

                    {/* Bottom controls / name */}
                    <div className="flex items-center justify-between text-[11px] gap-1 pt-1 border-t border-neutral-100">
                      <span className="truncate text-neutral-500 font-medium max-w-[80px]" title={item.name || `Media ${idx + 1}`}>
                        {item.name || `Media ${idx + 1}`}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveMedia(idx, 'left');
                          }}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-neutral-100 text-neutral-600 disabled:opacity-20 cursor-pointer"
                          title="Move Earlier"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveMedia(idx, 'right');
                          }}
                          disabled={idx === mediaList.length - 1}
                          className="p-1 rounded hover:bg-neutral-100 text-neutral-600 disabled:opacity-20 cursor-pointer"
                          title="Move Later"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMedia(idx);
                          }}
                          className="p-1 rounded hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-neutral-100 bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-neutral-500 flex items-center gap-2">
                <span className="font-semibold text-neutral-800">Primary Showcase:</span>
                <span className="truncate max-w-xs font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-neutral-200">
                  #{1} {mediaList[0]?.name || (mediaList[0]?.type === 'video' ? 'Video' : 'Image')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsArrangeModalOpen(false)}
                className="px-6 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Done Arranging</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
