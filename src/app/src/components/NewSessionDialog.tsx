import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Stack,
  Alert,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import type { TranslationSessionInfo } from '../types';

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  currentSession: TranslationSessionInfo;
  transcriptCount: number;
  onConfirmNewSession: (title: string) => Promise<boolean>;
  onExportTranscript?: (format: 'markdown' | 'csv') => void;
}

const PRESET_SPEECHES = [
  'Ceremony & Vows',
  'Bride & Groom Speeches',
  "Father of the Bride's Toast",
  'Best Man Speech',
  'Maid of Honour Speech',
  'Parents of the Groom Blessings',
  'Open Floor & Guest Wishes',
];

export const NewSessionDialog: React.FC<NewSessionDialogProps> = ({
  open,
  onClose,
  currentSession,
  transcriptCount,
  onConfirmNewSession,
  onExportTranscript,
}) => {
  const [sessionTitle, setSessionTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectPreset = (preset: string) => {
    setSessionTitle(preset);
  };

  const handleConfirm = async () => {
    const finalTitle = sessionTitle.trim() || `Speech Session #${currentSession.session_number + 1}`;
    setIsSubmitting(true);
    try {
      const success = await onConfirmNewSession(finalTitle);
      if (success) {
        setSessionTitle('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="new-session-dialog-title"
    >
      <DialogTitle id="new-session-dialog-title" sx={{ m: 0, p: 2.5, pb: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AddCircleOutlinedIcon />
            </Box>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
                New Translation Session
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Start a fresh translation session for the next speech
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label="close"
            onClick={onClose}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Status & Active Session Banner */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#282A2E' : '#F0F4F9'),
              border: '1px solid',
              borderColor: (theme) => (theme.palette.mode === 'dark' ? '#3C4043' : '#DEE2E6'),
            }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'text.secondary' }}>
                  Current Active Session
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.2 }}>
                  #{currentSession.session_number}: {currentSession.session_title}
                </Typography>
              </Box>
              <Chip
                icon={<RecordVoiceOverIcon sx={{ fontSize: '1rem !important' }} />}
                label={`${transcriptCount} phrases`}
                size="small"
                variant="outlined"
                color="primary"
              />
            </Stack>

            {transcriptCount > 0 && onExportTranscript && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    Save a copy of this speaker's transcript:
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<DownloadIcon fontSize="small" />}
                    onClick={() => onExportTranscript('markdown')}
                    sx={{ fontSize: '0.75rem', py: 0.5 }}
                  >
                    Export Transcript
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>

          {/* New Session Title Input */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Speech / Speaker Title
            </Typography>
            <TextField
              fullWidth
              autoFocus
              variant="outlined"
              placeholder={`e.g. Speech Session #${currentSession.session_number + 1}`}
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              helperText="Give this speech or speaker a title so the audience and coordinator can follow along."
            />
          </Box>

          {/* Quick Preset Chips */}
          <Box>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
              Quick Speech Templates
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {PRESET_SPEECHES.map((preset) => (
                <Chip
                  key={preset}
                  label={preset}
                  clickable
                  variant={sessionTitle === preset ? 'filled' : 'outlined'}
                  color={sessionTitle === preset ? 'primary' : 'default'}
                  onClick={() => handleSelectPreset(preset)}
                  sx={{
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </Box>
          </Box>

          <Alert severity="info" sx={{ borderRadius: 2, fontSize: '0.8125rem' }}>
            Starting a new session clears the live display for the projector and mobile guests so they focus on the next speech.
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          disabled={isSubmitting}
          startIcon={<AddCircleOutlinedIcon />}
          sx={{ fontWeight: 700, px: 3 }}
        >
          {isSubmitting ? 'Starting...' : 'Start New Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
