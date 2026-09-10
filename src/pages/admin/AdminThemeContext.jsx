import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const ADMIN_THEME_STORAGE_KEY = 'ez_admin_theme_v2';

const AdminThemeContext = createContext(null);

export function readStoredAdminTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

export function AdminThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredAdminTheme);

  const setTheme = useCallback((next) => {
    setThemeState(next === 'light' ? 'light' : 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
    document.body.dataset.adminTheme = theme;
    document.body.style.background = theme === 'light' ? '#f4f6f8' : '#0e1117';
    document.body.style.color = theme === 'light' ? '#1f2328' : '#ffffff';
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isLight: theme === 'light' }),
    [theme, setTheme, toggleTheme]
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return ctx;
}

/** For login page (outside provider) — same hook shape without requiring provider */
export function useAdminThemeStandalone() {
  const [theme, setThemeState] = useState(readStoredAdminTheme);

  const setTheme = useCallback((next) => {
    setThemeState(next === 'light' ? 'light' : 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
    document.body.dataset.adminTheme = theme;
    document.body.style.background = theme === 'light' ? '#f4f6f8' : '#0e1117';
    document.body.style.color = theme === 'light' ? '#1f2328' : '#ffffff';
  }, [theme]);

  return useMemo(
    () => ({ theme, setTheme, toggleTheme, isLight: theme === 'light' }),
    [theme, setTheme, toggleTheme]
  );
}
