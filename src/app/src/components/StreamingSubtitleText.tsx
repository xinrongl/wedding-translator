import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

interface StreamingSubtitleTextProps {
  /** Target text to stream (e.g. activePartial.english or activePartial.chinese) */
  text: string;
  /** Whether the text is Chinese/CJK (character-by-character) or Latin/English (word-by-word) */
  isChinese?: boolean;
  /** Whether to show a pulsing cursor at the stream tip */
  showCursor?: boolean;
  /** Custom cursor color */
  cursorColor?: string;
  /** Base interval in ms between tokens (default: 45ms for English, 35ms for Chinese) */
  baseIntervalMs?: number;
  /** Additional MUI sx styling */
  sx?: SxProps<Theme>;
  /** CSS class name for projector or tailwind views */
  className?: string;
  /** Component tag to render (default: 'span') */
  component?: React.ElementType;
}

/**
 * Tokenize string into words or characters for smooth streaming.
 */
function tokenize(text: string, isChinese: boolean): string[] {
  if (!text) return [];
  if (isChinese) {
    // Array.from correctly splits Unicode CJK characters and emoji
    return Array.from(text);
  }
  // For English: split on word boundaries keeping whitespace
  const tokens: string[] = [];
  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (w) tokens.push(w);
  }
  return tokens;
}

export const StreamingSubtitleText: React.FC<StreamingSubtitleTextProps> = ({
  text,
  isChinese = false,
  showCursor = true,
  cursorColor = 'currentColor',
  baseIntervalMs,
  sx,
  className,
  component: Component = 'span',
}) => {
  const [displayedText, setDisplayedText] = useState<string>(text);
  const targetTextRef = useRef<string>(text);
  const displayedTextRef = useRef<string>(text);
  const timerRef = useRef<number | null>(null);

  targetTextRef.current = text;
  displayedTextRef.current = displayedText;

  const defaultInterval = isChinese ? 30 : 45;
  const speed = baseIntervalMs ?? defaultInterval;

  useEffect(() => {
    // If text was cleared, immediately clear displayed text
    if (!text) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDisplayedText('');
      return;
    }

    // If current displayed text is not a prefix of text (new sentence started), reset immediately to first token
    const current = displayedTextRef.current;
    if (current && !text.startsWith(current)) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const initialTokens = tokenize(text, isChinese);
      const initial = initialTokens.slice(0, 1).join('');
      setDisplayedText(initial);
      displayedTextRef.current = initial;
    }

    // Function to step-advance tokens towards target text
    const step = () => {
      const target = targetTextRef.current;
      const curr = displayedTextRef.current;

      if (curr === target) {
        timerRef.current = null;
        return;
      }

      const targetTokens = tokenize(target, isChinese);
      const currTokens = tokenize(curr, isChinese);

      // Next token index
      const nextIndex = currTokens.length + 1;
      const nextText = targetTokens.slice(0, nextIndex).join('');

      setDisplayedText(nextText);
      displayedTextRef.current = nextText;

      if (nextText !== target) {
        // Dynamic acceleration: if backlog is large, speed up so we never lag behind live speech
        const backlog = targetTokens.length - nextIndex;
        let delay = speed;
        if (backlog > 15) {
          delay = Math.max(12, Math.floor(speed * 0.25));
        } else if (backlog > 6) {
          delay = Math.max(18, Math.floor(speed * 0.45));
        } else if (backlog > 2) {
          delay = Math.max(25, Math.floor(speed * 0.7));
        }

        timerRef.current = window.setTimeout(step, delay);
      } else {
        timerRef.current = null;
      }
    };

    if (timerRef.current === null && displayedTextRef.current !== text) {
      timerRef.current = window.setTimeout(step, speed);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, isChinese, speed]);

  const isStreaming = displayedText !== text || !text.endsWith('.');

  return (
    <Box component={Component} sx={sx} className={className}>
      {displayedText}
      {showCursor && (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: isChinese ? 3 : 2,
            height: '0.9em',
            ml: 0.5,
            verticalAlign: 'middle',
            bgcolor: cursorColor,
            animation: isStreaming ? 'pulse 0.8s infinite' : 'none',
            opacity: isStreaming ? 0.9 : 0.4,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}
    </Box>
  );
};
