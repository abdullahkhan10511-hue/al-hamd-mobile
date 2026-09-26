'use client';

import React from 'react';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return <ProductForm isNew={true} />;
}
