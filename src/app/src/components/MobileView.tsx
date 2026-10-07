import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Stack,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Fab,
  Tooltip,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  alpha,
} from '@mui/material';

import MicIcon from '@mui/icons-material/Mic';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import AbcIcon from '@mui/icons-material/Abc';
import RadioIcon from '@mui/icons-material/Radio';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import FormatSizeIcon from '@mui/icons-material/FormatSize';

import type {
  SubtitleItem,
  WeddingContextData,
  SubtitleLayoutMode,
  SubtitleFontStyle,
  TranslationSessionInfo,
  ViewMode,
} from '../types';

interface MobileViewProps {
  subtitles: SubtitleItem[];
  activePartial: SubtitleItem | null;
  wedding: WeddingContextData;
  sessionInfo?: TranslationSessionInfo;
  isDarkTheme?: boolean;
  onToggleTheme?: () => void;
  onOpenQrCode?: () => void;
  onSelectView?: (view: ViewMode) => void;
  onOpenNewSession?: () => void;
  isSessionActive?: boolean;
}

const PREFS_KEY = 'stones_wedding_guest_prefs';

function loadGuestPrefs(): { layoutMode: SubtitleLayoutMode; fontStyle: SubtitleFontStyle; fontSize: 'normal' | 'large' } {
  const fallback = { layoutMode: 'stacked' as const, fontStyle: 'serif' as const, fontSize: 'normal' as const };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    return {
      layoutMode: ['stacked', 'side-by-side', 'english'].includes(saved.layoutMode) ? saved.layoutMode : fallback.layoutMode,
      fontStyle: ['serif', 'sans'].includes(saved.fontStyle) ? saved.fontStyle : fallback.fontStyle,
      fontSize: ['normal', 'large'].includes(saved.fontSize) ? saved.fontSize : fallback.fontSize,
    };
  } catch {
    return fallback;
  }
}

export const MobileView: React.FC<MobileViewProps> = ({
  subtitles,
  activePartial,
  wedding,
  sessionInfo,
  isDarkTheme = true,
  onToggleTheme,
  onOpenQrCode,
  onSelectView,
  onOpenNewSession,
  isSessionActive = false,
}) => {
  const [layoutMode, setLayoutModeState] = useState<SubtitleLayoutMode>(() => loadGuestPrefs().layoutMode);
  const [fontStyle, setFontStyleState] = useState<SubtitleFontStyle>(() => loadGuestPrefs().fontStyle);
  const [fontSize, setFontSizeState] = useState<'normal' | 'large'>(() => loadGuestPrefs().fontSize);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyText = (id: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCardId(id);
      setTimeout(() => setCopiedCardId(null), 2000);
    });
  };

  const setLayoutMode = (mode: SubtitleLayoutMode) => {
    setLayoutModeState(mode);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ layoutMode: mode, fontStyle, fontSize }));
    } catch {
      // Ignore private mode storage failure
    }
  };

  const setFontStyle = (style: SubtitleFontStyle) => {
    setFontStyleState(style);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ layoutMode, fontStyle: style, fontSize }));
    } catch {
      // Ignore private mode storage failure
    }
  };

  const setFontSize = (size: 'normal' | 'large') => {
    setFontSizeState(size);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ layoutMode, fontStyle, fontSize: size }));
    } catch {
      // Ignore private mode storage failure
    }
  };

  // Screen WakeLock
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestLock = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Ignored
      }
    };

    requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) requestLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      sentinel?.release().catch(() => {});
    };
  }, []);

  const isNearBottom = () => {
    const el = bottomRef.current;
    return !!el && el.getBoundingClientRect().bottom - window.innerHeight < 64;
  };

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [subtitles, activePartial, autoScroll]);

  useEffect(() => {
    const isVisible = () => !!bottomRef.current?.offsetParent;
    const pauseIfAway = () => {
      if (!isVisible()) return;
      requestAnimationFrame(() => {
        if (!isNearBottom()) setAutoScroll(false);
      });
    };
    const resumeIfAtBottom = () => {
      if (isVisible() && isNearBottom()) setAutoScroll(true);
    };
    window.addEventListener('wheel', pauseIfAway, { passive: true });
    window.addEventListener('touchmove', pauseIfAway, { passive: true });
    window.addEventListener('scroll', resumeIfAtBottom, { passive: true });
    return () => {
      window.removeEventListener('wheel', pauseIfAway);
      window.removeEventListener('touchmove', pauseIfAway);
      window.removeEventListener('scroll', resumeIfAtBottom);
    };
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${wedding.bride_name} & ${wedding.groom_name}’s Wedding Subtitles`,
          text: `Live English speech translation for ${wedding.bride_name} & ${wedding.groom_name}’s wedding at Stones of the Yarra Valley`,
          url,
        });
      } catch {
        // User dismissed
      }
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const isDark = isDarkTheme;
  const zhFontSx = {
    fontFamily: fontStyle === 'serif' ? '"Source Serif 4", Georgia, serif' : 'inherit',
    fontSize: fontSize === 'large' ? '1.15rem' : '1rem',
    lineHeight: 1.6,
  };
  const enFontSx = {
    fontFamily: fontStyle === 'serif' ? '"Source Serif 4", Georgia, serif' : 'inherit',
    fontSize: fontSize === 'large' ? '1.5rem' : '1.2rem',
    lineHeight: 1.5,
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100dvh - 4rem)',
        pb: { xs: 12, md: 6 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2 } }}>
        {/* Google 4-Color Accent Bar */}
        <Box
          className="google-gradient-bar"
          sx={{
            width: 72,
            height: 4,
            borderRadius: '999px',
            mx: 'auto',
            mt: 2,
            mb: 2.5,
          }}
        />

        {/* Host / Speaker Quick Start Banner */}
        {onSelectView && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 3,
              borderRadius: '24px',
              border: '1.5px solid',
              borderColor: isDark ? 'rgba(168, 199, 250, 0.3)' : 'rgba(11, 87, 208, 0.25)',
              bgcolor: isDark
                ? alpha('#0B57D0', 0.15)
                : alpha('#D3E3FD', 0.5),
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  bgcolor: isDark ? '#A8C7FA' : '#0B57D0',
                  color: isDark ? '#041E49' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <MicIcon />
              </Box>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: isDark ? '#E2E2E6' : '#1F1F1F',
                    fontSize: '0.9rem',
                  }}
                >
                  Speaking or Hosting?
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: isDark ? '#C4C6D0' : '#444746',
                    fontSize: '0.8rem',
                  }}
                >
                  Switch to the <strong>Speaker Deck</strong> to broadcast your microphone and generate live translation.
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => onSelectView('speaker')}
                startIcon={<MicIcon />}
                fullWidth
                sx={{
                  borderRadius: '999px',
                  fontWeight: 600,
                  px: 2.5,
                  py: 0.85,
                  textTransform: 'none',
                  fontSize: '0.825rem',
                }}
              >
                Open Speaker Deck
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Wedding Venue & Couple Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography
            variant="overline"
            sx={{
              display: 'block',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: isDark ? '#A8C7FA' : '#0B57D0',
              fontSize: '0.75rem',
            }}
          >
            Stones of the Yarra Valley • The Stable
          </Typography>

          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              fontFamily: '"Outfit", "Google Sans", sans-serif',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.75rem', sm: '2.25rem' },
              color: isDark ? '#E2E2E6' : '#1F1F1F',
              mt: 0.25,
            }}
          >
            {wedding.bride_name} &amp; {wedding.groom_name}
          </Typography>

          {/* Google Translate Inspired Dual Language Pill */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Paper
              elevation={0}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2.25,
                py: 0.85,
                borderRadius: '999px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E0E2EC',
                bgcolor: isDark ? '#1E1F22' : '#F0F4F9',
                boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <span>🇨🇳</span>
                <span>Mandarin</span>
              </Typography>

              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isDark ? '#004A77' : '#D3E3FD',
                  color: isDark ? '#A8C7FA' : '#041E49',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}
              >
                ⇄
              </Box>

              <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <span>🇬🇧</span>
                <span>English</span>
              </Typography>
            </Paper>
          </Box>

          {/* Session Chip & On Air Indicator */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', alignItems: 'center', mt: 1.5 }}>
            {sessionInfo && (
              <Chip
                label={`Session #${sessionInfo.session_number}: ${sessionInfo.session_title}`}
                size="small"
                sx={{
                  bgcolor: isDark ? alpha('#004A77', 0.6) : alpha('#D3E3FD', 0.7),
                  color: isDark ? '#D3E3FD' : '#041E49',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(127, 207, 255, 0.3)' : 'rgba(11, 87, 208, 0.2)',
                }}
              />
            )}

            {isSessionActive && (
              <Chip
                icon={<RadioIcon sx={{ fontSize: '0.85rem !important' }} />}
                label="LIVE ON AIR"
                size="small"
                color="error"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.04em',
                }}
              />
            )}
          </Stack>

          {/* Quick Actions: Share Link & QR Code */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleShare}
              startIcon={copiedLink ? <CheckIcon sx={{ color: 'success.main' }} /> : <ShareIcon />}
              sx={{
                borderRadius: '999px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.75rem',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E0E2EC',
                color: isDark ? '#C4C6D0' : '#444746',
                '&:hover': {
                  borderColor: isDark ? 'rgba(255,255,255,0.3)' : '#0B57D0',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4F9',
                },
              }}
            >
              {copiedLink ? 'Link Copied' : 'Share Link'}
            </Button>

            {onOpenQrCode && (
              <Button
                variant="outlined"
                size="small"
                onClick={onOpenQrCode}
                startIcon={<QrCode2Icon />}
                sx={{
                  borderRadius: '999px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E0E2EC',
                  color: isDark ? '#C4C6D0' : '#444746',
                  '&:hover': {
                    borderColor: isDark ? 'rgba(255,255,255,0.3)' : '#0B57D0',
                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4F9',
                  },
                }}
              >
                Guest QR
              </Button>
            )}
          </Stack>
        </Box>

        {/* Sticky Android M3 Reading Controls Capsule */}
        <Paper
          elevation={2}
          sx={{
            position: 'sticky',
            top: 76,
            zIndex: 10,
            p: 1,
            px: { xs: 1.5, sm: 2 },
            mb: 3,
            borderRadius: '999px',
            bgcolor: isDark ? alpha('#1E1F22', 0.95) : alpha('#FFFFFF', 0.95),
            backdropFilter: 'blur(16px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          {/* Live Indicator Pill */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pl: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isSessionActive ? 'error.main' : 'success.main',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: isSessionActive
                  ? (isDark ? '#F2B8B5' : '#B3261E')
                  : (isDark ? '#A8C7FA' : '#0B57D0'),
              }}
            >
              {isSessionActive ? 'STREAMING' : 'READY'}
            </Typography>
          </Stack>

          {/* Reading Preferences Toggle Buttons */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {/* Layout Mode (Stacked / Split / EN) */}
            <ToggleButtonGroup
              size="small"
              value={layoutMode}
              exclusive
              onChange={(_, val) => {
                if (val) setLayoutMode(val);
              }}
              sx={{
                bgcolor: isDark ? '#121316' : '#F0F4F9',
                borderRadius: '999px',
                p: 0.25,
                '& .MuiToggleButton-root': {
                  borderRadius: '999px !important',
                  border: 'none',
                  px: { xs: 1, sm: 1.5 },
                  py: 0.4,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  color: isDark ? '#C4C6D0' : '#444746',
                  '&.Mui-selected': {
                    bgcolor: isDark ? '#A8C7FA' : '#0B57D0',
                    color: isDark ? '#041E49' : '#FFFFFF',
                    '&:hover': {
                      bgcolor: isDark ? '#D3E3FD' : '#0842A0',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="stacked" aria-label="Stacked Chinese and English">
                <TableRowsIcon sx={{ fontSize: '1rem', mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Stacked</Box>
              </ToggleButton>
              <ToggleButton value="side-by-side" aria-label="Split View" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <ViewWeekIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                <span>Split</span>
              </ToggleButton>
              <ToggleButton value="english" aria-label="English Only">
                <AbcIcon sx={{ fontSize: '1.1rem', mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>EN</Box>
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Font Serif / Sans Toggle */}
            <Tooltip title={fontStyle === 'serif' ? 'Switch to Sans-serif font' : 'Switch to Serif font'}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
                sx={{
                  borderRadius: '999px',
                  minWidth: 36,
                  height: 32,
                  px: 1.25,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E2EC',
                  color: isDark ? '#C4C6D0' : '#444746',
                }}
              >
                {fontStyle === 'serif' ? 'Serif' : 'Sans'}
              </Button>
            </Tooltip>

            {/* Font Size Toggle */}
            <Tooltip title="Toggle Larger Subtitle Size">
              <IconButton
                size="small"
                onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: fontSize === 'large'
                    ? (isDark ? '#A8C7FA' : '#0B57D0')
                    : (isDark ? '#121316' : '#F0F4F9'),
                  color: fontSize === 'large'
                    ? (isDark ? '#041E49' : '#FFFFFF')
                    : (isDark ? '#C4C6D0' : '#444746'),
                }}
              >
                <FormatSizeIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>

            {/* Theme Toggle */}
            {onToggleTheme && (
              <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                <IconButton
                  size="small"
                  onClick={onToggleTheme}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: isDark ? '#121316' : '#F0F4F9',
                    color: isDark ? '#C4C6D0' : '#444746',
                  }}
                >
                  {isDark ? <LightModeIcon sx={{ fontSize: '1rem' }} /> : <DarkModeIcon sx={{ fontSize: '1rem' }} />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Paper>

        {/* Translation Subtitle Cards Feed */}
        <Stack spacing={2.5}>
          {subtitles.length === 0 && !activePartial ? (
            <Card
              elevation={0}
              sx={{
                py: 8,
                px: 3,
                textAlign: 'center',
                borderRadius: '28px',
                border: '1px dashed',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#C4C6D0',
                bgcolor: isDark ? '#1E1F22' : '#FFFFFF',
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: isDark ? alpha('#A8C7FA', 0.15) : alpha('#0B57D0', 0.1),
                  color: isDark ? '#A8C7FA' : '#0B57D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: '1.75rem' }} />
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontFamily: '"Outfit", "Google Sans", sans-serif',
                  color: isDark ? '#E2E2E6' : '#1F1F1F',
                  mb: 1,
                }}
              >
                Welcome to the Celebration
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: isDark ? '#C4C6D0' : '#444746',
                  maxWidth: 360,
                  mx: 'auto',
                  lineHeight: 1.6,
                }}
              >
                Live English subtitles will stream to your screen automatically when speech begins.
              </Typography>
            </Card>
          ) : (
            <>
              {subtitles.map((item) => (
                <Card
                  key={item.id}
                  elevation={isDark ? 0 : 1}
                  sx={{
                    borderRadius: '24px',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E0E2EC',
                    bgcolor: isDark ? '#1E1F22' : '#FFFFFF',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: isDark ? 'rgba(168, 199, 250, 0.3)' : 'rgba(11, 87, 208, 0.3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2 } }}>
                    {/* Meta Header */}
                    <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip
                        label={`#${item.id}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: isDark ? alpha('#A8C7FA', 0.15) : alpha('#0B57D0', 0.1),
                          color: isDark ? '#A8C7FA' : '#0B57D0',
                        }}
                      />
                      <Typography variant="caption" sx={{ color: isDark ? '#8E9199' : '#74777F', fontFamily: 'monospace' }}>
                        {item.timestamp}
                      </Typography>
                    </Stack>

                    {layoutMode === 'side-by-side' ? (
                      /* Split Card Layout */
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '5fr 7fr' },
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                            <Chip
                              label="ZH"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                bgcolor: isDark ? '#282A2E' : '#E9EEF6',
                                color: isDark ? '#C4C6D0' : '#444746',
                              }}
                            />
                            <Typography variant="caption" sx={{ color: isDark ? '#8E9199' : '#74777F' }}>
                              Mandarin
                            </Typography>
                          </Stack>
                          <Typography sx={{ color: isDark ? '#C4C6D0' : '#444746', ...zhFontSx }}>
                            {item.chinese || '—'}
                          </Typography>
                        </Box>

                        <Box sx={{ borderLeft: { sm: '1px solid' }, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E0E2EC', pl: { sm: 2 } }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                            <Chip
                              label="EN"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                bgcolor: isDark ? '#004A77' : '#D3E3FD',
                                color: isDark ? '#A8C7FA' : '#041E49',
                              }}
                            />
                            <Typography variant="caption" sx={{ color: isDark ? '#A8C7FA' : '#0B57D0', fontWeight: 600 }}>
                              English
                            </Typography>
                          </Stack>
                          <Typography sx={{ color: isDark ? '#E2E2E6' : '#1F1F1F', fontWeight: 600, ...enFontSx }}>
                            {item.english}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      /* Stacked Card Layout */
                      <Stack spacing={1.5}>
                        {layoutMode !== 'english' && item.chinese && (
                          <Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                              <Chip
                                label="ZH"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  bgcolor: isDark ? '#282A2E' : '#E9EEF6',
                                  color: isDark ? '#C4C6D0' : '#444746',
                                }}
                              />
                              <Typography variant="caption" sx={{ color: isDark ? '#8E9199' : '#74777F' }}>
                                Spoken Mandarin
                              </Typography>
                            </Stack>
                            <Typography sx={{ color: isDark ? '#C4C6D0' : '#444746', ...zhFontSx }}>
                              {item.chinese}
                            </Typography>
                          </Box>
                        )}

                        <Box>
                          {layoutMode !== 'english' && (
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                              <Chip
                                label="EN"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  bgcolor: isDark ? '#004A77' : '#D3E3FD',
                                  color: isDark ? '#A8C7FA' : '#041E49',
                                }}
                              />
                              <Typography variant="caption" sx={{ color: isDark ? '#A8C7FA' : '#0B57D0', fontWeight: 600 }}>
                                English Translation
                              </Typography>
                            </Stack>
                          )}
                          <Typography sx={{ color: isDark ? '#E2E2E6' : '#1F1F1F', fontWeight: 600, ...enFontSx }}>
                            {item.english}
                          </Typography>
                        </Box>
                      </Stack>
                    )}

                    {/* Google Translate Action Bar */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 1.5,
                        mt: 1.5,
                        borderTop: '1px solid',
                        borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F4F9',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: isDark ? '#8E9199' : '#74777F', fontSize: '0.7rem' }}>
                        Google Translate UX
                      </Typography>

                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          onClick={() => handleSpeak(item.english)}
                          startIcon={<VolumeUpIcon sx={{ fontSize: '0.95rem !important' }} />}
                          sx={{
                            borderRadius: '999px',
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isDark ? '#C4C6D0' : '#444746',
                            '&:hover': {
                              color: isDark ? '#A8C7FA' : '#0B57D0',
                              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4F9',
                            },
                          }}
                        >
                          Listen
                        </Button>

                        <Button
                          size="small"
                          onClick={() => handleCopyText(item.id, item.english)}
                          startIcon={
                            copiedCardId === item.id ? (
                              <CheckIcon sx={{ fontSize: '0.95rem !important', color: 'success.main' }} />
                            ) : (
                              <ContentCopyIcon sx={{ fontSize: '0.95rem !important' }} />
                            )
                          }
                          sx={{
                            borderRadius: '999px',
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isDark ? '#C4C6D0' : '#444746',
                            '&:hover': {
                              color: isDark ? '#A8C7FA' : '#0B57D0',
                              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4F9',
                            },
                          }}
                        >
                          {copiedCardId === item.id ? 'Copied' : 'Copy'}
                        </Button>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              ))}

              {/* Real-time Live Interpretation Bubble */}
              {activePartial && (
                <Card
                  elevation={3}
                  sx={{
                    borderRadius: '24px',
                    border: '2px solid',
                    borderColor: isDark ? '#A8C7FA' : '#0B57D0',
                    bgcolor: isDark ? '#1E1F22' : '#FFFFFF',
                    boxShadow: isDark
                      ? '0 4px 24px rgba(168, 199, 250, 0.2)'
                      : '0 4px 24px rgba(11, 87, 208, 0.15)',
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: isDark ? '#A8C7FA' : '#0B57D0',
                            animation: 'pulse 1.2s infinite',
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: isDark ? '#A8C7FA' : '#0B57D0',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Live Interpreting...
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: isDark ? '#8E9199' : '#74777F', fontFamily: 'monospace' }}>
                        {activePartial.timestamp}
                      </Typography>
                    </Stack>

                    {activePartial.chinese && layoutMode !== 'english' && (
                      <Typography sx={{ color: isDark ? '#C4C6D0' : '#444746', mb: 1, ...zhFontSx }}>
                        {activePartial.chinese}
                      </Typography>
                    )}

                    <Typography sx={{ color: isDark ? '#E2E2E6' : '#1F1F1F', fontWeight: 600, ...enFontSx }}>
                      {activePartial.english}
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: 8,
                          height: 18,
                          ml: 0.75,
                          verticalAlign: 'middle',
                          bgcolor: isDark ? '#A8C7FA' : '#0B57D0',
                          animation: 'pulse 1s infinite',
                        }}
                      />
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div ref={bottomRef} style={{ scrollMarginBottom: 32 }} />
        </Stack>

        {/* Wedding Congratulatory Footer */}
        <Box
          sx={{
            pt: 6,
            pb: 4,
            textAlign: 'center',
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E0E2EC',
            mt: 6,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: isDark ? '#8E9199' : '#74777F' }}>
            Stones of the Yarra Valley • The Stable
          </Typography>
          <Typography variant="caption" sx={{ color: isDark ? '#C4C6D0' : '#444746' }}>
            Wishing Joy &amp; Xinrong a lifetime of happiness
          </Typography>
        </Box>
      </Container>

      {/* Floating Auto-Scroll Button (Android M3 FAB) */}
      {!autoScroll && (
        <Fab
          color="primary"
          size="medium"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          sx={{
            position: 'fixed',
            bottom: { xs: 80, sm: 32 },
            right: 24,
            zIndex: 30,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            bgcolor: isDark ? '#A8C7FA' : '#0B57D0',
            color: isDark ? '#041E49' : '#FFFFFF',
            '&:hover': {
              bgcolor: isDark ? '#D3E3FD' : '#0842A0',
            },
          }}
        >
          <KeyboardArrowDownIcon />
        </Fab>
      )}

      {/* Android M3 Native Bottom Navigation Bar */}
      {onSelectView && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
            bgcolor: isDark ? alpha('#121316', 0.96) : alpha('#FFFFFF', 0.96),
            backdropFilter: 'blur(16px)',
          }}
        >
          <BottomNavigation
            showLabels
            value="mobile"
            onChange={(_, newValue) => {
              if (newValue === 'new-session') {
                if (onOpenNewSession) onOpenNewSession();
              } else {
                onSelectView(newValue as ViewMode);
              }
            }}
            sx={{
              bgcolor: 'transparent',
              height: 64,
              '& .MuiBottomNavigationAction-root': {
                color: isDark ? '#8E9199' : '#74777F',
                minWidth: 'auto',
                py: 0.75,
                '&.Mui-selected': {
                  color: isDark ? '#A8C7FA' : '#0B57D0',
                  fontWeight: 700,
                },
              },
            }}
          >
            <BottomNavigationAction
              label="Guest View"
              value="mobile"
              icon={<PhoneIphoneIcon sx={{ fontSize: '1.25rem' }} />}
            />
            <BottomNavigationAction
              label="Speaker Deck"
              value="speaker"
              icon={<MicIcon sx={{ fontSize: '1.25rem' }} />}
            />
            <BottomNavigationAction
              label="Projector"
              value="projector"
              icon={<DesktopWindowsIcon sx={{ fontSize: '1.25rem' }} />}
            />
            {onOpenNewSession && (
              <BottomNavigationAction
                label="New Session"
                value="new-session"
                icon={<AddCircleOutlinedIcon sx={{ fontSize: '1.25rem' }} />}
              />
            )}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
};
