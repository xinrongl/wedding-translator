import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  LinearProgress,
  Alert,
  TextField,
  InputAdornment,
  Snackbar,
  Paper,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { AudioCaptureService, resolveWsUrl } from '../services/audioCapture';
import { decodeGoogleIdToken, loadGoogleIdentityScript, type GoogleIdentityClaims } from '../services/googleAuth';
import type { BackendConfig, SubtitleItem, SubtitleFontStyle, TranslationSessionInfo, WeddingContextData } from '../types';

interface SpeakerConsoleProps {
  subtitles: SubtitleItem[];
  activePartial: SubtitleItem | null;
  wedding: WeddingContextData;
  backendConfig: BackendConfig | null;
  sessionInfo: TranslationSessionInfo;
  clearTranscript: () => Promise<void>;
  exportTranscript: (format: 'markdown' | 'csv') => void;
  onOpenNewSession: () => void;
  onOpenQrCode?: () => void;
  isDarkTheme?: boolean;
}

export const SpeakerConsole: React.FC<SpeakerConsoleProps> = ({
  subtitles,
  activePartial,
  wedding,
  backendConfig,
  sessionInfo,
  clearTranscript,
  exportTranscript,
  onOpenNewSession,
  onOpenQrCode,
  isDarkTheme = true,
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<number | 'active' | null>(null);
  const [speakingId, setSpeakingId] = useState<number | 'active' | null>(null);
  const [fontSizeScale, setFontSizeScale] = useState<'normal' | 'large'>('normal');
  const [feedLayout, setFeedLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [fontStyle, setFontStyle] = useState<SubtitleFontStyle>('serif');
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [idToken, setIdToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<GoogleIdentityClaims | null>(null);

  const audioServiceRef = useRef<AudioCaptureService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const oauthClientId = backendConfig?.google_oauth_client_id ?? null;

  // Google Identity setup
  useEffect(() => {
    if (!oauthClientId) return;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: oauthClientId,
          callback: (response) => {
            setIdToken(response.credential);
            setGoogleUser(decodeGoogleIdToken(response.credential));
            setErrorMessage(null);
          },
        });
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: isDarkTheme ? 'filled_black' : 'outline',
          size: 'medium',
          text: 'signin_with',
        });
      })
      .catch((err: Error) => setErrorMessage(err.message));

    return () => {
      cancelled = true;
    };
  }, [oauthClientId, isDarkTheme]);

  const handleSignOut = () => {
    setIdToken(null);
    setGoogleUser(null);
    window.google?.accounts.id.disableAutoSelect();
  };

  useEffect(() => {
    const service = new AudioCaptureService({
      onAudioLevel: (lvl) => setLocalAudioLevel(lvl),
      onError: (err, code) => {
        setErrorMessage(err.message);
        setIsStreaming(false);
        if (code === 4401) {
          setIdToken(null);
          setGoogleUser(null);
        }
      },
      onStateChange: (state) => {
        setIsStreaming(state);
      },
    });
    audioServiceRef.current = service;

    return () => {
      service.stop();
    };
  }, []);

  // Auto-scroll transcript feed
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtitles, activePartial]);

  const toggleStreaming = async () => {
    setErrorMessage(null);
    const service = audioServiceRef.current;
    if (!service) return;

    if (isStreaming) {
      service.sendStreamEnd();
      service.stop();
      setIsStreaming(false);
    } else {
      if (oauthClientId && !idToken) {
        setErrorMessage('Sign in with an approved Google account first.');
        return;
      }
      try {
        const base = resolveWsUrl('/ws/speaker');
        const wsUrl = idToken ? `${base}?id_token=${encodeURIComponent(idToken)}` : base;
        await service.start(wsUrl);
        setIsStreaming(true);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        setErrorMessage(error.message);
        setIsStreaming(false);
      }
    }
  };

  const toggleMute = () => {
    const service = audioServiceRef.current;
    if (!service) return;
    const nextMuted = !isMuted;
    service.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  // Google Translate Speech Synthesis (Listen TTS)
  const speakTranslation = (text: string, id: number | 'active') => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingId(id);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  };

  // Copy to clipboard with instant feedback
  const copyToClipboard = async (text: string, id: number | 'active') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setSnackbarMessage('Copied translation to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const filteredSubtitles = searchQuery.trim()
    ? subtitles.filter(
        (s) =>
          s.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.chinese.includes(searchQuery)
      )
    : subtitles;

  // Latest or active translation item to showcase in primary translation cards
  const latestFinal = subtitles.length > 0 ? subtitles[subtitles.length - 1] : null;
  const currentDisplayChinese = activePartial?.chinese || latestFinal?.chinese || '';
  const currentDisplayEnglish = activePartial?.english || latestFinal?.english || '';

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, sm: 3, md: 4 }, pb: 8 }}>
      <Stack spacing={3.5}>
        {/* Minimalist Language & Session Action Bar */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.25 },
            bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
            border: '1px solid',
            borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Language Pair */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: isDarkTheme ? '#F4F4F5' : '#18181B',
                letterSpacing: '0.01em',
              }}
            >
              Mandarin (Chinese)
            </Typography>
            <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
              <SwapHorizIcon fontSize="small" />
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: 'primary.main',
                letterSpacing: '0.01em',
              }}
            >
              English (Live)
            </Typography>
          </Stack>

          {/* Session Metadata & Action Buttons */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              icon={<RecordVoiceOverIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`Session #${sessionInfo.session_number}: ${sessionInfo.session_title}`}
              size="small"
              sx={{
                fontWeight: 500,
                bgcolor: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                color: isDarkTheme ? '#A1A1AA' : '#71717A',
                border: '1px solid',
                borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              }}
            />

            {/* Create New Session Button */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddCircleOutlinedIcon sx={{ fontSize: '1rem' }} />}
              onClick={onOpenNewSession}
              sx={{
                fontWeight: 600,
                fontSize: '0.8125rem',
                borderRadius: '999px',
                px: 2,
                py: 0.5,
                borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                color: isDarkTheme ? '#F4F4F5' : '#18181B',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: isDarkTheme ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                },
              }}
            >
              New Session
            </Button>
          </Stack>
        </Paper>

        {/* Error notification */}
        {errorMessage && (
          <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ borderRadius: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* Minimalist Dual Cards: Source Speech & Live English Translation */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 2.5,
          }}
        >
          {/* LEFT CARD: Chinese Speech Input Panel */}
          <Card
            elevation={0}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
              bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
              border: '1px solid',
              borderColor: activePartial
                ? (isDarkTheme ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.35)')
                : isDarkTheme
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.08)',
              borderRadius: 3,
              transition: 'border-color 0.2s ease',
            }}
          >
            <CardHeader
              title={
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: isDarkTheme ? '#71717A' : '#A1A1AA',
                    }}
                  >
                    Mandarin Input
                  </Typography>
                  {isStreaming && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1,
                        py: 0.25,
                        borderRadius: '999px',
                        bgcolor: isDarkTheme ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid',
                        borderColor: isDarkTheme ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: '#EF4444',
                          animation: 'pulse 1.5s infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                            '50%': { opacity: 0.4, transform: 'scale(0.8)' },
                          },
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: '#EF4444',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Listening
                      </Typography>
                    </Box>
                  )}
                </Stack>
              }
              action={
                <Typography variant="caption" sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA', fontWeight: 500 }}>
                  {activePartial ? 'Live' : latestFinal ? 'Latest finalized' : 'Standby'}
                </Typography>
              }
              sx={{ pb: 1, borderBottom: '1px solid', borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' }}
            />

            <CardContent sx={{ flex: 1, py: 2.5 }}>
              {currentDisplayChinese ? (
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: fontSizeScale === 'large' ? '1.25rem' : '1.05rem',
                    lineHeight: 1.7,
                    color: isDarkTheme ? '#E4E4E7' : '#27272A',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                >
                  {currentDisplayChinese}
                </Typography>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2" sx={{ color: isDarkTheme ? '#52525B' : '#A1A1AA' }}>
                    {isStreaming
                      ? 'Speak into the microphone in Mandarin...'
                      : 'Microphone is idle. Click "Start Microphone" to begin.'}
                  </Typography>
                </Box>
              )}
            </CardContent>

            {/* Bottom Actions of Source Panel */}
            <Box sx={{ p: 2, pt: 1, borderTop: '1px solid', borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' }}>
              {/* VU Meter */}
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: isDarkTheme ? '#71717A' : '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.6875rem' }}>
                    Audio Level
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: isDarkTheme ? '#A1A1AA' : '#71717A' }}>
                    {localAudioLevel}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={localAudioLevel}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 2,
                      bgcolor: isStreaming ? 'primary.main' : 'text.disabled',
                    },
                  }}
                />
              </Box>

              {/* Speaker Auth & Mic Actions */}
              {oauthClientId && googleUser && (
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Speaker: <strong>{googleUser.name}</strong> ({googleUser.email})
                  </Typography>
                  <Button size="small" onClick={handleSignOut} disabled={isStreaming} sx={{ fontSize: '0.7rem' }}>
                    Sign out
                  </Button>
                </Stack>
              )}

              {oauthClientId && !googleUser && (
                <Box ref={googleButtonRef} sx={{ mb: 1.5 }} />
              )}

              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={toggleStreaming}
                  startIcon={isStreaming ? <MicOffIcon /> : <MicIcon />}
                  color={isStreaming ? 'error' : 'primary'}
                  sx={{
                    py: 1,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    borderRadius: '999px',
                    boxShadow: 'none',
                    letterSpacing: '0.01em',
                  }}
                >
                  {isStreaming ? 'Stop Microphone' : 'Start Microphone'}
                </Button>

                {isStreaming && (
                  <Tooltip title={isMuted ? 'Unmute microphone' : 'Mute microphone'} arrow>
                    <IconButton
                      onClick={toggleMute}
                      color={isMuted ? 'warning' : 'default'}
                      sx={{
                        border: '1px solid',
                        borderColor: isMuted ? 'warning.main' : (isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                        p: 1,
                      }}
                    >
                      {isMuted ? <MicOffIcon fontSize="small" /> : <MicIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          </Card>

          {/* RIGHT CARD: Live English Translation Panel */}
          <Card
            elevation={0}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
              bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
              border: '1px solid',
              borderColor: activePartial
                ? (isDarkTheme ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.35)')
                : isDarkTheme
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.08)',
              borderRadius: 3,
              transition: 'border-color 0.2s ease',
            }}
          >
            <CardHeader
              title={
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: isDarkTheme ? '#71717A' : '#A1A1AA',
                  }}
                >
                  English Translation
                </Typography>
              }
              action={
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Tooltip title={fontSizeScale === 'large' ? 'Normal text size' : 'Large text size'} arrow>
                    <IconButton
                      size="small"
                      onClick={() => setFontSizeScale(fontSizeScale === 'normal' ? 'large' : 'normal')}
                      sx={{ color: isDarkTheme ? '#A1A1AA' : '#71717A' }}
                    >
                      <FormatSizeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
              sx={{ pb: 1, borderBottom: '1px solid', borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' }}
            />

            <CardContent sx={{ flex: 1, py: 2.5 }}>
              {currentDisplayEnglish ? (
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                      fontSize: fontSizeScale === 'large' ? '1.4rem' : '1.15rem',
                      fontWeight: 500,
                      lineHeight: 1.6,
                      color: isDarkTheme ? '#F4F4F5' : '#18181B',
                    }}
                  >
                    {currentDisplayEnglish}
                    {activePartial && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: 2,
                          height: 18,
                          bgcolor: 'primary.main',
                          ml: 0.75,
                          verticalAlign: 'middle',
                          animation: 'blink 1s infinite',
                          '@keyframes blink': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0 },
                          },
                        }}
                      />
                    )}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2" sx={{ color: isDarkTheme ? '#52525B' : '#A1A1AA' }}>
                    English translation will stream here as words are spoken.
                  </Typography>
                </Box>
              )}
            </CardContent>

            {/* Bottom Actions */}
            <Box
              sx={{
                p: 2,
                pt: 1.5,
                borderTop: '1px solid',
                borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={1}>
                {/* TTS */}
                <Tooltip title="Listen to translation" arrow>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!currentDisplayEnglish}
                      onClick={() => speakTranslation(currentDisplayEnglish, 'active')}
                      color={speakingId === 'active' ? 'primary' : 'default'}
                      sx={{
                        border: '1px solid',
                        borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        color: isDarkTheme ? '#A1A1AA' : '#71717A',
                      }}
                    >
                      <VolumeUpIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                {/* Copy */}
                <Tooltip title="Copy translation" arrow>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!currentDisplayEnglish}
                      onClick={() => copyToClipboard(currentDisplayEnglish, 'active')}
                      color={copiedId === 'active' ? 'success' : 'default'}
                      sx={{
                        border: '1px solid',
                        borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        color: isDarkTheme ? '#A1A1AA' : '#71717A',
                      }}
                    >
                      {copiedId === 'active' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              <Button
                size="small"
                variant="text"
                onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
                sx={{
                  fontSize: '0.75rem',
                  py: 0.5,
                  color: isDarkTheme ? '#A1A1AA' : '#71717A',
                  textTransform: 'none',
                }}
              >
                {fontStyle === 'serif' ? 'Serif' : 'Sans'}
              </Button>
            </Box>
          </Card>
        </Box>

        {/* Translation Session Context & Controls */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            gap: 2.5,
          }}
        >
          {/* Wedding & Speech Details */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
              border: '1px solid',
              borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              borderRadius: 3,
            }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                Wedding Information
              </Typography>
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} />}
                label="Ready"
                size="small"
                variant="outlined"
                color="success"
                sx={{
                  height: 20,
                  fontSize: '0.6875rem',
                }}
              />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                fontSize: '0.8125rem',
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA', fontSize: '0.7rem' }}>
                  Bride &amp; Groom
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkTheme ? '#F4F4F5' : '#18181B' }}>
                  {wedding.bride_name} &amp; {wedding.groom_name}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA', fontSize: '0.7rem' }}>
                  Venue
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkTheme ? '#F4F4F5' : '#18181B' }}>
                  The Stable at Stones of the Yarra Valley
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA', fontSize: '0.7rem' }}>
                  Active Session
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkTheme ? '#F4F4F5' : '#18181B' }}>
                  #{sessionInfo.session_number}: {sessionInfo.session_title}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA', fontSize: '0.7rem' }}>
                  Date
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkTheme ? '#F4F4F5' : '#18181B' }}>
                  Saturday, 10 October 2026
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Quick Session Management Actions */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
              border: '1px solid',
              borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDarkTheme ? '#71717A' : '#A1A1AA', display: 'block', mb: 0.5 }}>
                Session Controls
              </Typography>
              <Typography variant="caption" sx={{ color: isDarkTheme ? '#52525B' : '#A1A1AA' }}>
                Export guest transcripts or reset for next speaker.
              </Typography>
            </Box>

            <Stack spacing={1}>
              {onOpenQrCode && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<QrCode2Icon sx={{ fontSize: '1rem' }} />}
                  onClick={onOpenQrCode}
                  fullWidth
                  sx={{
                    justifyContent: 'flex-start',
                    py: 0.75,
                    fontSize: '0.8125rem',
                    textTransform: 'none',
                    borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDarkTheme ? '#F4F4F5' : '#18181B',
                  }}
                >
                  Guest QR Code
                </Button>
              )}

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon sx={{ fontSize: '0.9rem' }} />}
                  onClick={() => exportTranscript('markdown')}
                  sx={{
                    flex: 1,
                    py: 0.6,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDarkTheme ? '#F4F4F5' : '#18181B',
                  }}
                >
                  Export MD
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon sx={{ fontSize: '0.9rem' }} />}
                  onClick={() => exportTranscript('csv')}
                  sx={{
                    flex: 1,
                    py: 0.6,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDarkTheme ? '#F4F4F5' : '#18181B',
                  }}
                >
                  Export CSV
                </Button>
                <Tooltip title="Clear transcript for new speaker" arrow>
                  <IconButton
                    size="small"
                    onClick={clearTranscript}
                    color="error"
                    sx={{
                      border: '1px solid',
                      borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        </Box>

        {/* Conversation / Transcript Timeline Feed */}
        <Card
          elevation={0}
          sx={{
            bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
            border: '1px solid',
            borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
          }}
        >
          <CardHeader
            title={
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: isDarkTheme ? '#F4F4F5' : '#18181B' }}>
                    Transcript History
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                    {subtitles.length} phrases recorded
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {/* Search Filter */}
                  <TextField
                    size="small"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{
                      width: { xs: 140, sm: 200 },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '999px',
                        fontSize: '0.8125rem',
                        bgcolor: isDarkTheme ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        '& fieldset': {
                          borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        },
                      },
                    }}
                  />

                  {/* Layout toggle */}
                  <Tooltip title="Side-by-side dual column" arrow>
                    <IconButton
                      size="small"
                      color={feedLayout === 'side-by-side' ? 'primary' : 'default'}
                      onClick={() => setFeedLayout('side-by-side')}
                      sx={{
                        border: '1px solid',
                        borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <ViewColumnIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Stacked cards layout" arrow>
                    <IconButton
                      size="small"
                      color={feedLayout === 'stacked' ? 'primary' : 'default'}
                      onClick={() => setFeedLayout('stacked')}
                      sx={{
                        border: '1px solid',
                        borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <ViewAgendaIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            }
            sx={{ borderBottom: '1px solid', borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', py: 2 }}
          />

          {/* Scrollable Conversation List */}
          <Box
            ref={scrollRef}
            sx={{
              maxHeight: 460,
              overflowY: 'auto',
              p: { xs: 2, sm: 2.5 },
              bgcolor: isDarkTheme ? '#090A0B' : '#FAFAFA',
            }}
          >
            {filteredSubtitles.length === 0 && !activePartial ? (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                <RecordVoiceOverIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2" sx={{ color: isDarkTheme ? '#52525B' : '#A1A1AA' }}>
                  {searchQuery
                    ? `No matches for "${searchQuery}".`
                    : 'No phrases recorded yet in this session.'}
                </Typography>
              </Box>
            ) : feedLayout === 'side-by-side' ? (
              /* Dual Column Table */
              <Stack spacing={1.5}>
                {filteredSubtitles.map((item) => (
                  <Paper
                    key={item.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                      borderRadius: 2.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
                      gap: 2,
                      alignItems: 'center',
                    }}
                  >
                    {/* Chinese Left */}
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                          #{item.id}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDarkTheme ? '#52525B' : '#D4D4D8', fontFamily: 'monospace' }}>
                          {item.timestamp}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: isDarkTheme ? '#A1A1AA' : '#71717A', lineHeight: 1.6 }}>
                        {item.chinese || '—'}
                      </Typography>
                    </Box>

                    {/* English Right */}
                    <Box sx={{ borderLeft: { md: '1px solid' }, borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', pl: { md: 2 } }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                            fontWeight: 500,
                            color: isDarkTheme ? '#F4F4F5' : '#18181B',
                            lineHeight: 1.5,
                            flex: 1,
                          }}
                        >
                          {item.english}
                        </Typography>

                        <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
                          <Tooltip title="Listen" arrow>
                            <IconButton size="small" onClick={() => speakTranslation(item.english, item.id)} sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                              <VolumeUpIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy" arrow>
                            <IconButton size="small" onClick={() => copyToClipboard(item.english, item.id)} sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                              {copiedId === item.id ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Box>
                  </Paper>
                ))}

                {activePartial && (activePartial.chinese || activePartial.english) && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 2.5,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
                      gap: 2,
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          Live
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDarkTheme ? '#52525B' : '#D4D4D8', fontFamily: 'monospace' }}>
                          {activePartial.timestamp}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: isDarkTheme ? '#E4E4E7' : '#27272A', lineHeight: 1.6 }}>
                        {activePartial.chinese || 'Listening...'}
                      </Typography>
                    </Box>

                    <Box sx={{ borderLeft: { md: '1px solid' }, borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', pl: { md: 2 } }}>
                      <Typography
                        variant="body1"
                        sx={{
                          fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                          fontWeight: 500,
                          color: isDarkTheme ? '#F4F4F5' : '#18181B',
                          lineHeight: 1.5,
                        }}
                      >
                        {activePartial.english || 'Translating...'}
                      </Typography>
                    </Box>
                  </Paper>
                )}
              </Stack>
            ) : (
              /* Stacked Cards */
              <Stack spacing={1.5}>
                {filteredSubtitles.map((item) => (
                  <Paper
                    key={item.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                      borderRadius: 2.5,
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                          #{item.id}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDarkTheme ? '#52525B' : '#D4D4D8', fontFamily: 'monospace' }}>
                          {item.timestamp}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={() => speakTranslation(item.english, item.id)} sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                          <VolumeUpIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => copyToClipboard(item.english, item.id)} sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA' }}>
                          {copiedId === item.id ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                      </Stack>
                    </Stack>

                    {item.chinese && (
                      <Typography variant="body2" sx={{ color: isDarkTheme ? '#71717A' : '#A1A1AA', mb: 0.75, lineHeight: 1.5 }}>
                        {item.chinese}
                      </Typography>
                    )}

                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                        fontWeight: 500,
                        color: isDarkTheme ? '#F4F4F5' : '#18181B',
                        lineHeight: 1.5,
                      }}
                    >
                      {item.english}
                    </Typography>
                  </Paper>
                ))}

                {activePartial && (activePartial.chinese || activePartial.english) && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: isDarkTheme ? '#121316' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 2.5,
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        Live
                      </Typography>
                      <Typography variant="caption" sx={{ color: isDarkTheme ? '#52525B' : '#D4D4D8', fontFamily: 'monospace' }}>
                        {activePartial.timestamp}
                      </Typography>
                    </Stack>

                    {activePartial.chinese && (
                      <Typography variant="body2" sx={{ color: isDarkTheme ? '#E4E4E7' : '#27272A', mb: 0.75, lineHeight: 1.5 }}>
                        {activePartial.chinese}
                      </Typography>
                    )}

                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                        fontWeight: 500,
                        color: isDarkTheme ? '#F4F4F5' : '#18181B',
                        lineHeight: 1.5,
                      }}
                    >
                      {activePartial.english || 'Translating...'}
                    </Typography>
                  </Paper>
                )}
              </Stack>
            )}
          </Box>
        </Card>
      </Stack>

      {/* Copy / Action feedback snackbar */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2500}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
