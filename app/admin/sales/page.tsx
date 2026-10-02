'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Order } from '@/types/admin';
import { Product } from '@/types';
import { getOrders, syncOrdersFromApi } from '@/lib/db/orders';
import { getProducts } from '@/lib/db/products';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { formatPrice } from '@/lib/utils';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Calendar,
  Filter,
  BarChart3,
  Download,
  Package,
} from 'lucide-react';

export default function AdminSalesPage() {
  const { admin } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');

  const loadData = () => {
    setOrders(getOrders());
    setProducts(getProducts());
  };

  useEffect(() => {
    loadData();
    syncOrdersFromApi(admin?.email).then((synced) => {
      if (synced && synced.length > 0) {
        setOrders(synced);
      }
    }).catch(() => {});

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [admin?.email]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      if (startDate && orderDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
      return true;
    });
  }, [orders, startDate, endDate]);

  // Aggregate Metrics
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const todaySales = orders
    .filter((o) => new Date(o.createdAt) >= startOfToday)
    .reduce((sum, o) => sum + o.total, 0);

  const weeklySales = orders
    .filter((o) => new Date(o.createdAt) >= startOfWeek)
    .reduce((sum, o) => sum + o.total, 0);

  const monthlySales = orders
    .filter((o) => new Date(o.createdAt) >= startOfMonth)
    .reduce((sum, o) => sum + o.total, 0);

  const yearlySales = orders
    .filter((o) => new Date(o.createdAt) >= startOfYear)
    .reduce((sum, o) => sum + o.total, 0);

  const filteredTotalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const filteredOrderCount = filteredOrders.length;
  const averageOrderValue = filteredOrderCount > 0 ? filteredTotalRevenue / filteredOrderCount : 0;

  // Product sales breakdown
  const productSalesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        unitsSold: number;
        revenue: number;
        lastSale: string;
      }
    >();

    filteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        if (selectedProductFilter !== 'all' && item.productId !== selectedProductFilter) {
          return;
        }

        const existing = map.get(item.productId);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.total;
          if (new Date(o.createdAt) > new Date(existing.lastSale)) {
            existing.lastSale = o.createdAt;
          }
        } else {
          map.set(item.productId, {
            id: item.productId,
            name: item.productName,
            sku: item.sku,
            unitsSold: item.quantity,
            revenue: item.total,
            lastSale: o.createdAt,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, selectedProductFilter]);

  // Group by Date for timeline table
  const salesByDate = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; ordersCount: number }>();
    filteredOrders.forEach((o) => {
      const dateStr = new Date(o.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const current = map.get(dateStr) || { date: dateStr, revenue: 0, ordersCount: 0 };
      current.revenue += o.total;
      current.ordersCount += 1;
      map.set(dateStr, current);
    });
    return Array.from(map.values());
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Sales Analytics & Reports</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Revenue tracking, Average Order Value (AOV), SKU performance, and date breakdown
          </p>
        </div>
      </div>

      {/* Primary KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <span className="text-xs text-neutral-500 font-medium">Today's Sales</span>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-2">{formatPrice(todaySales)}</p>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">Live updated</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <span className="text-xs text-neutral-500 font-medium">Weekly Sales (7D)</span>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-2">{formatPrice(weeklySales)}</p>
          <span className="text-[10px] text-neutral-400 mt-1 inline-block">Rolling 7-day window</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <span className="text-xs text-neutral-500 font-medium">Monthly Sales (MTD)</span>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-2">{formatPrice(monthlySales)}</p>
          <span className="text-[10px] text-neutral-400 mt-1 inline-block">Current calendar month</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <span className="text-xs text-neutral-500 font-medium">Yearly Sales (YTD)</span>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-2">{formatPrice(yearlySales)}</p>
          <span className="text-[10px] text-neutral-400 mt-1 inline-block">Annual cumulative</span>
        </div>
      </div>

      {/* Date Range & Product Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-700">
            <Calendar className="w-4 h-4 text-neutral-400" />
            <span className="font-semibold">Date Range:</span>
          </div>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />

          <span className="text-neutral-400 text-xs">to</span>

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-600 hover:underline ml-2"
            >
              Clear dates
            </button>
          )}

          {/* Product Filter */}
          <div className="ml-auto w-full sm:w-64">
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="all">All Catalog Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Period Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-100 text-xs">
          <div className="flex justify-between items-center p-2.5 bg-neutral-50 rounded-xl">
            <span className="text-neutral-500">Period Revenue:</span>
            <span className="font-mono font-bold text-neutral-900 text-sm">
              {formatPrice(filteredTotalRevenue)}
            </span>
          </div>
          <div className="flex justify-between items-center p-2.5 bg-neutral-50 rounded-xl">
            <span className="text-neutral-500">Period Orders:</span>
            <span className="font-mono font-bold text-neutral-900 text-sm">
              {filteredOrderCount}
            </span>
          </div>
          <div className="flex justify-between items-center p-2.5 bg-neutral-50 rounded-xl">
            <span className="text-neutral-500">Average Order Value:</span>
            <span className="font-mono font-bold text-neutral-900 text-sm">
              {formatPrice(averageOrderValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Product Performance Table (Requirement 35) */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900">Product Sales Breakdown</h2>
          <span className="text-xs text-neutral-500">{productSalesMap.length} products with sales</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-center">Total Units Sold</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
                <th className="py-3 px-4 text-right">Last Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {productSalesMap.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    No sales recorded for the selected filter.
                  </td>
                </tr>
              ) : (
                productSalesMap.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/70">
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      <Link href={`/admin/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-neutral-600">{p.sku}</td>

                    <td className="py-3.5 px-4 text-center font-bold font-mono text-neutral-800">
                      {p.unitsSold} units
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold font-mono text-neutral-900">
                      {formatPrice(p.revenue)}
                    </td>

                    <td className="py-3.5 px-4 text-right text-neutral-500">
                      {new Date(p.lastSale).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales by Date Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200">
          <h2 className="text-sm font-bold text-neutral-900">Sales Timeline by Date</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Orders Count</th>
                <th className="py-3 px-4 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {salesByDate.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-neutral-400">
                    No sales recorded for this timeframe.
                  </td>
                </tr>
              ) : (
                salesByDate.map((row, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/70">
                    <td className="py-3 px-4 font-medium text-neutral-800">{row.date}</td>
                    <td className="py-3 px-4 text-center font-mono">{row.ordersCount}</td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-neutral-900">
                      {formatPrice(row.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
