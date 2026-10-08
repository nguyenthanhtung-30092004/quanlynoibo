'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'xvip_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Check saved theme or system preference, default to 'light'
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = saved === 'dark' ? 'dark' : 'light';
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const applyThemeClass = (t: Theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (t === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyThemeClass(newTheme);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
      className="btn-3d flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 btn-3d-white"
      title={theme === 'dark' ? 'Đang ở chế độ Tối (bấm để đổi sang Sáng)' : 'Đang ở chế độ Sáng (bấm để đổi sang Tối)'}
    >
      {theme === 'dark' ? (
        <>
          <span className="flex size-5 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-400">
            <Moon size={14} weight="fill" />
          </span>
          <span className="text-slate-200">Giao diện Tối</span>
        </>
      ) : (
        <>
          <span className="flex size-5 items-center justify-center rounded-md bg-amber-500/20 text-amber-600">
            <Sun size={14} weight="fill" />
          </span>
          <span className="text-slate-700">Giao diện Sáng</span>
        </>
      )}
    </button>
  );
}
