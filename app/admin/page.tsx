'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingBag,
  Package,
  AlertTriangle,
  XCircle,
  Users,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ChevronRight,
  Plus,
  Printer,
  Layers,
} from 'lucide-react';
import { getOrders } from '@/lib/db/orders';
import { getProducts, getLowStockProducts, getOutOfStockProducts } from '@/lib/db/products';
import { subscribeToKey } from '@/lib/db/storage';
import { formatPrice } from '@/lib/utils';
import { Order } from '@/types/admin';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function AdminDashboardPage() {
  const { admin, isManager, isSuperAdmin, hasPermission } = useAdminAuth();
  const [orders, setOrders] = useState(getOrders());
  const [products, setProducts] = useState(getProducts());

  const canViewProducts = hasPermission('products.view');
  const canAddProducts = hasPermission('products.add');
  const canViewInventory = hasPermission('inventory.view');
  const canViewOrders = hasPermission('orders.view');
  const canViewCustomers = hasPermission('customers.view');
  const canViewPromotions = hasPermission('promotions.view');
  const canViewCategories = hasPermission('categories.view');

  useEffect(() => {
    const unsubOrders = subscribeToKey('orders', (data: Order[]) => setOrders(data));
    const unsubProducts = subscribeToKey('products', (data: any) => setProducts(data));
    return () => {
      unsubOrders();
      unsubProducts();
    };
  }, []);

  // Compute metrics
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(today));
  const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);

  const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
  const processingOrders = orders.filter((o) => o.status === 'Processing' || o.status === 'Confirmed').length;
  const packedOrders = orders.filter((o) => o.status === 'Packed').length;
  const shippedOrders = orders.filter((o) => o.status === 'Shipped').length;
  const outForDeliveryOrders = orders.filter((o) => o.status === 'Out for Delivery').length;
  const completedOrders = orders.filter((o) => o.status === 'Delivered').length;

  const lowStockProducts = getLowStockProducts();
  const outOfStockProducts = getOutOfStockProducts();
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

  // Unique customers count
  const customerEmails = new Set(
    orders.map((o) =>
      o.customer.email ? o.customer.email.toLowerCase() : (o.shopName || o.customer.id || o.id)
    )
  );
  const totalCustomers = customerEmails.size;

  // Recent 5 orders
  const recentOrders = orders.slice(0, 6);

  // Top selling products calculated from real order items
  const productSalesMap = new Map<string, { name: string; sku: string; units: number; revenue: number; image: string }>();
  orders.forEach((o) => {
    o.items.forEach((item) => {
      const current = productSalesMap.get(item.productId) || {
        name: item.productName,
        sku: item.sku,
        units: 0,
        revenue: 0,
        image: item.image,
      };
      current.units += item.quantity;
      current.revenue += item.total;
      productSalesMap.set(item.productId, current);
    });
  });

  const topSelling = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  // =========================================================================
  // MANAGER / STAFF OPERATIONAL DASHBOARD (Dynamically scoped to permissions)
  // =========================================================================
  if (!isSuperAdmin) {
    return (
      <div className="space-y-8">
        {/* Staff Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-neutral-50 to-transparent p-6 rounded-3xl border border-amber-200/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                {admin?.role?.toUpperCase() || 'STAFF PANEL'}
              </span>
              <span className="text-xs text-neutral-500 font-mono">
                Logged in as {admin?.name || 'Staff Member'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
              Operational Workspace
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1">
              Authorized modules: {admin?.permissions?.length || 0} active role permissions assigned.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canAddProducts && (
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </Link>
            )}
            {canViewInventory && (
              <Link
                href="/admin/inventory"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-neutral-200 text-neutral-800 font-semibold text-xs hover:bg-neutral-50 transition-colors"
              >
                <Package className="w-4 h-4 text-amber-600" />
                <span>Manage Stock</span>
              </Link>
            )}
            {canViewOrders && (
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-neutral-200 text-neutral-800 font-semibold text-xs hover:bg-neutral-50 transition-colors"
              >
                <ShoppingBag className="w-4 h-4 text-sky-600" />
                <span>Process Orders</span>
              </Link>
            )}
            {canViewCategories && (
              <Link
                href="/admin/categories"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-neutral-200 text-neutral-800 font-semibold text-xs hover:bg-neutral-50 transition-colors"
              >
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Categories</span>
              </Link>
            )}
          </div>
        </div>

        {/* Operational Metrics (Scoped by active permissions) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {canViewProducts && (
            <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Catalog Products</span>
                <Package className="w-4 h-4 text-neutral-700" />
              </div>
              <p className="text-2xl font-extrabold text-neutral-950 font-mono">{products.length}</p>
              <span className="text-[11px] text-neutral-500 font-medium mt-1 block">Active mobile accessories</span>
            </div>
          )}

          {canViewInventory && (
            <>
              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Stock Units</span>
                  <Layers className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-extrabold text-neutral-950 font-mono">{totalStockUnits.toLocaleString()}</p>
                <span className="text-[11px] text-blue-600 font-medium mt-1 block">Physical units on hand</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Low Stock Alert</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-extrabold text-amber-600 font-mono">{lowStockProducts.length}</p>
                <Link href="/admin/inventory" className="text-[11px] text-amber-700 hover:text-amber-900 mt-1 block underline font-medium">
                  Replenish stock levels &rarr;
                </Link>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20">
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Out of Stock</span>
                  <XCircle className="w-4 h-4 text-rose-500" />
                </div>
                <p className="text-2xl font-extrabold text-rose-600 font-mono">{outOfStockProducts.length}</p>
                <span className="text-[11px] text-rose-600 font-medium mt-1 block">Requires immediate restock</span>
              </div>
            </>
          )}

          {canViewOrders && (
            <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
                <ShoppingBag className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-2xl font-extrabold text-neutral-950 font-mono">{orders.length}</p>
              <span className="text-[11px] text-sky-600 font-medium mt-1 block">{pendingOrders} pending verification</span>
            </div>
          )}

          {canViewCustomers && (
            <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Registered Customers</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-neutral-950 font-mono">{totalCustomers}</p>
              <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Active shoppers</span>
            </div>
          )}
        </div>

        {/* Operational Fulfillment Pipeline Bar */}
        {canViewOrders && (
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                  Order Fulfillment Pipeline
                </h2>
                <p className="text-xs text-neutral-400">Track shipments from receipt to customer delivery</p>
              </div>
              <Link href="/admin/orders" className="text-xs font-bold text-neutral-900 hover:underline">
                View All Orders ({orders.length}) &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-center">
                <span className="text-[11px] uppercase font-bold text-amber-700 block">Pending</span>
                <p className="text-2xl font-mono font-extrabold text-amber-900 mt-1">{pendingOrders}</p>
                <span className="text-[10px] text-amber-600 mt-0.5 block">Needs review</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 text-center">
                <span className="text-[11px] uppercase font-bold text-blue-700 block">Processing</span>
                <p className="text-2xl font-mono font-extrabold text-blue-900 mt-1">{processingOrders}</p>
                <span className="text-[10px] text-blue-600 mt-0.5 block">In warehouse</span>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 text-center">
                <span className="text-[11px] uppercase font-bold text-indigo-700 block">Packed</span>
                <p className="text-2xl font-mono font-extrabold text-indigo-900 mt-1">{packedOrders}</p>
                <span className="text-[10px] text-indigo-600 mt-0.5 block">Ready for courier</span>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 text-center">
                <span className="text-[11px] uppercase font-bold text-sky-700 block">Shipped</span>
                <p className="text-2xl font-mono font-extrabold text-sky-900 mt-1">{shippedOrders}</p>
                <span className="text-[10px] text-sky-600 mt-0.5 block">In transit</span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80 text-center">
                <span className="text-[11px] uppercase font-bold text-purple-700 block">Out for Delivery</span>
                <p className="text-2xl font-mono font-extrabold text-purple-900 mt-1">{outForDeliveryOrders}</p>
                <span className="text-[10px] text-purple-600 mt-0.5 block">With rider</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-center">
                <span className="text-[11px] uppercase font-bold text-emerald-700 block">Delivered</span>
                <p className="text-2xl font-mono font-extrabold text-emerald-900 mt-1">{completedOrders}</p>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">Completed</span>
              </div>
            </div>
          </div>
        )}

        {/* Low Stock Replenishment Action Area */}
        {canViewInventory && lowStockProducts.length > 0 && (
          <div className="bg-amber-50/40 rounded-3xl border border-amber-200/70 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-neutral-950 uppercase tracking-tight">
                  Stock Attention Required ({lowStockProducts.length} items low or out)
                </h3>
              </div>
              <Link href="/admin/inventory" className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline">
                Go to Inventory Management &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {lowStockProducts.slice(0, 3).map((prod) => (
                <div key={prod.id} className="bg-white p-3.5 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                  <div className="truncate">
                    <p className="text-xs font-bold text-neutral-900 truncate">{prod.name}</p>
                    <p className="text-[10px] font-mono text-neutral-400">SKU: {prod.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-amber-100 text-amber-800">
                      {prod.stock} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manager Recent Orders Table */}
        {canViewOrders && (
          <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                  Recent Orders To Process
                </h2>
                <p className="text-xs text-neutral-400">Fulfillment dispatch queue and status updates</p>
              </div>
              <Link
                href="/admin/orders"
                className="text-xs font-semibold text-neutral-900 hover:underline flex items-center gap-1"
              >
                <span>Manage All Orders</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/80 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-100">
                  <tr>
                    <th className="p-4 pl-6">Order ID</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Destination</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Items Count</th>
                    <th className="p-4">Fulfillment Status</th>
                    <th className="p-4 pr-6 text-right">Process</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="p-4 pl-6 font-mono font-bold text-neutral-950">{o.id}</td>
                      <td className="p-4">
                        <span className="font-semibold text-neutral-900 block">
                          {o.customer.firstName} {o.customer.lastName}
                        </span>
                        <span className="text-[10px] text-neutral-400">{o.customer.phone}</span>
                      </td>
                      <td className="p-4 text-neutral-600">
                        <span className="font-medium text-neutral-900">{o.shippingAddress?.city || 'Pakistan'}</span>
                      </td>
                      <td className="p-4 text-neutral-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-neutral-700 font-semibold">{o.items.reduce((s, i) => s + i.quantity, 0)} pcs</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            o.status === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : o.status === 'Shipped'
                              ? 'bg-sky-100 text-sky-800'
                              : o.status === 'Packed'
                              ? 'bg-indigo-100 text-indigo-800'
                              : o.status === 'Out for Delivery'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <span>Process</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // ADMIN / SUPER_ADMIN EXECUTIVE DASHBOARD (Full Analytics & Control)
  // =========================================================================
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
              ADMIN PANEL
            </span>
            <span className="text-xs text-neutral-500 font-mono">Logged in as {admin?.name || 'Administrator'} ({admin?.role || 'SUPER_ADMIN'})</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
            Store Performance
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Real-time analytics, inventory signals, and fulfillment status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-950 text-white font-semibold text-xs tracking-wider uppercase hover:bg-neutral-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </Link>
          <Link
            href="/admin/homepage"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-neutral-200 text-neutral-800 font-semibold text-xs hover:bg-neutral-50 transition-colors"
          >
            <span>Edit Homepage</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid (9 Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-950 font-mono">{formatPrice(totalSales)}</p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Lifetime gross revenue</span>
        </div>

        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-950 font-mono">{formatPrice(todaySales)}</p>
          <span className="text-[11px] text-neutral-400 font-medium mt-1 block">{todayOrders.length} orders today</span>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-neutral-800" />
          </div>
          <p className="text-2xl font-extrabold text-neutral-950 font-mono">{orders.length}</p>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-1">
            <span className="text-amber-600 font-semibold">{pendingOrders} pending</span>
            <span>•</span>
            <span className="text-emerald-600 font-semibold">{completedOrders} delivered</span>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Low Stock Alert</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 font-mono">{lowStockProducts.length}</p>
          <Link href="/admin/inventory" className="text-[11px] text-neutral-500 hover:text-neutral-900 mt-1 block underline">
            Review stock levels
          </Link>
        </div>

        {/* Out of Stock */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Out of Stock</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 font-mono">{outOfStockProducts.length}</p>
          <span className="text-[11px] text-neutral-400 mt-1 block">Unpublished from bag</span>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-medium">Catalog Products</span>
            <p className="text-lg font-bold text-neutral-950 font-mono">{products.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-medium">Total Customers</span>
            <p className="text-lg font-bold text-neutral-950 font-mono">{totalCustomers}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-medium">Pending Orders</span>
            <p className="text-lg font-bold text-amber-600 font-mono">{pendingOrders}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-medium">Completed Orders</span>
            <p className="text-lg font-bold text-emerald-600 font-mono">{completedOrders}</p>
          </div>
        </div>
      </div>

      {/* Visual Charts & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sales Overview Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
                Sales Overview
              </h2>
              <p className="text-xs text-neutral-400">Weekly trajectory across fulfilled orders</p>
            </div>
            <span className="text-xs font-mono font-bold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-full">
              {orders.length > 0 ? '+14.2% Growth' : 'No sales yet'}
            </span>
          </div>

          {/* Responsive SVG Area Chart */}
          <div className="h-56 w-full pt-4">
            {orders.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-neutral-400 text-xs">
                <TrendingUp className="w-8 h-8 text-neutral-300 mb-2" />
                <span>No sales data yet</span>
              </div>
            ) : (
              <>
                <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#09090b" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#09090b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="#f4f4f5" strokeWidth="1" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="#f4f4f5" strokeWidth="1" />
                  <line x1="0" y1="130" x2="500" y2="130" stroke="#f4f4f5" strokeWidth="1" />

                  {/* Area */}
                  <polygon
                    points="0,150 70,120 140,135 210,90 280,105 350,60 420,40 500,30 500,180 0,180"
                    fill="url(#salesGrad)"
                  />
                  {/* Stroke */}
                  <polyline
                    points="0,150 70,120 140,135 210,90 280,105 350,60 420,40 500,30"
                    fill="none"
                    stroke="#09090b"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Data points */}
                  {[[70,120],[140,135],[210,90],[280,105],[350,60],[420,40],[500,30]].map(([x,y], i) => (
                    <circle key={i} cx={x} cy={y} r="4" fill="#09090b" stroke="#ffffff" strokeWidth="2" />
                  ))}
                </svg>
                <div className="flex justify-between text-[10px] font-mono text-neutral-400 mt-2">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top Selling Products (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
              Top Selling Products
            </h2>
            <Link href="/admin/sales" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">
              View All
            </Link>
          </div>

          <div className="divide-y divide-neutral-100">
            {topSelling.length === 0 ? (
              <p className="text-xs text-neutral-400 py-8 text-center">No sales data yet.</p>
            ) : (
              topSelling.map((prod) => (
                <div key={prod.sku} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={prod.image} alt={prod.name} className="w-11 h-11 rounded-xl object-cover border border-neutral-200/80" />
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-neutral-900 truncate">{prod.name}</h4>
                      <p className="text-[10px] text-neutral-400 font-mono">SKU: {prod.sku}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-neutral-950 block">
                      {formatPrice(prod.revenue)}
                    </span>
                    <span className="text-[10px] text-neutral-500">{prod.units} units sold</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-950 uppercase tracking-tight">
              Recent Orders
            </h2>
            <p className="text-xs text-neutral-400">Incoming purchases and fulfillment progress</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-semibold text-neutral-900 hover:underline flex items-center gap-1"
          >
            <span>Manage All Orders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/80 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-100">
              <tr>
                <th className="p-4 pl-6">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Date</th>
                <th className="p-4">Items</th>
                <th className="p-4">Total</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400 text-xs">
                    No orders placed yet.
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="p-4 pl-6 font-mono font-bold text-neutral-950">{o.id}</td>
                    <td className="p-4">
                      <span className="font-semibold text-neutral-900 block">
                        {o.customer.firstName} {o.customer.lastName}
                      </span>
                      <span className="text-[10px] text-neutral-400">{o.customer.email}</span>
                    </td>
                    <td className="p-4 text-neutral-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-neutral-600">{o.items.length} items</td>
                    <td className="p-4 font-mono font-bold text-neutral-950">{formatPrice(o.total)}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          o.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          o.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'Shipped'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-950 hover:text-white transition-colors text-xs font-semibold"
                      >
                        View
                      </Link>
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
