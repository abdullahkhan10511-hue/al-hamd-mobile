'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, LogIn } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AdminError Boundary Caught]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Something went wrong
          </h2>
          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
            An unexpected error occurred in the Admin Panel. You can reload this view or log in again.
          </p>
          {error?.message && (
            <div className="mt-3 p-2.5 bg-neutral-950/80 border border-neutral-800/80 rounded-lg text-[11px] font-mono text-rose-300/90 text-left overflow-x-auto max-h-24">
              {error.message}
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                reset();
              } catch {
                window.location.reload();
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs tracking-wider uppercase transition-colors shadow-md cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>

          <Link
            href="/admin/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log in again</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

