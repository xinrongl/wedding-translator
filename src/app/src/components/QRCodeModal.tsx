import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  Stack,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import LaunchIcon from '@mui/icons-material/Launch';

import type { WeddingContextData } from '../types';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  wedding: WeddingContextData;
  isDark?: boolean;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  wedding,
  isDark = true,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const mobileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#mobile`
      : '';

  useEffect(() => {
    if (!isOpen || !mobileUrl) return;

    QRCode.toDataURL(mobileUrl, {
      width: 360,
      margin: 2,
      color: {
        dark: '#1C1A17',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, mobileUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `joy-xinrong-wedding-subtitles-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="qr-code-dialog-title"
    >
      <DialogTitle id="qr-code-dialog-title" sx={{ m: 0, p: 2.5, pb: 1 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: isDark ? 'rgba(168, 199, 250, 0.12)' : 'rgba(11, 87, 208, 0.08)',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QrCode2Icon sx={{ fontSize: '1.25rem' }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Guest Mobile Subtitles
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {wedding.bride_name} &amp; {wedding.groom_name}
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

      <DialogContent sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontSize: '0.84rem' }}>
          Scan with a smartphone camera to read live English translations.
        </Typography>

        {/* High-contrast QR Container */}
        <Box
          sx={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 2,
            bgcolor: '#FFFFFF',
            borderRadius: 3,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          }}
        >
          {qrDataUrl ? (
            <Box
              component="img"
              src={qrDataUrl}
              alt="Scan for Live English Subtitles"
              sx={{
                width: 200,
                height: 200,
                borderRadius: 2,
                display: 'block',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 200,
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
              }}
            >
              <QrCode2Icon sx={{ fontSize: 48, opacity: 0.5 }} />
            </Box>
          )}
        </Box>

        {/* URL Pill & Copy */}
        <Box
          sx={{
            mt: 2.5,
            p: 1,
            pl: 2,
            pr: 1,
            borderRadius: '999px',
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'text.secondary',
              flex: 1,
              textAlign: 'left',
            }}
          >
            {mobileUrl}
          </Typography>

          <Tooltip title={copied ? 'Copied!' : 'Copy link'} arrow>
            <IconButton
              size="small"
              onClick={handleCopy}
              color={copied ? 'success' : 'default'}
              sx={{
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, justifyContent: 'space-between', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon fontSize="small" />}
          onClick={handleDownload}
          sx={{ flex: 1, borderRadius: '999px' }}
        >
          Download PNG
        </Button>

        <Button
          variant="contained"
          size="small"
          endIcon={<LaunchIcon fontSize="small" />}
          href={mobileUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ flex: 1, borderRadius: '999px' }}
        >
          Open View
        </Button>
      </DialogActions>
    </Dialog>
  );
};
