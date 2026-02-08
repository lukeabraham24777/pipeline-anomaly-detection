import { create } from 'zustand';
import type { PriorityLevel } from '@/types';

interface UIStore {
  // Selected anomaly (for map + list interaction)
  selectedMatchId: string | null;
  setSelectedMatchId: (id: string | null) => void;

  // Profile panel
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;

  // Filters
  priorityFilter: PriorityLevel[];
  setPriorityFilter: (filters: PriorityLevel[]) => void;
  togglePriorityFilter: (level: PriorityLevel) => void;

  statusFilter: string[];
  setStatusFilter: (filters: string[]) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Active tab on dashboard
  activeTab: 'map' | 'list' | 'drift' | 'insights';
  setActiveTab: (tab: 'map' | 'list' | 'drift' | 'insights') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedMatchId: null,
  setSelectedMatchId: (id) => set({ selectedMatchId: id }),

  profileOpen: false,
  setProfileOpen: (open) => set({ profileOpen: open }),

  priorityFilter: [],
  setPriorityFilter: (filters) => set({ priorityFilter: filters }),
  togglePriorityFilter: (level) =>
    set((s) => ({
      priorityFilter: s.priorityFilter.includes(level)
        ? s.priorityFilter.filter((l) => l !== level)
        : [...s.priorityFilter, level],
    })),

  statusFilter: [],
  setStatusFilter: (filters) => set({ statusFilter: filters }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  activeTab: 'map',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
