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
          ? alpha('#090A0B', 0.92)
          : alpha('#FAFAFA', 0.92),
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)',
        color: isDark ? '#F4F4F5' : '#18181B',
        zIndex: theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3, md: 4 },
          py: 0.5,
          minHeight: { xs: 54, sm: 60 },
          gap: 1.5,
        }}
      >
        {/* Brand & Venue Title */}
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              color: isDark ? '#F4F4F5' : '#18181B',
              flexShrink: 0,
            }}
          >
            <TranslateIcon sx={{ fontSize: '1.05rem' }} />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 600,
                  fontSize: { xs: '0.84rem', sm: '0.9rem' },
                  letterSpacing: '-0.01em',
                }}
              >
                Stones of the Yarra Valley
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'none', sm: 'inline-block' },
                  color: 'text.secondary',
                  fontSize: '0.72rem',
                }}
              >
                • The Stable
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.72rem',
                }}
              >
                {wedding.bride_name} &amp; {wedding.groom_name}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        {/* Center: Desktop Navigation Segmented Pill */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            p: 0.5,
            borderRadius: '999px',
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          }}
        >
          <Tabs
            value={currentView}
            onChange={(_, val) => onSelectView(val)}
            textColor="inherit"
            sx={{
              minHeight: 32,
              '& .MuiTabs-flexContainer': { gap: 0.5 },
              '& .MuiTabs-indicator': {
                display: 'none',
              },
            }}
          >
            <Tab
              value="mobile"
              icon={<PhoneIphoneIcon sx={{ fontSize: '0.9rem !important' }} />}
              iconPosition="start"
              label="Guest View"
              sx={{
                minHeight: 32,
                px: 1.75,
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: currentView === 'mobile' ? 600 : 450,
                bgcolor: currentView === 'mobile' ? (isDark ? '#F4F4F5' : '#18181B') : 'transparent',
                color: currentView === 'mobile' ? (isDark ? '#090A0B !important' : '#FFFFFF !important') : 'text.secondary',
              }}
            />
            <Tab
              value="speaker"
              icon={<MicIcon sx={{ fontSize: '0.9rem !important' }} />}
              iconPosition="start"
              label="Speaker Deck"
              sx={{
                minHeight: 32,
                px: 1.75,
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: currentView === 'speaker' ? 600 : 450,
                bgcolor: currentView === 'speaker' ? (isDark ? '#F4F4F5' : '#18181B') : 'transparent',
                color: currentView === 'speaker' ? (isDark ? '#090A0B !important' : '#FFFFFF !important') : 'text.secondary',
              }}
            />
            <Tab
              value="projector"
              icon={<DesktopWindowsIcon sx={{ fontSize: '0.9rem !important' }} />}
              iconPosition="start"
              label="Projector"
              sx={{
                minHeight: 32,
                px: 1.75,
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: currentView === 'projector' ? 600 : 450,
                bgcolor: currentView === 'projector' ? (isDark ? '#F4F4F5' : '#18181B') : 'transparent',
                color: currentView === 'projector' ? (isDark ? '#090A0B !important' : '#FFFFFF !important') : 'text.secondary',
              }}
            />
          </Tabs>
        </Box>

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
                startIcon={<MicIcon sx={{ fontSize: '0.95rem !important' }} />}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  py: 0.5,
                  px: { xs: 1.25, sm: 1.75 },
                  borderRadius: '999px',
                  bgcolor: isDark ? '#F4F4F5' : '#18181B',
                  color: isDark ? '#090A0B' : '#FFFFFF',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: isDark ? '#FFFFFF' : '#27272A',
                    boxShadow: 'none',
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
              size="small"
              onClick={onOpenNewSession}
              startIcon={<AddCircleOutlinedIcon sx={{ fontSize: '0.95rem !important' }} />}
              sx={{
                fontWeight: 600,
                fontSize: '0.76rem',
                py: 0.5,
                px: { xs: 1.25, sm: 1.75 },
                borderRadius: '999px',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                color: isDark ? '#F4F4F5' : '#18181B',
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
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              color: isDark ? '#D4D4D8' : '#3F3F46',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              fontWeight: 500,
              fontSize: '0.72rem',
            }}
          />

          {/* Live On Air Beacon */}
          {isSessionActive && (
            <Chip
              icon={<RadioIcon sx={{ fontSize: '0.85rem !important' }} />}
              label="On Air"
              size="small"
              color="error"
              variant="filled"
              sx={{
                fontWeight: 600,
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            />
          )}

          {/* Connection Indicator */}
          <Tooltip title={connectionStatus === 'connected' ? 'Live Stream Connected' : `Connection: ${connectionStatus}`} arrow>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: '999px',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                fontSize: '0.6875rem',
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor:
                    connectionStatus === 'connected'
                      ? '#22C55E'
                      : connectionStatus === 'connecting'
                      ? '#EAB308'
                      : '#EF4444',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'none', xl: 'inline' },
                  textTransform: 'capitalize',
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  color: 'text.secondary',
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
