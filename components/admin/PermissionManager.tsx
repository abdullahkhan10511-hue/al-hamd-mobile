'use client';

import React, { useState, useMemo } from 'react';
import { PermissionItem, PermissionModule } from '@/types/admin';
import {
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  PERMISSION_PRESETS,
  detectMatchedPreset,
  ALL_PERMISSION_KEYS,
} from '@/lib/constants/permissions';
import {
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Shield,
  Layers,
  Check,
  X,
  Filter,
} from 'lucide-react';

interface PermissionManagerProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function PermissionManager({
  selectedPermissions,
  onChange,
  disabled = false,
  className = '',
}: PermissionManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  // Active preset detection
  const activePreset = useMemo(
    () => detectMatchedPreset(selectedPermissions),
    [selectedPermissions]
  );

  const selectedSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);

  // Filtered permissions based on search query
  const filteredPermissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_PERMISSIONS;
    return ALL_PERMISSIONS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group permissions by module
  const groupedByModule = useMemo(() => {
    const map = new Map<PermissionModule, PermissionItem[]>();
    for (const mod of PERMISSION_MODULES) {
      const items = filteredPermissions.filter((p) => p.module === mod);
      if (items.length > 0) {
        map.set(mod, items);
      }
    }
    return map;
  }, [filteredPermissions]);

  // Handlers
  const handleTogglePermission = (key: string) => {
    if (disabled) return;
    if (selectedSet.has(key)) {
      onChange(selectedPermissions.filter((k) => k !== key && k !== '*'));
    } else {
      onChange([...selectedPermissions.filter((k) => k !== '*'), key]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChange([...ALL_PERMISSION_KEYS]);
  };

  const handleDeselectAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const handleSelectModule = (mod: PermissionModule) => {
    if (disabled) return;
    const modKeys = ALL_PERMISSIONS.filter((p) => p.module === mod).map((p) => p.key);
    const combined = Array.from(new Set([...selectedPermissions.filter((k) => k !== '*'), ...modKeys]));
    onChange(combined);
  };

  const handleDeselectModule = (mod: PermissionModule) => {
    if (disabled) return;
    const modKeySet = new Set(ALL_PERMISSIONS.filter((p) => p.module === mod).map((p) => p.key));
    onChange(selectedPermissions.filter((k) => !modKeySet.has(k) && k !== '*'));
  };

  const handleApplyPreset = (presetId: string) => {
    if (disabled) return;
    const preset = PERMISSION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (preset.id === 'preset-custom') return;
    onChange([...preset.permissions]);
  };

  const toggleModuleCollapse = (mod: string) => {
    setCollapsedModules((prev) => ({
      ...prev,
      [mod]: !prev[mod],
    }));
  };

  const expandAll = () => setCollapsedModules({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    for (const mod of PERMISSION_MODULES) {
      allCollapsed[mod] = true;
    }
    setCollapsedModules(allCollapsed);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. PRESETS TOOLBAR */}
      <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Permission Presets</span>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            Active: <strong className="text-neutral-900 bg-white px-2 py-0.5 rounded-md border border-neutral-200">{activePreset}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PERMISSION_PRESETS.map((preset) => {
            const isMatch = activePreset === preset.name;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => handleApplyPreset(preset.id)}
                title={preset.description}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isMatch
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isMatch && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SEARCH & BULK ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search permissions by name, key, or category..."
            className="w-full pl-9 pr-8 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          <button
            type="button"
            disabled={disabled}
            onClick={handleSelectAll}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-semibold text-[11px] cursor-pointer disabled:opacity-50"
          >
            Select All ({ALL_PERMISSIONS.length})
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleDeselectAll}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-neutral-500 font-semibold text-[11px] cursor-pointer disabled:opacity-50"
          >
            Deselect All
          </button>
          <div className="h-4 w-px bg-neutral-200 mx-1" />
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-1.5 text-neutral-500 hover:text-neutral-900 font-medium text-[11px] cursor-pointer"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-1.5 text-neutral-500 hover:text-neutral-900 font-medium text-[11px] cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* SUMMARY BADGE */}
      <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
        <span>
          Showing <strong>{filteredPermissions.length}</strong> of {ALL_PERMISSIONS.length} permissions
        </span>
        <span className="font-semibold text-neutral-800">
          <strong className="text-emerald-700">{selectedPermissions.length}</strong> permissions granted
        </span>
      </div>

      {/* 3. ACCORDION CATEGORIES */}
      <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
        {groupedByModule.size === 0 ? (
          <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
            <Filter className="w-8 h-8 mx-auto text-neutral-400 mb-2 opacity-50" />
            <p className="text-xs font-semibold text-neutral-600">No matching permissions found</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Try adjusting your search query or clear the filter.
            </p>
          </div>
        ) : (
          Array.from(groupedByModule.entries()).map(([moduleName, items]) => {
            const isCollapsed = Boolean(collapsedModules[moduleName]);
            const modSelectedCount = items.filter((p) => selectedSet.has(p.key)).length;
            const allModSelected = items.length > 0 && modSelectedCount === items.length;

            return (
              <div
                key={moduleName}
                className="bg-neutral-50/80 rounded-2xl border border-neutral-200 overflow-hidden transition-all"
              >
                {/* Category Header */}
                <div className="px-4 py-3 bg-neutral-100/70 border-b border-neutral-200 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleModuleCollapse(moduleName)}
                    className="flex items-center gap-2 text-left cursor-pointer flex-1 group"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-700 transition-transform" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-600 group-hover:text-neutral-900 transition-transform" />
                    )}
                    <span className="font-bold text-xs uppercase tracking-tight text-neutral-900">
                      {moduleName}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        modSelectedCount > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-neutral-200 text-neutral-500'
                      }`}
                    >
                      {modSelectedCount} / {items.length}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      disabled={disabled || allModSelected}
                      onClick={() => handleSelectModule(moduleName)}
                      className="text-neutral-700 hover:text-neutral-900 font-semibold cursor-pointer disabled:opacity-40"
                    >
                      Select All
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      disabled={disabled || modSelectedCount === 0}
                      onClick={() => handleDeselectModule(moduleName)}
                      className="text-neutral-400 hover:text-rose-600 font-semibold cursor-pointer disabled:opacity-40"
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                {/* Category Items */}
                {!isCollapsed && (
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white">
                    {items.map((perm) => {
                      const isChecked = selectedSet.has(perm.key) || selectedSet.has('*');

                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none text-left ${
                            isChecked
                              ? 'bg-emerald-50/50 border-emerald-200/80 hover:bg-emerald-50'
                              : 'bg-white border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50/50'
                          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={disabled}
                            onChange={() => handleTogglePermission(perm.key)}
                            className="mt-0.5 h-4 w-4 rounded-md border-neutral-300 text-neutral-900 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-neutral-900 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-neutral-900 text-xs block leading-tight">
                                {perm.name}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-neutral-400 block truncate mt-0.5">
                              {perm.key}
                            </span>
                            <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                              {perm.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

