/**
 * Thin wrapper around Google Identity Services (GIS) "Sign in with Google" — the flow
 * Google recommends for proving who a user is (as opposed to the full OAuth Authorization
 * Code flow, which is for acting on a user's behalf against a Google API). We only need
 * the speaker's verified email, so this is all that's needed on the frontend; the ID
 * token itself is verified server-side before /ws/speaker is allowed to open.
 */

export interface GoogleIdentityClaims {
  email: string;
  name: string;
  picture: string;
}

interface GoogleIdInitConfig {
  client_id: string;
  callback: (response: { credential: string }) => void;
}

interface GoogleIdButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdInitConfig) => void;
          renderButton: (parent: HTMLElement, options: GoogleIdButtonOptions) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;

/** Lazily inject the GIS script — only the speaker console needs it, guests never load it. */
export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Decode (NOT verify — the backend verifies the signature) the ID token payload,
 * purely to show "Signed in as ..." in the UI.
 */
export function decodeGoogleIdToken(token: string): GoogleIdentityClaims | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return {
      email: claims.email ?? '',
      name: claims.name ?? claims.email ?? '',
      picture: claims.picture ?? '',
    };
  } catch {
    return null;
  }
}
