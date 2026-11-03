export const tokens = {
  color: {
    primary: '#C45C26',
    primaryPressed: '#A34B1E',
    surface: '#F7F3EE',
    card: '#FFFFFF',
    text: '#1F1B16',
    textMuted: '#7A7168',
    border: '#E6DFD6',
    danger: '#C0392B',
    progress: '#C45C26',
  },
  space: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
  },
  font: {
    title: 36,
    body: 28,
    caption: 24,
  },
} as const

export type Tokens = typeof tokens
