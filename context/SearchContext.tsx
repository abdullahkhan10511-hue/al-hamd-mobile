'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SearchContextType {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Fast Charger',
    'Power Bank',
    'Phone Case',
    'AirPods',
    'USB-C Cable',
  ]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('al_hamd_recent_searches');
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const legacyTerms = new Set(['hoodie', 'air max', 'bottle', 'vase', 'serum']);
        const cleaned = parsed.filter((term) => !legacyTerms.has(term.toLowerCase()));
        if (cleaned.length > 0) {
          setRecentSearches(cleaned);
        }
      }
    } catch (e) {
      console.error('Failed to load recent searches', e);
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      try {
        localStorage.setItem('al_hamd_recent_searches', JSON.stringify(recentSearches));
      } catch (e) {
        console.error('Failed to save recent searches', e);
      }
    }
  }, [recentSearches, hasHydrated]);

  const openSearch = () => setIsSearchOpen(true);
  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const addRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => [
      trimmed,
      ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, 8));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  return (
    <SearchContext.Provider
      value={{
        isSearchOpen,
        openSearch,
        closeSearch,
        searchQuery,
        setSearchQuery,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
