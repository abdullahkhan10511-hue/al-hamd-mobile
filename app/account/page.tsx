'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  Package,
  Heart,
  ShoppingCart,
  Star,
  Lock,
  LogOut,
  ChevronRight,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  X,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatPrice } from '@/lib/utils';
import { getCustomerOrdersForCustomer } from '@/lib/db/customers';
import {
  getCustomerReviews,
  getEligibleUnreviewedProducts,
  submitCustomerReview,
  updateCustomerReview,
  deleteCustomerReview,
  EligibleReviewProduct,
} from '@/lib/db/reviews';
import { Order } from '@/types/admin';
import { ProductReview } from '@/types';

type AccountTab = 'overview' | 'orders' | 'wishlist' | 'reviews' | 'details' | 'password';

function AccountDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AccountTab | null;
  const reviewProductParam = searchParams.get('reviewProductId');

  const { customer, isAuthenticated, isLoading, logout, updateProfile, changePassword } =
    useCustomerAuth();
  const { cart, totalItems, addToCart } = useCart();
  const { wishlistProducts, toggleWishlist } = useWishlist();

  const [activeTab, setActiveTab] = useState<AccountTab>(tabParam || 'overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [eligibleProducts, setEligibleProducts] = useState<EligibleReviewProduct[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Sync tab with URL
  useEffect(() => {
    if (tabParam && ['overview', 'orders', 'wishlist', 'reviews', 'details', 'password'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // If customer is not authenticated, redirect to /login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login?redirect=/account');
    }
  }, [isLoading, isAuthenticated, router]);

  // Load customer orders, reviews, and eligible unreviewed products
  const loadCustomerData = useCallback(async () => {
    if (!customer) return;
    setIsDataLoading(true);
    try {
      const [userOrders, userReviews, userEligible] = await Promise.all([
        getCustomerOrdersForCustomer(customer.id),
        getCustomerReviews(customer.id),
        getEligibleUnreviewedProducts(customer.id),
      ]);
      setOrders(userOrders);
      setReviews(userReviews);
      setEligibleProducts(userEligible);
    } catch (err) {
      console.error('Error loading customer account data:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    if (customer) {
      loadCustomerData();
    }
  }, [customer, loadCustomerData]);

  // Profile Edit Form State
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileProvince, setProfileProvince] = useState('');
  const [profilePostalCode, setProfilePostalCode] = useState('');
  const [profileDob, setProfileDob] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (customer) {
      setProfileFirstName(customer.firstName || '');
      setProfileLastName(customer.lastName || '');
      setProfilePhone(customer.phone || '');
      setProfileAddress(customer.address || '');
      setProfileCity(customer.city || '');
      setProfileProvince(customer.province || 'Punjab');
      setProfilePostalCode(customer.postalCode || '');
      setProfileDob(customer.dateOfBirth || '');
    }
  }, [customer]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');

    if (!profileFirstName.trim()) {
      setProfileError('First name is required.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({
        firstName: profileFirstName,
        lastName: profileLastName,
        phone: profilePhone,
        address: profileAddress,
        city: profileCity,
        province: profileProvince,
        postalCode: profilePostalCode,
        dateOfBirth: profileDob,
      });
      setProfileSuccess('Profile and shipping details updated successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      setPasswordSuccess(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [reviewProduct, setReviewProduct] = useState<EligibleReviewProduct | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewModalError, setReviewModalError] = useState('');

  // Auto-open review modal if reviewProductId param provided
  useEffect(() => {
    if (reviewProductParam && eligibleProducts.length > 0) {
      const matched = eligibleProducts.find((p) => p.productId === reviewProductParam);
      if (matched) {
        openReviewModal(matched);
      }
    }
  }, [reviewProductParam, eligibleProducts]);

  const openReviewModal = (item: EligibleReviewProduct) => {
    setEditingReview(null);
    setReviewProduct(item);
    setReviewRating(5);
    setReviewTitle('');
    setReviewComment('');
    setReviewModalError('');
    setReviewModalOpen(true);
  };

  const openEditReviewModal = (rev: ProductReview) => {
    setEditingReview(rev);
    setReviewProduct({
      productId: rev.productId || '',
      productName: rev.productName || 'Purchased Product',
      productImage: rev.productImage || '',
      orderId: '',
      orderDate: rev.date,
    });
    setReviewRating(rev.rating);
    setReviewTitle(rev.title);
    setReviewComment(rev.comment);
    setReviewModalError('');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setReviewModalError('');

    if (!reviewTitle.trim() || !reviewComment.trim()) {
      setReviewModalError('Please provide both a review headline and description.');
      return;
    }

    setReviewSubmitting(true);
    try {
      if (editingReview) {
        await updateCustomerReview(customer.id, editingReview.id, {
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment,
        });
      } else if (reviewProduct) {
        await submitCustomerReview({
          customerId: customer.id,
          customerEmail: customer.email || '',
          authorName: `${customer.firstName} ${customer.lastName}`.trim(),
          productId: reviewProduct.productId,
          productName: reviewProduct.productName,
          productImage: reviewProduct.productImage,
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment,
        });
      }
      setReviewModalOpen(false);
      await loadCustomerData();
    } catch (err: any) {
      setReviewModalError(err?.message || 'Could not save review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!customer) return;
    if (!confirm('Are you sure you want to delete this verified review?')) return;
    try {
      await deleteCustomerReview(customer.id, reviewId);
      await loadCustomerData();
    } catch (err) {
      console.error('Delete review error:', err);
    }
  };

  // Order Details Modal State (Quick view)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleSignOut = () => {
    logout();
    router.push('/');
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'processing':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'confirmed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  if (isLoading || (!isAuthenticated && !customer)) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">Loading your account...</span>
        </div>
      </div>
    );
  }

  const customerFullName = `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Valued Customer';

  return (
    <div className="min-h-screen bg-neutral-50/60 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Welcome Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-950 text-white flex items-center justify-center text-xl font-bold uppercase shadow-sm">
              {customer?.firstName?.[0] || 'C'}
              {customer?.lastName?.[0] || ''}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Verified Customer</span>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight mt-0.5">
                Welcome, {customerFullName}
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                {customer?.email} • Member since{' '}
                {customer?.createdAt
                  ? new Date(customer.createdAt).toLocaleDateString('en-PK', {
                      month: 'short',
                      year: 'numeric',
                    })
                  : '2026'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/shop"
              className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Shop</span>
            </Link>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CUSTOMER SIDEBAR NAVIGATION */}
          <aside className="lg:col-span-3 bg-white p-3 rounded-3xl border border-neutral-200/80 shadow-xs space-y-1">
            <button
              type="button"
              id="tab-btn-overview"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <User className="w-4 h-4" />
                <span>My Account</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>

            <button
              type="button"
              id="tab-btn-orders"
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4" />
                <span>My Orders</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'orders' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-wishlist"
              onClick={() => setActiveTab('wishlist')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'wishlist'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4" />
                <span>My Wishlist</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'wishlist' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {wishlistProducts.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-reviews"
              onClick={() => setActiveTab('reviews')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4" />
                <span>My Reviews</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'reviews' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {reviews.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-details"
              onClick={() => setActiveTab('details')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'details'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4" />
                <span>Account Details</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>

            <button
              type="button"
              id="tab-btn-password"
              onClick={() => setActiveTab('password')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4" />
                <span>Change Password</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>

            <div className="pt-3 border-t border-neutral-100 mt-2">
              <button
                type="button"
                id="customer-logout-button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>

          {/* MAIN TAB CONTENT */}
          <main className="lg:col-span-9 space-y-6">
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div
                    onClick={() => setActiveTab('orders')}
                    className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs space-y-2 cursor-pointer hover:border-neutral-950 transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        My Orders
                      </span>
                      <h3 className="text-2xl font-black text-neutral-950">{orders.length}</h3>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-medium inline-flex items-center gap-1">
                      <span>View history</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>

                  <div
                    onClick={() => setActiveTab('wishlist')}
                    className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs space-y-2 cursor-pointer hover:border-neutral-950 transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        Wishlist
                      </span>
                      <h3 className="text-2xl font-black text-neutral-950">{wishlistProducts.length}</h3>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-medium inline-flex items-center gap-1">
                      <span>Saved items</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>

                  <Link
                    href="/cart"
                    className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs space-y-2 cursor-pointer hover:border-neutral-950 transition-all block"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        My Cart
                      </span>
                      <h3 className="text-2xl font-black text-neutral-950">{totalItems}</h3>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-medium inline-flex items-center gap-1">
                      <span>Go to cart</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>

                  <div
                    onClick={() => setActiveTab('reviews')}
                    className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs space-y-2 cursor-pointer hover:border-neutral-950 transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Star className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        My Reviews
                      </span>
                      <h3 className="text-2xl font-black text-neutral-950">{reviews.length}</h3>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-medium inline-flex items-center gap-1">
                      <span>Manage reviews</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Recent Orders Preview */}
                <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <h2 className="text-base font-bold text-neutral-950">Recent Orders</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-bold text-neutral-900 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>View All ({orders.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-900">No orders placed yet</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          When you checkout, your order history and tracking updates will appear here.
                        </p>
                      </div>
                      <Link
                        href="/shop"
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider"
                      >
                        Start Shopping
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {orders.slice(0, 3).map((ord) => (
                        <div key={ord.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-950">#{ord.id}</span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                                  ord.status
                                )}`}
                              >
                                {ord.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500">
                              {new Date(ord.createdAt).toLocaleDateString('en-PK', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}{' '}
                              • {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'} •{' '}
                              <strong className="text-neutral-900">{formatPrice(ord.total)}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(ord)}
                              className="px-3.5 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-800 hover:bg-neutral-50 transition-colors cursor-pointer"
                            >
                              Quick View
                            </button>
                            <Link
                              href={`/account/orders/${ord.id}`}
                              className="px-3.5 py-1.5 rounded-xl bg-neutral-950 text-white text-xs font-bold hover:bg-neutral-850 transition-colors cursor-pointer"
                            >
                              Details
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Shipping & Contact Snapshot */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                        Default Shipping Details
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className="text-[11px] font-bold text-neutral-900 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="text-xs text-neutral-700 space-y-1">
                      <p className="font-bold text-neutral-950">{customerFullName}</p>
                      <p>{customer?.address || 'No street address saved'}</p>
                      <p>
                        {customer?.city ? `${customer.city}, ` : ''}
                        {customer?.province ? `${customer.province} ` : ''}
                        {customer?.postalCode || ''}
                      </p>
                      <p className="text-neutral-500">Phone: {customer?.phone || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                        Account Security
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('password')}
                        className="text-[11px] font-bold text-neutral-900 hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                    <div className="text-xs text-neutral-700 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Salted SHA-256 Authentication Active</span>
                      </div>
                      <p className="text-neutral-500 text-[11px] leading-relaxed">
                        Your password is cryptographically protected and never exposed in plain text.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MY ORDERS */}
            {activeTab === 'orders' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div>
                    <h2 className="text-xl font-black text-neutral-950 tracking-tight">Order History</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Review your previous and in-transit orders with real-time tracking status.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-neutral-100 text-neutral-800">
                    {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
                  </span>
                </div>

                {orders.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">No Orders Found</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        You have not placed any orders under this account yet. Explore our genuine mobile accessories catalog to place your first order.
                      </p>
                    </div>
                    <Link
                      href="/shop"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Start Shopping</span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-5 rounded-2xl border border-neutral-200 hover:border-neutral-300 transition-all space-y-4"
                      >
                        {/* Order Meta Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-neutral-950">Order #{ord.id}</span>
                            <span
                              className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                                ord.status
                              )}`}
                            >
                              {ord.status}
                            </span>
                          </div>

                          <div className="text-xs text-neutral-500 flex items-center gap-3">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                              <span>
                                {new Date(ord.createdAt).toLocaleDateString('en-PK', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-neutral-800 uppercase">
                              {ord.paymentMethod === 'cod' ? 'Cash on Delivery' : ord.paymentMethod}
                            </span>
                          </div>
                        </div>

                        {/* Items Thumbnail Grid */}
                        <div className="flex flex-wrap items-center gap-3">
                          {ord.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-50 border border-neutral-100"
                            >
                              <div className="w-10 h-10 rounded-lg bg-white overflow-hidden relative shrink-0 border border-neutral-200">
                                {item.image && typeof item.image === 'string' && item.image.trim() ? (
                                  <Image src={item.image.trim()} alt={item.productName} fill className="object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-neutral-400">
                                    Item
                                  </div>
                                )}
                              </div>
                              <div className="text-xs pr-2 max-w-[140px] truncate">
                                <p className="font-bold text-neutral-900 truncate">{item.productName}</p>
                                <p className="text-[11px] text-neutral-500">Qty: {item.quantity}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Order Footer & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block">
                              Total Amount
                            </span>
                            <span className="text-lg font-black text-neutral-950">
                              {formatPrice(ord.total)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(ord)}
                              className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-800 hover:bg-neutral-50 transition-colors cursor-pointer"
                            >
                              Quick View
                            </button>
                            <Link
                              href={`/account/orders/${ord.id}`}
                              className="px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-850 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <span>Full Details</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: MY WISHLIST */}
            {activeTab === 'wishlist' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div>
                    <h2 className="text-xl font-black text-neutral-950 tracking-tight">Saved Wishlist</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Keep track of items you plan to purchase or gift.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-neutral-100 text-neutral-800">
                    {wishlistProducts.length} Saved
                  </span>
                </div>

                {wishlistProducts.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                      <Heart className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">Your Wishlist is Empty</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        Tap the heart icon on any product across AL-HAMD to save items here for later checkout.
                      </p>
                    </div>
                    <Link
                      href="/shop"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Discover Products</span>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wishlistProducts.map((prod) => (
                      <div
                        key={prod.id}
                        className="p-4 rounded-2xl border border-neutral-200 hover:border-neutral-300 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-3">
                          <Link
                            href={`/product/${prod.slug}`}
                            className="w-full aspect-square rounded-xl bg-neutral-100 overflow-hidden relative block group"
                          >
                            {prod.images?.[0] && typeof prod.images[0] === 'string' && prod.images[0].trim() ? (
                              <Image
                                src={prod.images[0].trim()}
                                alt={prod.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
                                No Image
                              </div>
                            )}
                          </Link>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                              {prod.brand || 'Accessories'}
                            </span>
                            <Link href={`/product/${prod.slug}`}>
                              <h3 className="text-xs font-bold text-neutral-950 hover:underline truncate">
                                {prod.name}
                              </h3>
                            </Link>
                            <p className="text-xs font-black text-neutral-950 mt-1">
                              {formatPrice(prod.price)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                          <button
                            type="button"
                            onClick={() => {
                              addToCart(prod, 1);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(prod.id)}
                            className="p-2 rounded-xl border border-neutral-200 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove from wishlist"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: MY REVIEWS */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {/* Eligible Unreviewed Products */}
                {eligibleProducts.length > 0 && (
                  <div className="bg-amber-50/70 border border-amber-200/80 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
                      <h3 className="text-sm font-bold text-amber-950">
                        Purchased Items Awaiting Your Verified Review ({eligibleProducts.length})
                      </h3>
                    </div>
                    <p className="text-xs text-amber-900/80">
                      As an authenticated buyer, your feedback helps the AL-HAMD community discover the best accessories.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {eligibleProducts.map((ep) => (
                        <div
                          key={ep.productId}
                          className="p-3.5 rounded-2xl bg-white border border-amber-200/60 shadow-xs flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-neutral-100 overflow-hidden relative shrink-0 border border-neutral-200">
                              {ep.productImage && typeof ep.productImage === 'string' && ep.productImage.trim() ? (
                                <Image src={ep.productImage.trim()} alt={ep.productName} fill className="object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">
                                  Item
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-neutral-900 truncate">
                                {ep.productName}
                              </h4>
                              <p className="text-[10px] text-neutral-500">Order #{ep.orderId}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => openReviewModal(ep)}
                            className="px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-[11px] uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
                          >
                            Write Review
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submitted Reviews List */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                    <div>
                      <h2 className="text-xl font-black text-neutral-950 tracking-tight">
                        Your Submitted Reviews
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Manage your verified-purchase product ratings and feedback.
                      </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-neutral-100 text-neutral-800">
                      {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                    </span>
                  </div>

                  {reviews.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                        <Star className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-900">No Reviews Submitted Yet</h3>
                        <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                          Once your ordered items are delivered, you can submit verified customer reviews right here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {reviews.map((rev) => (
                        <div key={rev.id} className="py-5 first:pt-0 last:pb-0 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5 text-amber-500">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < rev.rating ? 'fill-amber-500 text-amber-500' : 'text-neutral-200'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-bold text-neutral-900">{rev.rating}.0 / 5.0</span>
                              {rev.verified && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Verified Purchase</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditReviewModal(rev)}
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 cursor-pointer"
                                title="Edit review"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteReview(rev.id)}
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Delete review"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-black text-neutral-950">{rev.title}</h4>
                            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{rev.comment}</p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                            <span>Product: <strong className="text-neutral-700">{rev.productName || 'Genuine Accessory'}</strong></span>
                            <span>
                              {new Date(rev.date).toLocaleDateString('en-PK', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: ACCOUNT DETAILS */}
            {activeTab === 'details' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
                <div>
                  <h2 className="text-xl font-black text-neutral-950 tracking-tight">Account Details</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Update your personal information and default shipping destination.
                  </p>
                </div>

                {profileSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{profileSuccess}</span>
                  </div>
                )}

                {profileError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">First Name</label>
                      <input
                        type="text"
                        required
                        value={profileFirstName}
                        onChange={(e) => setProfileFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">Last Name</label>
                      <input
                        type="text"
                        value={profileLastName}
                        onChange={(e) => setProfileLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">Email Address</label>
                      <input
                        type="email"
                        disabled
                        value={customer?.email || ''}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-500 cursor-not-allowed text-xs"
                      />
                      <span className="text-[10px] text-neutral-400 mt-1 block">
                        Primary account identifier cannot be altered directly.
                      </span>
                    </div>

                    <div>
                      <label className="font-bold text-neutral-800 block mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-100">
                    <h3 className="font-bold text-neutral-900 mb-3">Shipping Address</h3>

                    <div className="space-y-3">
                      <div>
                        <label className="font-semibold text-neutral-700 block mb-1">
                          Street Address / House / Flat No.
                        </label>
                        <input
                          type="text"
                          value={profileAddress}
                          onChange={(e) => setProfileAddress(e.target.value)}
                          placeholder="e.g. House 42, Street 8, Sector F-7/2"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-semibold text-neutral-700 block mb-1">City</label>
                          <input
                            type="text"
                            value={profileCity}
                            onChange={(e) => setProfileCity(e.target.value)}
                            placeholder="Islamabad / Lahore / Karachi"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-neutral-700 block mb-1">Province</label>
                          <select
                            value={profileProvince}
                            onChange={(e) => setProfileProvince(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                          >
                            <option value="Punjab">Punjab</option>
                            <option value="Sindh">Sindh</option>
                            <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                            <option value="Balochistan">Balochistan</option>
                            <option value="Federal Capital">Federal Capital (Islamabad)</option>
                            <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                            <option value="Azad Jammu & Kashmir">Azad Jammu & Kashmir</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-neutral-700 block mb-1">Postal Code</label>
                          <input
                            type="text"
                            value={profilePostalCode}
                            onChange={(e) => setProfilePostalCode(e.target.value)}
                            placeholder="e.g. 44000"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-neutral-700 block mb-1">
                      Date of Birth <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="date"
                      value={profileDob}
                      onChange={(e) => setProfileDob(e.target.value)}
                      className="w-full max-w-xs px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-6 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProfile ? 'Saving Details...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB: CHANGE PASSWORD */}
            {activeTab === 'password' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6 max-w-xl">
                <div>
                  <h2 className="text-xl font-black text-neutral-950 tracking-tight">Change Password</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Update your account authentication credentials securely.
                  </p>
                </div>

                {passwordSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-neutral-800 block mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-neutral-800 block mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-neutral-800 block mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-6 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isChangingPassword ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* QUICK VIEW ORDER MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 pr-10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Quick View
                </span>
                <h3 className="text-xl font-black text-neutral-950">Order #{selectedOrder.id}</h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadge(
                  selectedOrder.status
                )}`}
              >
                {selectedOrder.status}
              </span>
            </div>

            {/* Item list */}
            <div className="divide-y divide-neutral-100">
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-neutral-100 overflow-hidden relative shrink-0 border border-neutral-200">
                    {item.image && typeof item.image === 'string' && item.image.trim() ? (
                      <Image src={item.image.trim()} alt={item.productName} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">
                        Item
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-neutral-900 truncate">{item.productName}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {formatPrice(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-neutral-950">
                    {formatPrice(item.total || item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total and Full Page Link */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Grand Total
                </span>
                <span className="text-xl font-black text-neutral-950">
                  {formatPrice(selectedOrder.total)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <Link
                  href={`/account/orders/${selectedOrder.id}`}
                  className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Open Full Order</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WRITE / EDIT REVIEW MODAL */}
      {reviewModalOpen && reviewProduct && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Buyer Review</span>
              </span>
              <h3 className="text-xl font-black text-neutral-950 mt-0.5">
                {editingReview ? 'Edit Your Review' : 'Write Product Review'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 truncate">
                For: <strong className="text-neutral-800">{reviewProduct.productName}</strong>
              </p>
            </div>

            {reviewModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{reviewModalError}</span>
              </div>
            )}

            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-neutral-800 block mb-1.5">Overall Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      type="button"
                      key={starVal}
                      onClick={() => setReviewRating(starVal)}
                      className="p-1 text-amber-400 hover:text-amber-500 transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          starVal <= reviewRating ? 'fill-amber-500 text-amber-500' : 'text-neutral-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-neutral-700 ml-2">
                    {reviewRating} of 5 Stars
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Review Headline</label>
                <input
                  type="text"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="e.g. Excellent build quality and fast charging"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Your Detailed Experience</label>
                <textarea
                  rows={4}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Tell other shoppers what you like about the product, build quality, performance, and delivery."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-bold text-xs uppercase tracking-wider hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                >
                  {reviewSubmitting ? 'Submitting...' : editingReview ? 'Save Changes' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-xs text-neutral-500">
          Loading Customer Account...
        </div>
      }
    >
      <AccountDashboardContent />
    </Suspense>
  );
}
