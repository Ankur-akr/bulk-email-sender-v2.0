import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'theme'

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.dataset.theme = theme
    root.style.colorScheme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = (event) => {
      if (!localStorage.getItem(STORAGE_KEY)) setTheme(event.matches ? 'dark' : 'light')
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    toggleTheme: () => setTheme(v => v === 'dark' ? 'light' : 'dark'),
    setTheme,
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
