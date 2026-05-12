export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'lumina-theme'

export function getInitialTheme(): ThemeMode {
  try {
    const stored = window.localStorage?.getItem?.(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // Storage can be unavailable in private browsing or mocked test environments.
  }
  return 'light'
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  try {
    window.localStorage?.setItem?.(STORAGE_KEY, theme)
  } catch {
    // Theme still applies for the current session if persistence is unavailable.
  }
}

export function initializeTheme(): void {
  applyTheme(getInitialTheme())
}
