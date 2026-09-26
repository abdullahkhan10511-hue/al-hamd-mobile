'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog } from '@/types/admin';
import { getActivityLogs, logActivity } from '@/lib/db/activity';
import {
  History,
  Search,
  Calendar,
  User,
  Shield,
  Clock,
  ArrowRight,
  Filter,
  ArrowUpDown,
  X,
} from 'lucide-react';

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const loadData = () => {
    setLogs(getActivityLogs());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Defensive filtering & sorting ensuring no duplicate entries or runtime null crashes
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return logs
      .filter((l) => {
        if (!l || !l.id) return false;

        // Module filter
        if (selectedModule !== 'all') {
          const combined = `${l.action} ${l.target} ${l.details || ''}`.toLowerCase();
          if (selectedModule === 'products' && !combined.includes('product') && !combined.includes('stock') && !combined.includes('inventory')) {
            return false;
          }
          if (selectedModule === 'orders' && !combined.includes('order')) {
            return false;
          }
          if (selectedModule === 'staff' && !combined.includes('staff') && !combined.includes('role') && !combined.includes('auth') && !combined.includes('permission')) {
            return false;
          }
          if (selectedModule === 'settings' && !combined.includes('setting') && !combined.includes('social') && !combined.includes('payment') && !combined.includes('shipping')) {
            return false;
          }
          if (selectedModule === 'pages' && !combined.includes('page') && !combined.includes('legal')) {
            return false;
          }
        }

        // Search query
        if (!q) return true;
        const action = (l.action || '').toLowerCase();
        const target = (l.target || '').toLowerCase();
        const email = (l.adminEmail || '').toLowerCase();
        const details = (l.details || '').toLowerCase();
        return action.includes(q) || target.includes(q) || email.includes(q) || details.includes(q);
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [logs, searchQuery, selectedModule, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Audit & Activity Log</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Immutable chronicle of administrative actions, pricing edits, category changes, and stock movements
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="bg-white px-4 py-2 rounded-xl border border-neutral-200 text-xs flex items-center gap-2">
            <History className="w-4 h-4 text-neutral-500" />
            <span className="text-neutral-500">Logged Events:</span>
            <span className="font-bold text-neutral-900">{logs.length}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search, Module Filter, Sort */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 flex items-center gap-2">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter logs by admin email, action keyword, or target..."
            className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none placeholder:text-neutral-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Module Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100">
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'products', label: 'Products' },
            { id: 'orders', label: 'Orders' },
            { id: 'staff', label: 'Staff & Auth' },
            { id: 'settings', label: 'Settings' },
            { id: 'pages', label: 'Pages & Legal' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedModule(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedModule === tab.id
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Sort Order Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer ml-1"
            title={`Sort by timestamp (${sortOrder === 'desc' ? 'Newest First' : 'Oldest First'})`}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Admin Operator</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Operation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    No activity logs match your filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-neutral-900">
                        <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{log.adminEmail}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-neutral-900">
                      {log.target}
                    </td>

                    <td className="py-3.5 px-4 text-neutral-600">
                      {log.details || 'Standard modification executed'}
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
