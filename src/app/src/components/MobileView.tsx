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
import { StreamingSubtitleText } from './StreamingSubtitleText';

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

  // Screen WakeLock to keep screen on during wedding speeches
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
      if (document.visibilityState === 'visible' && !sentinel) {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
      }
    };
  }, []);

  // Smooth auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [subtitles, activePartial, autoScroll]);

  // Pause auto-scroll on manual scroll
  useEffect(() => {
    const isNearBottom = () => {
      const threshold = 120;
      const scrollPos = window.innerHeight + window.scrollY;
      return document.documentElement.scrollHeight - scrollPos <= threshold;
    };
    const pauseIfAway = () => {
      if (!isNearBottom()) setAutoScroll(false);
    };
    const resumeIfAtBottom = () => {
      if (isNearBottom()) setAutoScroll(true);
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
    fontSize: fontSize === 'large' ? '1.05rem' : '0.9375rem',
    lineHeight: 1.6,
  };
  const enFontSx = {
    fontFamily: fontStyle === 'serif' ? '"Source Serif 4", Georgia, serif' : 'inherit',
    fontSize: fontSize === 'large' ? '1.35rem' : '1.15rem',
    lineHeight: 1.55,
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100dvh - 4rem)',
        pb: { xs: 12, md: 8 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2 } }}>
        {/* Minimalist Top Notice for Speaker */}
        {onSelectView && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1,
              px: 2,
              mt: 2,
              mb: 2.5,
              borderRadius: '999px',
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
              Speaking or hosting? Broadcast your speech live
            </Typography>
            <Button
              size="small"
              onClick={() => onSelectView('speaker')}
              sx={{
                fontSize: '0.74rem',
                py: 0.25,
                px: 1.5,
                color: isDark ? '#70A5F9' : '#1A73E8',
                fontWeight: 600,
              }}
            >
              Open Speaker Deck →
            </Button>
          </Box>
        )}

        {/* Wedding Couple Header - Minimalist Editorial Aesthetic */}
        <Box sx={{ textAlign: 'center', mt: 3, mb: 3 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              fontSize: '0.7rem',
              mb: 0.5,
            }}
          >
            Stones of the Yarra Valley
          </Typography>

          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 600,
              fontFamily: '"Outfit", sans-serif',
              letterSpacing: '-0.025em',
              fontSize: { xs: '1.75rem', sm: '2.25rem' },
              color: 'text.primary',
            }}
          >
            {wedding.bride_name} &amp; {wedding.groom_name}
          </Typography>

          {/* Minimalist Bilingual Pill */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', alignItems: 'center', mt: 1.5 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.75,
                py: 0.4,
                borderRadius: '999px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.75rem' }}>
                Mandarin ⇄ English Live
              </Typography>
            </Box>

            {sessionInfo && (
              <Chip
                label={`#${sessionInfo.session_number}: ${sessionInfo.session_title}`}
                size="small"
                sx={{
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  height: 24,
                }}
              />
            )}

            {isSessionActive && (
              <Chip
                icon={<RadioIcon sx={{ fontSize: '0.8rem !important' }} />}
                label="LIVE"
                size="small"
                color="error"
                sx={{
                  height: 24,
                  fontSize: '0.68rem',
                  fontWeight: 600,
                }}
              />
            )}
          </Stack>

          {/* Quick Share / QR Actions */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mt: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleShare}
              startIcon={copiedLink ? <CheckIcon sx={{ color: 'success.main' }} /> : <ShareIcon />}
              sx={{
                borderRadius: '999px',
                py: 0.35,
                px: 1.5,
                fontSize: '0.72rem',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                color: 'text.secondary',
              }}
            >
              {copiedLink ? 'Link Copied' : 'Share'}
            </Button>

            {onOpenQrCode && (
              <Button
                variant="outlined"
                size="small"
                onClick={onOpenQrCode}
                startIcon={<QrCode2Icon />}
                sx={{
                  borderRadius: '999px',
                  py: 0.35,
                  px: 1.5,
                  fontSize: '0.72rem',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                  color: 'text.secondary',
                }}
              >
                QR Code
              </Button>
            )}
          </Stack>
        </Box>

        {/* Minimalist Floating Reading Controls Capsule */}
        <Paper
          elevation={0}
          sx={{
            position: 'sticky',
            top: 68,
            zIndex: 10,
            py: 0.75,
            px: { xs: 1.5, sm: 2 },
            mb: 3,
            borderRadius: '999px',
            bgcolor: isDark ? alpha('#121316', 0.9) : alpha('#FFFFFF', 0.9),
            backdropFilter: 'blur(16px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          {/* Status Indicator */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pl: 0.5 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: isSessionActive ? '#EF4444' : '#22C55E',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                fontSize: '0.72rem',
                color: 'text.secondary',
                letterSpacing: '0.04em',
              }}
            >
              {isSessionActive ? 'STREAMING' : 'READY'}
            </Typography>
          </Stack>

          {/* Controls: Layout, Serif/Sans, Size, Theme */}
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <ToggleButtonGroup
              size="small"
              value={layoutMode}
              exclusive
              onChange={(_, val) => {
                if (val) setLayoutMode(val);
              }}
              sx={{
                borderRadius: '999px',
                p: 0.25,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                '& .MuiToggleButton-root': {
                  borderRadius: '999px !important',
                  border: 'none',
                  px: { xs: 1, sm: 1.25 },
                  py: 0.25,
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: isDark ? '#F4F4F5' : '#18181B',
                    color: isDark ? '#090A0B' : '#FFFFFF',
                  },
                },
              }}
            >
              <ToggleButton value="stacked" aria-label="Stacked Chinese and English">
                <TableRowsIcon sx={{ fontSize: '0.9rem', mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Stacked</Box>
              </ToggleButton>
              <ToggleButton value="side-by-side" aria-label="Split View" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <ViewWeekIcon sx={{ fontSize: '0.9rem', mr: 0.5 }} />
                <span>Split</span>
              </ToggleButton>
              <ToggleButton value="english" aria-label="English Only">
                <AbcIcon sx={{ fontSize: '1rem', mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>EN</Box>
              </ToggleButton>
            </ToggleButtonGroup>

            <Tooltip title={fontStyle === 'serif' ? 'Switch to Sans-serif font' : 'Switch to Serif font'}>
              <Button
                size="small"
                onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
                sx={{
                  borderRadius: '999px',
                  minWidth: 32,
                  height: 28,
                  px: 1,
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                }}
              >
                {fontStyle === 'serif' ? 'Serif' : 'Sans'}
              </Button>
            </Tooltip>

            <Tooltip title="Toggle font size">
              <IconButton
                size="small"
                onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
                sx={{
                  width: 28,
                  height: 28,
                  color: fontSize === 'large' ? (isDark ? '#70A5F9' : '#1A73E8') : 'text.secondary',
                }}
              >
                <FormatSizeIcon sx={{ fontSize: '0.95rem' }} />
              </IconButton>
            </Tooltip>

            {onToggleTheme && (
              <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                <IconButton
                  size="small"
                  onClick={onToggleTheme}
                  sx={{ width: 28, height: 28, color: 'text.secondary' }}
                >
                  {isDark ? <LightModeIcon sx={{ fontSize: '0.95rem' }} /> : <DarkModeIcon sx={{ fontSize: '0.95rem' }} />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Paper>

        {/* Translation Subtitles Feed - Clean Minimalist Flow */}
        <Stack spacing={2}>
          {subtitles.length === 0 && !activePartial ? (
            <Box
              sx={{
                py: 10,
                px: 3,
                textAlign: 'center',
                borderRadius: '18px',
                border: '1px dashed',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  mb: 0.5,
                }}
              >
                Welcome to the Celebration
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  maxWidth: 360,
                  mx: 'auto',
                  lineHeight: 1.6,
                }}
              >
                Live English subtitles will stream to your screen automatically when speech begins.
              </Typography>
            </Box>
          ) : (
            <>
              {subtitles.map((item) => (
                <Card
                  key={item.id}
                  sx={{
                    borderRadius: '16px',
                    bgcolor: isDark ? '#121316' : '#FFFFFF',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)',
                    transition: 'border-color 0.15s ease',
                    '&:hover': {
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.16)',
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2 } }}>
                    {layoutMode === 'side-by-side' ? (
                      /* Split View Layout */
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '5fr 7fr' },
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography sx={{ color: 'text.secondary', ...zhFontSx }}>
                            {item.chinese || '—'}
                          </Typography>
                        </Box>
                        <Box sx={{ borderLeft: { sm: '1px solid' }, borderColor: 'divider', pl: { sm: 2 } }}>
                          <Typography sx={{ color: 'text.primary', fontWeight: 550, ...enFontSx }}>
                            {item.english}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      /* Stacked Editorial Layout */
                      <Stack spacing={1}>
                        {layoutMode !== 'english' && item.chinese && (
                          <Typography sx={{ color: 'text.secondary', ...zhFontSx }}>
                            {item.chinese}
                          </Typography>
                        )}
                        <Typography sx={{ color: 'text.primary', fontWeight: 550, ...enFontSx }}>
                          {item.english}
                        </Typography>
                      </Stack>
                    )}

                    {/* Minimalist Micro Action Bar */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 1.25,
                        mt: 1.25,
                        borderTop: '1px solid',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {item.timestamp}
                      </Typography>

                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          onClick={() => handleSpeak(item.english)}
                          sx={{ color: 'text.secondary' }}
                          title="Listen (Speech Synthesis)"
                        >
                          <VolumeUpIcon sx={{ fontSize: '0.95rem' }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyText(item.id, item.english)}
                          sx={{ color: 'text.secondary' }}
                          title="Copy text"
                        >
                          {copiedCardId === item.id ? (
                            <CheckIcon sx={{ fontSize: '0.95rem', color: 'success.main' }} />
                          ) : (
                            <ContentCopyIcon sx={{ fontSize: '0.95rem' }} />
                          )}
                        </IconButton>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              ))}

              {/* Real-time Streaming Live Interpretation Row */}
              {activePartial && (
                <Card
                  sx={{
                    borderRadius: '16px',
                    bgcolor: isDark ? '#141417' : '#FFFFFF',
                    border: '1px solid',
                    borderColor: isDark ? '#70A5F9' : '#1A73E8',
                    position: 'relative',
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            bgcolor: isDark ? '#70A5F9' : '#1A73E8',
                            animation: 'pulse 1.2s infinite',
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: isDark ? '#70A5F9' : '#1A73E8',
                            letterSpacing: '0.04em',
                            fontSize: '0.72rem',
                          }}
                        >
                          LIVE INTERPRETING...
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {activePartial.timestamp}
                      </Typography>
                    </Stack>

                    {layoutMode === 'side-by-side' ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '5fr 7fr' },
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography sx={{ color: 'text.secondary', ...zhFontSx }}>
                            <StreamingSubtitleText
                              text={activePartial.chinese || ''}
                              isChinese
                              showCursor={false}
                            />
                          </Typography>
                        </Box>
                        <Box sx={{ borderLeft: { sm: '1px solid' }, borderColor: 'divider', pl: { sm: 2 } }}>
                          <Typography sx={{ color: 'text.primary', fontWeight: 550, ...enFontSx }}>
                            <StreamingSubtitleText
                              text={activePartial.english}
                              isChinese={false}
                              showCursor
                              cursorColor={isDark ? '#70A5F9' : '#1A73E8'}
                            />
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <>
                        {activePartial.chinese && layoutMode !== 'english' && (
                          <Typography sx={{ color: 'text.secondary', mb: 0.75, ...zhFontSx }}>
                            <StreamingSubtitleText
                              text={activePartial.chinese}
                              isChinese
                              showCursor={false}
                            />
                          </Typography>
                        )}

                        <Typography sx={{ color: 'text.primary', fontWeight: 550, ...enFontSx }}>
                          <StreamingSubtitleText
                            text={activePartial.english}
                            isChinese={false}
                            showCursor
                            cursorColor={isDark ? '#70A5F9' : '#1A73E8'}
                          />
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div ref={bottomRef} style={{ scrollMarginBottom: 32 }} />
        </Stack>

        {/* Minimalist Wedding Footer */}
        <Box
          sx={{
            pt: 6,
            pb: 4,
            textAlign: 'center',
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            mt: 6,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 500, color: 'text.secondary' }}>
            Stones of the Yarra Valley • The Stable
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.8 }}>
            Wishing {wedding.bride_name} &amp; {wedding.groom_name} a lifetime of happiness
          </Typography>
        </Box>
      </Container>

      {/* Floating Auto-Scroll Button */}
      {!autoScroll && (
        <Fab
          size="small"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          sx={{
            position: 'fixed',
            bottom: { xs: 72, sm: 28 },
            right: 20,
            zIndex: 30,
            bgcolor: isDark ? '#F4F4F5' : '#18181B',
            color: isDark ? '#090A0B' : '#FFFFFF',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: isDark ? '#FFFFFF' : '#27272A',
            },
          }}
        >
          <KeyboardArrowDownIcon />
        </Fab>
      )}

      {/* Minimalist Bottom Navigation Bar */}
      {onSelectView && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            bgcolor: isDark ? alpha('#090A0B', 0.94) : alpha('#FAFAFA', 0.94),
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
              height: 56,
              '& .MuiBottomNavigationAction-root': {
                color: 'text.secondary',
                minWidth: 'auto',
                py: 0.5,
                '&.Mui-selected': {
                  color: isDark ? '#F4F4F5' : '#18181B',
                  fontWeight: 600,
                },
              },
            }}
          >
            <BottomNavigationAction
              label="Guest View"
              value="mobile"
              icon={<PhoneIphoneIcon sx={{ fontSize: '1.15rem' }} />}
            />
            <BottomNavigationAction
              label="Speaker Deck"
              value="speaker"
              icon={<MicIcon sx={{ fontSize: '1.15rem' }} />}
            />
            <BottomNavigationAction
              label="Projector"
              value="projector"
              icon={<DesktopWindowsIcon sx={{ fontSize: '1.15rem' }} />}
            />
            {onOpenNewSession && (
              <BottomNavigationAction
                label="New Session"
                value="new-session"
                icon={<AddCircleOutlinedIcon sx={{ fontSize: '1.15rem' }} />}
              />
            )}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
};
