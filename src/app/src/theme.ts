import { createTheme, type Theme } from '@mui/material/styles';

export function getAppTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#A8C7FA' : '#0B57D0',
        light: isDark ? '#D3E3FD' : '#4285F4',
        dark: isDark ? '#70A5F9' : '#0842A0',
        contrastText: isDark ? '#041E49' : '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#94A3B8' : '#64748B',
        light: '#CBD5E1',
        dark: '#475569',
        contrastText: isDark ? '#0F172A' : '#FFFFFF',
      },
      success: {
        main: isDark ? '#4ADE80' : '#16A34A',
        light: '#86EFAC',
        dark: '#15803D',
        contrastText: isDark ? '#052E16' : '#FFFFFF',
      },
      warning: {
        main: isDark ? '#FBBF24' : '#D97706',
        light: '#FDE68A',
        dark: '#B45309',
        contrastText: '#18181B',
      },
      error: {
        main: isDark ? '#F87171' : '#DC2626',
        light: '#FECACA',
        dark: '#B91C1C',
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#090A0B' : '#FAFAFA',
        paper: isDark ? '#121316' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F4F4F5' : '#18181B',
        secondary: isDark ? '#A1A1AA' : '#71717A',
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    },
    typography: {
      fontFamily: '"Outfit", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h1: {
        fontWeight: 600,
        letterSpacing: '-0.03em',
      },
      h2: {
        fontWeight: 600,
        letterSpacing: '-0.025em',
      },
      h3: {
        fontWeight: 600,
        letterSpacing: '-0.02em',
      },
      h4: {
        fontWeight: 600,
        letterSpacing: '-0.015em',
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
      subtitle1: {
        fontWeight: 500,
        letterSpacing: '-0.01em',
      },
      subtitle2: {
        fontWeight: 500,
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.65,
      },
      body2: {
        fontSize: '0.84375rem',
        lineHeight: 1.55,
      },
      button: {
        textTransform: 'none',
        fontWeight: 550,
        letterSpacing: '0.01em',
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? '#27272A #090A0B' : '#D4D4D8 #FAFAFA',
            '&::-webkit-scrollbar': {
              width: 6,
              height: 6,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
              borderRadius: 9999,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 9999,
            padding: '7px 18px',
            boxShadow: 'none',
            fontSize: '0.84375rem',
            transition: 'all 0.15s ease',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          contained: {
            backgroundColor: isDark ? '#A8C7FA' : '#0B57D0',
            color: isDark ? '#041E49' : '#FFFFFF',
            '&:hover': {
              backgroundColor: isDark ? '#D3E3FD' : '#0842A0',
            },
          },
          outlined: {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
            color: isDark ? '#F4F4F5' : '#18181B',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 18,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'}`,
            boxShadow: isDark
              ? '0 1px 2px rgba(0, 0, 0, 0.5)'
              : '0 1px 3px rgba(0, 0, 0, 0.04)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'}`,
            boxShadow: 'none',
            backgroundImage: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 9999,
            fontWeight: 500,
            fontSize: '0.75rem',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
            boxShadow: isDark ? '0 16px 48px rgba(0, 0, 0, 0.7)' : '0 16px 48px rgba(0, 0, 0, 0.08)',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: '0.75rem',
            padding: '5px 10px',
            backgroundColor: isDark ? '#27272A' : '#18181B',
            color: '#FFFFFF',
          },
          arrow: {
            color: isDark ? '#27272A' : '#18181B',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8125rem',
            minHeight: 36,
            borderRadius: 9999,
            margin: '0 2px',
            padding: '6px 14px',
            transition: 'all 0.15s ease',
          },
        },
      },
    },
  });
}
