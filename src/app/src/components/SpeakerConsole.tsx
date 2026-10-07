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
  alpha,
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
import RadioIcon from '@mui/icons-material/Radio';
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
      onStateChange: (state) => setIsStreaming(state),
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
        {/* Google Translate Language & Session Action Bar */}
        <Paper
          elevation={1}
          sx={{
            p: { xs: 2, sm: 2.5 },
            bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
            border: '1px solid',
            borderColor: isDarkTheme ? '#333538' : '#DEE2E6',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Language Selector Pair */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              label="🇨🇳 Chinese (Mandarin / 普通话)"
              variant="outlined"
              color="primary"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                py: 2,
                px: 1,
              }}
            />
            <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
              <SwapHorizIcon />
            </Box>
            <Chip
              label="🇬🇧 English (Live Subtitles)"
              variant="filled"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                py: 2,
                px: 1,
                bgcolor: isDarkTheme ? '#A8C7FA' : '#0B57D0',
                color: isDarkTheme ? '#041E49' : '#FFFFFF',
              }}
            />
          </Stack>

          {/* Session Metadata & Action Buttons */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              icon={<RecordVoiceOverIcon sx={{ fontSize: '1rem !important' }} />}
              label={`Session #${sessionInfo.session_number}: ${sessionInfo.session_title}`}
              sx={{
                fontWeight: 600,
                bgcolor: isDarkTheme ? 'rgba(168, 199, 250, 0.15)' : '#E8F0FE',
                color: isDarkTheme ? '#A8C7FA' : '#0B57D0',
                border: '1px solid',
                borderColor: isDarkTheme ? 'rgba(168, 199, 250, 0.3)' : '#D3E3FD',
              }}
            />

            {/* Create New Session Button */}
            <Button
              variant="contained"
              color="primary"
              size="medium"
              startIcon={<AddCircleOutlinedIcon />}
              onClick={onOpenNewSession}
              sx={{
                fontWeight: 700,
                fontSize: '0.8125rem',
                borderRadius: '999px',
                px: 2.5,
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

        {/* Google Translate Signature Dual Cards: Source Speech & Live English Translation */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 2.5,
          }}
        >
          {/* LEFT CARD: Chinese Speech Input Panel */}
          <Card
            elevation={2}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
              bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
              borderColor: activePartial
                ? (isDarkTheme ? '#A8C7FA' : '#0B57D0')
                : isDarkTheme
                ? '#333538'
                : '#DEE2E6',
              borderWidth: activePartial ? '2px' : '1px',
              transition: 'all 0.25s ease',
            }}
          >
            <CardHeader
              title={
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    label="ZH"
                    size="small"
                    sx={{
                      fontWeight: 800,
                      height: 22,
                      bgcolor: isDarkTheme ? '#282A2E' : '#E0E2EC',
                      color: isDarkTheme ? '#A8C7FA' : '#0B57D0',
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Mandarin Input
                  </Typography>
                  {isStreaming && (
                    <Chip
                      icon={<RadioIcon sx={{ fontSize: '0.85rem !important' }} />}
                      label="Listening"
                      size="small"
                      color="error"
                      sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700 }}
                    />
                  )}
                </Stack>
              }
              action={
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {activePartial ? 'Live Stream' : latestFinal ? 'Latest finalized' : 'Standby'}
                </Typography>
              }
              sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}
            />

            <CardContent sx={{ flex: 1, py: 2.5 }}>
              {currentDisplayChinese ? (
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: fontSizeScale === 'large' ? '1.35rem' : '1.15rem',
                    lineHeight: 1.6,
                    color: isDarkTheme ? '#E5DFD5' : '#2C2824',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                >
                  {currentDisplayChinese}
                </Typography>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    {isStreaming
                      ? 'Speak into the microphone in Mandarin Chinese...'
                      : 'Microphone is idle. Click "Start Microphone" below to begin live interpretation.'}
                  </Typography>
                </Box>
              )}
            </CardContent>

            {/* Bottom Actions of Source Panel */}
            <Box sx={{ p: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              {/* VU Meter */}
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Acoustic Level
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                    {localAudioLevel}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={localAudioLevel}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: isDarkTheme ? '#282A2E' : '#E0E2EC',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: 'linear-gradient(90deg, #4285F4, #34A853, #FBBC05, #EA4335)',
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
                    py: 1.25,
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    borderRadius: '9999px',
                    boxShadow: isStreaming
                      ? '0 4px 16px rgba(217, 48, 37, 0.35)'
                      : '0 4px 16px rgba(11, 87, 208, 0.25)',
                  }}
                >
                  {isStreaming ? 'Stop Microphone' : 'Start Microphone (Gemini 3.8 Live)'}
                </Button>

                {isStreaming && (
                  <Tooltip title={isMuted ? 'Unmute microphone' : 'Mute microphone'} arrow>
                    <IconButton
                      onClick={toggleMute}
                      color={isMuted ? 'warning' : 'default'}
                      sx={{
                        border: '1px solid',
                        borderColor: isMuted ? 'warning.main' : 'divider',
                        p: 1.25,
                      }}
                    >
                      {isMuted ? <MicOffIcon /> : <MicIcon />}
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          </Card>

          {/* RIGHT CARD: Live English Translation Panel (Google Translate Experience) */}
          <Card
            elevation={2}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
              bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
              borderColor: activePartial
                ? (isDarkTheme ? '#A8C7FA' : '#0B57D0')
                : isDarkTheme
                ? '#333538'
                : '#DEE2E6',
              borderWidth: activePartial ? '2px' : '1px',
              transition: 'all 0.25s ease',
            }}
          >
            <CardHeader
              title={
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    label="EN"
                    size="small"
                    sx={{
                      fontWeight: 800,
                      height: 22,
                      bgcolor: isDarkTheme ? '#A8C7FA' : '#0B57D0',
                      color: isDarkTheme ? '#041E49' : '#FFFFFF',
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    English Translation
                  </Typography>
                </Stack>
              }
              action={
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Tooltip title={fontSizeScale === 'large' ? 'Normal text size' : 'Large text size'} arrow>
                    <IconButton
                      size="small"
                      onClick={() => setFontSizeScale(fontSizeScale === 'normal' ? 'large' : 'normal')}
                    >
                      <FormatSizeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
              sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}
            />

            <CardContent sx={{ flex: 1, py: 2.5 }}>
              {currentDisplayEnglish ? (
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                      fontSize: fontSizeScale === 'large' ? '1.5rem' : '1.25rem',
                      fontWeight: 600,
                      lineHeight: 1.5,
                      color: isDarkTheme ? '#FAF8F5' : '#1C1A17',
                    }}
                  >
                    {currentDisplayEnglish}
                    {activePartial && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: 8,
                          height: 18,
                          bgcolor: 'primary.main',
                          ml: 1,
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
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    English translation will appear here in real-time as words are spoken.
                  </Typography>
                </Box>
              )}
            </CardContent>

            {/* Bottom Actions: Iconic Google Translate TTS, Copy, and Font style */}
            <Box
              sx={{
                p: 2,
                pt: 1.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={1}>
                {/* Listen / TTS Button (Google Translate Signature) */}
                <Tooltip title="Listen to translation (Text-to-Speech)" arrow>
                  <span>
                    <IconButton
                      size="medium"
                      disabled={!currentDisplayEnglish}
                      onClick={() => speakTranslation(currentDisplayEnglish, 'active')}
                      color={speakingId === 'active' ? 'primary' : 'default'}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: speakingId === 'active' ? (isDarkTheme ? alpha('#A8C7FA', 0.2) : alpha('#0B57D0', 0.15)) : 'transparent',
                      }}
                    >
                      <VolumeUpIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                {/* Copy to Clipboard (Google Translate Signature) */}
                <Tooltip title="Copy translation to clipboard" arrow>
                  <span>
                    <IconButton
                      size="medium"
                      disabled={!currentDisplayEnglish}
                      onClick={() => copyToClipboard(currentDisplayEnglish, 'active')}
                      color={copiedId === 'active' ? 'success' : 'default'}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {copiedId === 'active' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
                  sx={{ fontSize: '0.75rem', py: 0.5 }}
                >
                  Font: {fontStyle === 'serif' ? 'Editorial Serif' : 'Modern Sans'}
                </Button>
              </Stack>
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
            elevation={1}
            sx={{
              p: 2.5,
              bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
              border: '1px solid',
              borderColor: isDarkTheme ? '#333538' : '#DEE2E6',
            }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Wedding Context &amp; Model Specs
              </Typography>
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                label="Synced with Backend"
                size="small"
                color="success"
                variant="outlined"
              />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                fontSize: '0.8125rem',
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Bride &amp; Groom
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {wedding.bride_name} &amp; {wedding.groom_name}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Venue
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  The Stable at Stones of the Yarra Valley
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Live Engine
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                  {backendConfig?.live_model || 'gemini-3.8-live'} (1-Step Direct)
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Infrastructure
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {backendConfig?.use_vertex ? 'Google Cloud Vertex AI' : 'Google AI Studio'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Quick Session Management Actions */}
          <Paper
            elevation={1}
            sx={{
              p: 2.5,
              bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
              border: '1px solid',
              borderColor: isDarkTheme ? '#333538' : '#DEE2E6',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                Session Actions
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Manage speech history, export guest files, or clear for next speaker.
              </Typography>
            </Box>

            <Stack spacing={1}>
              {onOpenQrCode && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<QrCode2Icon />}
                  onClick={onOpenQrCode}
                  fullWidth
                  sx={{ justifyContent: 'flex-start', py: 0.75 }}
                >
                  Show Guest Mobile QR Code
                </Button>
              )}

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => exportTranscript('markdown')}
                  sx={{ flex: 1, py: 0.75 }}
                >
                  Export MD
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => exportTranscript('csv')}
                  sx={{ flex: 1, py: 0.75 }}
                >
                  Export CSV
                </Button>
                <Tooltip title="Clear transcript for new speaker" arrow>
                  <IconButton
                    size="small"
                    onClick={clearTranscript}
                    color="error"
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        </Box>

        {/* Google Translate Conversation / Transcript Timeline Feed */}
        <Card
          elevation={2}
          sx={{
            bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
            border: '1px solid',
            borderColor: isDarkTheme ? '#333538' : '#DEE2E6',
          }}
        >
          <CardHeader
            title={
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    Speech History &amp; Conversation Timeline
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {subtitles.length} finalized phrases in current session
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {/* Search Filter */}
                  <TextField
                    size="small"
                    placeholder="Search speeches..."
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
                      width: { xs: 150, sm: 220 },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '999px',
                        fontSize: '0.8125rem',
                      },
                    }}
                  />

                  {/* Layout toggle */}
                  <Tooltip title="Side-by-side dual column" arrow>
                    <IconButton
                      size="small"
                      color={feedLayout === 'side-by-side' ? 'primary' : 'default'}
                      onClick={() => setFeedLayout('side-by-side')}
                      sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                      <ViewColumnIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Stacked cards layout" arrow>
                    <IconButton
                      size="small"
                      color={feedLayout === 'stacked' ? 'primary' : 'default'}
                      onClick={() => setFeedLayout('stacked')}
                      sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                      <ViewAgendaIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            }
            sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 2 }}
          />

          {/* Scrollable Conversation List */}
          <Box
            ref={scrollRef}
            sx={{
              maxHeight: 460,
              overflowY: 'auto',
              p: { xs: 2, sm: 2.5 },
              bgcolor: isDarkTheme ? '#16181A' : '#F0F4F9',
            }}
          >
            {filteredSubtitles.length === 0 && !activePartial ? (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                <RecordVoiceOverIcon sx={{ fontSize: 44, opacity: 0.4, mb: 1 }} />
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  {searchQuery
                    ? `No speech matches found for "${searchQuery}".`
                    : 'No speech recorded yet in this session. Start speaking to see live translations.'}
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
                      bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: isDarkTheme ? '#333538' : '#E0E2EC',
                      borderRadius: 3,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
                      gap: 2,
                      alignItems: 'center',
                    }}
                  >
                    {/* Chinese Left */}
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          #{item.id}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                          {item.timestamp}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: isDarkTheme ? '#D4CDC3' : '#4A453E', lineHeight: 1.5 }}>
                        {item.chinese || '—'}
                      </Typography>
                    </Box>

                    {/* English Right */}
                    <Box sx={{ borderLeft: { md: '1px solid' }, borderColor: 'divider', pl: { md: 2 } }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography
                          variant="body1"
                          sx={{
                            fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                            fontWeight: 600,
                            color: isDarkTheme ? '#FAF8F5' : '#1C1A17',
                            lineHeight: 1.5,
                            flex: 1,
                          }}
                        >
                          {item.english}
                        </Typography>

                        <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
                          <Tooltip title="Listen TTS" arrow>
                            <IconButton size="small" onClick={() => speakTranslation(item.english, item.id)}>
                              <VolumeUpIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy text" arrow>
                            <IconButton size="small" onClick={() => copyToClipboard(item.english, item.id)}>
                              {copiedId === item.id ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Box>
                  </Paper>
                ))}
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
                      bgcolor: isDarkTheme ? '#1E1F22' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: isDarkTheme ? '#333538' : '#E0E2EC',
                      borderRadius: 3,
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          #{item.id}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                          {item.timestamp}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={() => speakTranslation(item.english, item.id)}>
                          <VolumeUpIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => copyToClipboard(item.english, item.id)}>
                          {copiedId === item.id ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                      </Stack>
                    </Stack>

                    {item.chinese && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        🇨🇳 {item.chinese}
                      </Typography>
                    )}

                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: fontStyle === 'serif' ? '"Playfair Display", serif' : '"Plus Jakarta Sans", sans-serif',
                        fontWeight: 600,
                        color: isDarkTheme ? '#FAF8F5' : '#1C1A17',
                      }}
                    >
                      🇬🇧 {item.english}
                    </Typography>
                  </Paper>
                ))}
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
