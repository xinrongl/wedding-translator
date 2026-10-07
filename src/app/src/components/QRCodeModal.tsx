import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, Copy, Check, ExternalLink, QrCode } from 'lucide-react';
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
        dark: '#1C1A17', // Stones Charcoal
        light: '#FFFFFF', // Pure white background for maximum camera contrast
      },
      errorCorrectionLevel: 'H',
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, mobileUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-[28px] shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95 duration-200 transition-colors overflow-hidden ${
          isDark
            ? 'bg-[#1E1F22] border border-[#333538] text-[#E3E2E6]'
            : 'bg-[#FFFFFF] border border-[#DEE2E6] text-[#1D1B20]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Google 4-color Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 google-gradient-bar" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
            isDark
              ? 'text-stone-400 hover:text-white hover:bg-[#282A2E]'
              : 'text-stone-500 hover:text-stone-900 hover:bg-[#F0F4F9]'
          }`}
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="space-y-1 pt-2">
          <div
            className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl mb-1 ${
              isDark
                ? 'bg-[#0B57D0]/20 text-[#A8C7FA]'
                : 'bg-[#E8F0FE] text-[#0B57D0]'
            }`}
          >
            <QrCode className="w-5 h-5" />
          </div>
          <p className={`text-[11px] uppercase tracking-widest font-semibold ${isDark ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`}>
            Live Wedding Translation
          </p>
          <h2 className="text-2xl font-bold tracking-tight">
            {wedding.bride_name} &amp; {wedding.groom_name}
          </h2>
          <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
            Scan to view live English subtitles on any smartphone
          </p>
        </div>

        {/* QR Code Container */}
        <div
          className={`relative inline-block p-4 rounded-3xl shadow-sm border ${
            isDark ? 'bg-white border-[#333538]' : 'bg-white border-[#E0E2EC]'
          }`}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan for Live English Subtitles"
              className="w-52 h-52 mx-auto rounded-2xl object-contain"
            />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-stone-400">
              <QrCode className={`w-10 h-10 animate-pulse ${isDark ? 'text-[#A8C7FA]' : 'text-[#0B57D0]'}`} />
            </div>
          )}
          <div
            className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-sans uppercase tracking-wider font-bold shadow-sm whitespace-nowrap ${
              isDark ? 'bg-[#A8C7FA] text-[#041E49]' : 'bg-[#0B57D0] text-white'
            }`}
          >
            Guest Mobile View
          </div>
        </div>

        {/* URL Box & Copy */}
        <div className="space-y-2 pt-1">
          <div
            className={`flex items-center space-x-2 rounded-2xl p-2.5 text-xs font-mono transition-colors ${
              isDark
                ? 'bg-[#282A2E] border border-[#3C4043] text-stone-200'
                : 'bg-[#F0F4F9] border border-[#DEE2E6] text-stone-700'
            }`}
          >
            <span className="truncate flex-1 text-left px-1.5">{mobileUrl}</span>
            <button
              onClick={handleCopy}
              className={`p-2 rounded-full transition-colors flex items-center space-x-1 flex-shrink-0 ${
                isDark ? 'hover:bg-[#333538] text-[#A8C7FA]' : 'hover:bg-[#E8F0FE] text-[#0B57D0]'
              }`}
              title="Copy mobile URL"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-sans font-medium text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-[11px] font-sans font-medium">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={handleDownload}
            className={`flex-1 py-3 px-4 rounded-full text-xs font-sans font-medium flex items-center justify-center space-x-2 transition-all border ${
              isDark
                ? 'border-[#3C4043] text-stone-200 hover:bg-[#282A2E]'
                : 'border-[#C4C7C5] text-stone-700 hover:bg-[#F0F4F9]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
          <a
            href={mobileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 py-3 px-4 rounded-full text-xs font-sans font-medium flex items-center justify-center space-x-2 transition-all shadow-sm ${
              isDark
                ? 'bg-[#A8C7FA] hover:bg-[#D3E3FD] text-[#041E49]'
                : 'bg-[#0B57D0] hover:bg-[#0842A0] text-white'
            }`}
          >
            <span>Open View</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Print Note */}
        <p className={`text-[11px] ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
          Tip: Download the QR code PNG to print on banquet table cards or program booklets.
        </p>
      </div>
    </div>
  );
};
