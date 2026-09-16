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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95 duration-200 transition-colors ${
          isDark
            ? 'bg-[#1B1A18] border border-[rgba(194,162,101,0.3)] text-[#FAF8F5]'
            : 'bg-[#FAF8F5] bg-paper-texture border border-[#DFD7CB] text-[#1C1A17]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
            isDark
              ? 'text-stone-400 hover:text-[#FAF8F5] hover:bg-[#22201D]'
              : 'text-stone-400 hover:text-stone-800 hover:bg-[#EAE3D9]/60'
          }`}
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Stationery */}
        <div className="space-y-1 pt-2">
          <div
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm font-serif italic mb-2 ${
              isDark
                ? 'border-[#C2A265] text-[#C2A265] bg-[#22201D]'
                : 'border-[#C2A265] text-[#C2A265]'
            }`}
          >
            S
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#C2A265] font-semibold">
            Stones of the Yarra Valley • The Stable
          </p>
          <h2
            className={`font-serif text-2xl font-semibold tracking-wide transition-colors ${
              isDark ? 'text-[#FAF8F5]' : 'text-[#1C1A17]'
            }`}
          >
            {wedding.bride_name} &amp; {wedding.groom_name}
          </h2>
          <p
            className={`font-serif italic text-xs transition-colors ${
              isDark ? 'text-stone-400' : 'text-stone-500'
            }`}
          >
            Scan to view live English subtitles on your phone
          </p>
        </div>

        {/* QR Code Container */}
        <div
          className={`relative inline-block p-4 rounded-xl bg-white shadow-sm border ${
            isDark ? 'border-[rgba(194,162,101,0.4)]' : 'border-[#DFD7CB]'
          }`}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan for Live English Subtitles"
              className="w-56 h-56 mx-auto rounded-lg object-contain"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-stone-400">
              <QrCode className="w-10 h-10 animate-pulse text-[#C2A265]" />
            </div>
          )}
          <div
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-sans uppercase tracking-widest font-bold shadow-xs whitespace-nowrap ${
              isDark ? 'bg-[#C2A265] text-[#141311]' : 'bg-[#1C1A17] text-[#FAF8F5]'
            }`}
          >
            Guest Mobile View
          </div>
        </div>

        {/* URL Box & Copy */}
        <div className="space-y-2 pt-1">
          <div
            className={`flex items-center space-x-2 rounded-lg p-2 text-xs font-mono transition-colors ${
              isDark
                ? 'bg-[#22201D] border border-[rgba(194,162,101,0.25)] text-stone-200'
                : 'bg-[#F5EFEB] border border-[#DFD7CB] text-stone-700'
            }`}
          >
            <span className="truncate flex-1 text-left px-1">{mobileUrl}</span>
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded-md transition-colors flex items-center space-x-1 flex-shrink-0 ${
                isDark ? 'hover:bg-[#1B1A18] text-[#DFCA9B]' : 'hover:bg-[#EAE3D9] text-stone-800'
              }`}
              title="Copy mobile URL"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-sans font-bold text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-sans">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={handleDownload}
            className={`flex-1 py-3 px-4 rounded-md text-xs font-sans uppercase tracking-widest font-semibold flex items-center justify-center space-x-2 transition-all shadow-xs ${
              isDark
                ? 'border border-[rgba(194,162,101,0.3)] text-stone-200 hover:bg-[#22201D] hover:text-[#DFCA9B]'
                : 'border border-[#1C1A17]/30 text-stone-800 hover:bg-[#1C1A17] hover:text-[#FAF8F5]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
          <a
            href={mobileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 py-3 px-4 rounded-md text-xs font-sans uppercase tracking-widest font-semibold flex items-center justify-center space-x-2 transition-all shadow-xs ${
              isDark
                ? 'bg-[#C2A265] hover:bg-[#D4BC88] text-[#141311]'
                : 'bg-[#1C1A17] hover:bg-[#2B2824] text-[#FAF8F5]'
            }`}
          >
            <span>Open View</span>
            <ExternalLink className={`w-4 h-4 ${isDark ? 'text-[#141311]' : 'text-[#DFCA9B]'}`} />
          </a>
        </div>

        {/* Print Note */}
        <p className="text-[10px] text-stone-400 font-sans">
          Tip: Download the PNG to print on banquet table cards or ceremony booklets.
        </p>
      </div>
    </div>
  );
};
