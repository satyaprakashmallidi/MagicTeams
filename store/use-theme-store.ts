import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  systemTheme: boolean;
}

interface ThemeActions {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSystemTheme: (useSystem: boolean) => void;
  toggleTheme: () => void;
}

type ThemeStore = ThemeState & ThemeActions;

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'light',
      systemTheme: false,

      // Actions
      setTheme: (theme) => set({ theme, systemTheme: theme === 'system' }),
      setSystemTheme: (useSystem) => set({ systemTheme: useSystem }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
          systemTheme: false
        })),
    }),
    {
      name: 'theme-storage',
    }
  )
);
