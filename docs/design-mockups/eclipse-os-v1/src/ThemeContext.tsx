import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light' | 'eclipse';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('ec_os_theme') as Theme) || 'dark';
  });

  useEffect(() => {
    // Remove existing theme classes
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-eclipse');
    // Add current theme class
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem('ec_os_theme', theme);
  }, [theme]);

  // Expose to window for quick debugging or hidden commands
  useEffect(() => {
    (window as any).__setEclipseTheme = setTheme;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
