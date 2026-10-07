import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Tabs,
  Tab,
  Tooltip,
  useTheme,
  Stack,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import MicIcon from '@mui/icons-material/Mic';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import TranslateIcon from '@mui/icons-material/Translate';
import RadioIcon from '@mui/icons-material/Radio';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import type { ConnectionStatus } from '../hooks/useLiveSubtitles';
import type { TranslationSessionInfo, ViewMode, WeddingContextData } from '../types';

interface HeaderProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  connectionStatus: ConnectionStatus;
  isSessionActive: boolean;
  sessionInfo: TranslationSessionInfo;
  wedding: WeddingContextData;
  liveModel?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onOpenQrCode: () => void;
  onOpenNewSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  connectionStatus,
  isSessionActive,
  sessionInfo,
  wedding,
  liveModel = 'Gemini 3.8 Live',
  isDark = true,
  onToggleTheme,
  onOpenQrCode,
  onOpenNewSession,
}) => {
  const theme = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: isDark
          ? alpha('#121316', 0.94)
          : alpha('#F8FAFD', 0.94),
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E0E2EC',
        color: isDark ? '#E2E2E6' : '#1F1F1F',
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3, md: 4 },
          py: 0.75,
          minHeight: { xs: 58, sm: 66 },
          gap: 1.5,
        }}
      >
        {/* Brand & Venue Logo */}
        <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid',
              borderColor: isDark ? 'rgba(168, 199, 250, 0.4)' : 'rgba(11, 87, 208, 0.25)',
              bgcolor: isDark ? '#1E1F22' : '#D3E3FD',
              color: isDark ? '#A8C7FA' : '#0B57D0',
              flexShrink: 0,
            }}
          >
            <TranslateIcon sx={{ fontSize: '1.25rem' }} />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontFamily: '"Outfit", "Google Sans", sans-serif',
                  fontWeight: 700,
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  letterSpacing: '-0.01em',
                }}
              >
                Stones of the Yarra Valley
              </Typography>
              <Chip
                label="The Stable"
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  height: 20,
                  fontSize: '0.625rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  bgcolor: isDark ? '#282A2E' : '#E9EEF6',
                  color: isDark ? '#C4C6D0' : '#444746',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
                }}
              />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.1 }}>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  fontFamily: '"Outfit", "Google Sans", sans-serif',
                  color: isDark ? '#C4C6D0' : '#444746',
                  fontSize: '0.75rem',
                }}
              >
                {wedding.bride_name} &amp; {wedding.groom_name}’s Wedding
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'none', md: 'inline' },
                  color: isDark ? '#A8C7FA' : '#0B57D0',
                  fontWeight: 600,
                  fontSize: '0.6875rem',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                • Live Interpretation
              </Typography>
            </Stack>
          </Box>
        </Stack>

        {/* Center: Desktop Navigation Tabs & Google Language Pill */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'center',
            display: { xs: 'none', md: 'flex' },
          }}
        >
          {/* Google Translate Language Pill */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.75,
              py: 0.5,
              borderRadius: '999px',
              bgcolor: isDark ? '#1E1F22' : '#F0F4F9',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
              fontSize: '0.75rem',
            }}
          >
            <TranslateIcon sx={{ fontSize: '0.95rem', color: isDark ? '#A8C7FA' : '#0B57D0' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: isDark ? '#E2E2E6' : '#1F1F1F' }}>
              🇨🇳 普通话
            </Typography>
            <ArrowForwardIcon sx={{ fontSize: '0.75rem', color: 'text.secondary', opacity: 0.6 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: isDark ? '#E2E2E6' : '#1F1F1F' }}>
              🇬🇧 English
            </Typography>
          </Box>

          {/* Navigation Tabs (Projector / Speaker / Guest) */}
          <Tabs
            value={currentView}
            onChange={(_, val) => onSelectView(val)}
            textColor="inherit"
            sx={{
              minHeight: 40,
              '& .MuiTabs-flexContainer': { gap: 0.5 },
              '& .MuiTabs-indicator': {
                backgroundColor: isDark ? '#A8C7FA' : '#0B57D0',
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab
              value="mobile"
              icon={<PhoneIphoneIcon sx={{ fontSize: '1rem !important' }} />}
              iconPosition="start"
              label="Guest View"
              sx={{ minHeight: 40, px: 1.75 }}
            />
            <Tab
              value="speaker"
              icon={<MicIcon sx={{ fontSize: '1rem !important' }} />}
              iconPosition="start"
              label="Speaker Deck"
              sx={{ minHeight: 40, px: 1.75 }}
            />
            <Tab
              value="projector"
              icon={<DesktopWindowsIcon sx={{ fontSize: '1rem !important' }} />}
              iconPosition="start"
              label="Projector"
              sx={{ minHeight: 40, px: 1.75 }}
            />
          </Tabs>
        </Stack>

        {/* Mobile View Selector Button & Dropdown Menu */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={(e) => setViewMenuAnchor(e.currentTarget)}
            endIcon={<ArrowDropDownIcon />}
            startIcon={
              currentView === 'speaker' ? <MicIcon sx={{ fontSize: '1rem !important' }} /> :
              currentView === 'projector' ? <DesktopWindowsIcon sx={{ fontSize: '1rem !important' }} /> :
              <PhoneIphoneIcon sx={{ fontSize: '1rem !important' }} />
            }
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.75rem',
              py: 0.4,
              px: 1.25,
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#E0E2EC',
              color: isDark ? '#E2E2E6' : '#1F1F1F',
            }}
          >
            {currentView === 'speaker' ? 'Speaker' : currentView === 'projector' ? 'Projector' : 'Guest'}
          </Button>

          <Menu
            anchorEl={viewMenuAnchor}
            open={Boolean(viewMenuAnchor)}
            onClose={() => setViewMenuAnchor(null)}
            slotProps={{
              paper: {
                sx: {
                  borderRadius: '16px',
                  bgcolor: isDark ? '#1E1F22' : '#FFFFFF',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                  minWidth: 200,
                },
              },
            }}
          >
            <MenuItem
              onClick={() => { onSelectView('mobile'); setViewMenuAnchor(null); }}
              selected={currentView === 'mobile'}
            >
              <ListItemIcon><PhoneIphoneIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Guest View" secondary="Mobile reading mode" />
            </MenuItem>
            <MenuItem
              onClick={() => { onSelectView('speaker'); setViewMenuAnchor(null); }}
              selected={currentView === 'speaker'}
            >
              <ListItemIcon><MicIcon fontSize="small" color="primary" /></ListItemIcon>
              <ListItemText primary="Speaker Deck" secondary="Broadcast microphone" />
            </MenuItem>
            <MenuItem
              onClick={() => { onSelectView('projector'); setViewMenuAnchor(null); }}
              selected={currentView === 'projector'}
            >
              <ListItemIcon><DesktopWindowsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Projector" secondary="Large screen view" />
            </MenuItem>
          </Menu>
        </Box>

        {/* Right Controls: Quick Speak Button, New Session, On Air, Theme & QR */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {/* Quick "Start Speaking" Button if on Guest View */}
          {currentView === 'mobile' && (
            <Tooltip title="Switch to Speaker Console to turn on microphone & start translating" arrow>
              <Button
                variant="contained"
                size="small"
                onClick={() => onSelectView('speaker')}
                startIcon={<MicIcon sx={{ fontSize: '1rem !important' }} />}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  py: 0.65,
                  px: { xs: 1.25, sm: 1.75 },
                  borderRadius: '999px',
                  bgcolor: isDark ? '#A8C7FA' : '#0B57D0',
                  color: isDark ? '#041E49' : '#FFFFFF',
                  boxShadow: isDark
                    ? '0 2px 10px rgba(168,199,250,0.3)'
                    : '0 2px 10px rgba(11,87,208,0.3)',
                  '&:hover': {
                    bgcolor: isDark ? '#D3E3FD' : '#0842A0',
                  },
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Start Speaking
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Speak
                </Box>
              </Button>
            </Tooltip>
          )}

          {/* New Session Button */}
          <Tooltip title="Create a new translation session for the next speech or speaker" arrow>
            <Button
              variant={currentView === 'speaker' ? 'contained' : 'outlined'}
              color="primary"
              size="small"
              onClick={onOpenNewSession}
              startIcon={<AddCircleOutlinedIcon />}
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                py: 0.65,
                px: { xs: 1.25, sm: 1.75 },
                borderRadius: '999px',
                borderColor: isDark ? 'rgba(168, 199, 250, 0.4)' : 'rgba(11, 87, 208, 0.3)',
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                New Session
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                New
              </Box>
            </Button>
          </Tooltip>

          {/* Active Session Chip */}
          <Chip
            label={`#${sessionInfo.session_number}: ${sessionInfo.session_title}`}
            size="small"
            sx={{
              display: { xs: 'none', lg: 'inline-flex' },
              maxWidth: 200,
              bgcolor: isDark ? '#282A2E' : '#E9EEF6',
              color: isDark ? '#E2E2E6' : '#1F1F1F',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
              fontWeight: 500,
              fontSize: '0.6875rem',
            }}
          />

          {/* Live On Air Beacon */}
          {isSessionActive && (
            <Chip
              icon={<RadioIcon sx={{ fontSize: '0.9rem !important', animation: 'pulse 1.5s infinite' }} />}
              label="On Air"
              size="small"
              color="error"
              variant="filled"
              sx={{
                fontWeight: 700,
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
              }}
            />
          )}

          {/* Connection Indicator */}
          <Tooltip title={`WebSocket: ${connectionStatus} (${liveModel})`} arrow>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: '999px',
                bgcolor: isDark ? '#1E1F22' : '#F0F4F9',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
                fontSize: '0.6875rem',
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor:
                    connectionStatus === 'connected'
                      ? '#1E8E3E'
                      : connectionStatus === 'connecting'
                      ? '#FBBC04'
                      : '#EA4335',
                  boxShadow:
                    connectionStatus === 'connected'
                      ? '0 0 6px #34A853'
                      : 'none',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'none', xl: 'inline' },
                  textTransform: 'capitalize',
                  fontWeight: 600,
                }}
              >
                {connectionStatus}
              </Typography>
            </Box>
          </Tooltip>

          {/* Guest QR Code Trigger */}
          <Tooltip title="Show Guest QR Code" arrow>
            <IconButton
              size="small"
              onClick={onOpenQrCode}
              sx={{
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
                bgcolor: isDark ? '#1E1F22' : '#FFFFFF',
                color: isDark ? '#E2E2E6' : '#1F1F1F',
                '&:hover': {
                  bgcolor: isDark ? '#282A2E' : '#E9EEF6',
                  color: isDark ? '#A8C7FA' : '#0B57D0',
                },
              }}
            >
              <QrCode2Icon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Theme Mode Switcher */}
          {onToggleTheme && (
            <Tooltip title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'} arrow>
              <IconButton
                size="small"
                onClick={onToggleTheme}
                sx={{
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
                  bgcolor: isDark ? '#1E1F22' : '#FFFFFF',
                  color: isDark ? '#E2E2E6' : '#1F1F1F',
                  '&:hover': {
                    bgcolor: isDark ? '#282A2E' : '#E9EEF6',
                    color: isDark ? '#A8C7FA' : '#0B57D0',
                  },
                }}
              >
                {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

          {/* Fullscreen Button */}
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (F)'} arrow>
            <IconButton
              size="small"
              onClick={toggleFullscreen}
              sx={{
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E2EC',
                bgcolor: isDark ? '#1E1F22' : '#FFFFFF',
                color: isDark ? '#E2E2E6' : '#1F1F1F',
                '&:hover': {
                  bgcolor: isDark ? '#282A2E' : '#E9EEF6',
                  color: isDark ? '#A8C7FA' : '#0B57D0',
                },
              }}
            >
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
