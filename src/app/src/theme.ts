import { createTheme, type Theme } from '@mui/material/styles';

export function getAppTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#A8C7FA' : '#0B57D0', // Google Material Design 3 Blue
        light: isDark ? '#D3E3FD' : '#4285F4',
        dark: isDark ? '#0842A0' : '#0842A0',
        contrastText: isDark ? '#041E49' : '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#7FCFFF' : '#00639B',
        light: '#C2E7FF',
        dark: '#004A77',
        contrastText: isDark ? '#001D31' : '#FFFFFF',
      },
      success: {
        main: isDark ? '#6DD58C' : '#1E8E3E', // Google Green
        light: '#C4EED0',
        dark: '#0F5223',
        contrastText: isDark ? '#0A3818' : '#FFFFFF',
      },
      warning: {
        main: isDark ? '#FEE180' : '#E37400', // Google Amber
        light: '#FFE082',
        dark: '#B06000',
        contrastText: '#1F1F1F',
      },
      error: {
        main: isDark ? '#F2B8B5' : '#B3261E', // Google Red
        light: '#F9DEDC',
        dark: '#601410',
        contrastText: isDark ? '#601410' : '#FFFFFF',
      },
      background: {
        default: isDark ? '#121316' : '#F8FAFD', // Android 14/15 M3 Background
        paper: isDark ? '#1E1F22' : '#FFFFFF',   // Android M3 Surface
      },
      text: {
        primary: isDark ? '#E2E2E6' : '#1F1F1F', // Google M3 high emphasis
        secondary: isDark ? '#C4C6D0' : '#444746', // Google M3 medium emphasis
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
    },
    typography: {
      fontFamily: '"Outfit", "Google Sans", "Plus Jakarta Sans", "Roboto", system-ui, -apple-system, sans-serif',
      h1: {
        fontFamily: '"Outfit", "Google Sans", sans-serif',
        fontWeight: 600,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontFamily: '"Outfit", "Google Sans", sans-serif',
        fontWeight: 600,
        letterSpacing: '-0.02em',
      },
      h3: {
        fontFamily: '"Outfit", "Google Sans", sans-serif',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontFamily: '"Outfit", "Google Sans", sans-serif',
        fontWeight: 600,
      },
      h5: {
        fontFamily: '"Outfit", "Google Sans", sans-serif',
        fontWeight: 600,
      },
      h6: {
        fontFamily: '"Outfit", "Google Sans", sans-serif',
        fontWeight: 600,
      },
      subtitle1: {
        fontWeight: 500,
      },
      subtitle2: {
        fontWeight: 500,
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.84375rem',
        lineHeight: 1.5,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '0.01em',
      },
    },
    shape: {
      borderRadius: 20, // Android M3 squircle radius
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? '#2B2D33 #121316' : '#C4C7C5 #F8FAFD',
            '&::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              borderRadius: 9999,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 9999, // Google M3 Pill Button
            padding: '8px 20px',
            boxShadow: 'none',
            fontSize: '0.875rem',
            transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
            '&:hover': {
              boxShadow: isDark
                ? '0 2px 10px rgba(168, 199, 250, 0.25)'
                : '0 2px 10px rgba(11, 87, 208, 0.2)',
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
            borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#E0E2EC',
            color: isDark ? '#E2E2E6' : '#1F1F1F',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(168, 199, 250, 0.08)' : 'rgba(11, 87, 208, 0.06)',
              borderColor: isDark ? '#A8C7FA' : '#0B57D0',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 24, // Android M3 Container
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 24,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#E0E2EC'}`,
            boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 2px 12px rgba(11, 87, 208, 0.04)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 9999, // Google Pill Chip
            fontWeight: 500,
            fontSize: '0.78125rem',
            letterSpacing: '0.01em',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 28, // Android M3 Dialog
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC'}`,
            boxShadow: isDark ? '0 12px 40px rgba(0, 0, 0, 0.6)' : '0 12px 40px rgba(11, 87, 208, 0.12)',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 9999,
            fontSize: '0.75rem',
            padding: '6px 12px',
            backgroundColor: isDark ? '#2B2D33' : '#1F1F1F',
            color: '#FFFFFF',
          },
          arrow: {
            color: isDark ? '#2B2D33' : '#1F1F1F',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.84375rem',
            minHeight: 40,
            borderRadius: 9999,
            margin: '0 3px',
            transition: 'all 0.2s ease',
          },
        },
      },
    },
  });
}
