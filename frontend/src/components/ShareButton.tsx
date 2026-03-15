/**
 * ShareButton - Share join link via native share sheet (mobile) or clipboard (desktop)
 * Works across mobile and desktop browsers.
 */

import { useState, useCallback } from 'react';

interface ShareButtonProps {
  roomCode: string;
  eventName?: string;
  isTournament?: boolean;
  /** Render as a compact inline button (for headers) vs full-width */
  compact?: boolean;
}

export default function ShareButton({
  roomCode,
  eventName,
  isTournament = false,
  compact = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const joinLink = `${window.location.origin}/join/${roomCode}`;
  const shareTitle = `Join ${eventName || 'my room'} on SmallBets.live`;
  const shareText = `Join my ${isTournament ? 'tournament' : 'betting room'} on SmallBets.live! Code: ${roomCode}`;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = joinLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [joinLink]);

  const handleShare = useCallback(async () => {
    // Always copy to clipboard first for immediate feedback
    await copyToClipboard();
  }, [copyToClipboard]);

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: joinLink });
      } catch {
        // User cancelled — ignore
      }
    }
  }, [shareTitle, shareText, joinLink]);

  const hasNativeShare = typeof navigator.share === 'function';

  if (compact) {
    return (
      <span className="share-btn--icon-group">
        <button
          className={`share-btn share-btn--icon ${copied ? 'share-btn--copied' : ''}`}
          onClick={handleShare}
          aria-label="Copy room link"
          title="Copy link"
        >
          {copied ? <CheckIcon /> : <LinkIcon />}
        </button>
        {hasNativeShare && (
          <button
            className="share-btn share-btn--icon"
            onClick={handleNativeShare}
            aria-label="Share room link"
            title="Share"
          >
            <ShareIcon />
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="share-btn-group">
      <div className="share-btn--row">
        <button
          className={`share-btn share-btn--full ${copied ? 'share-btn--copied' : ''}`}
          onClick={handleShare}
        >
          {copied ? (
            <>
              <CheckIcon />
              <span>Link Copied!</span>
            </>
          ) : (
            <>
              <LinkIcon />
              <span>Copy Invite Link</span>
            </>
          )}
        </button>
        {hasNativeShare && (
          <button
            className="share-btn share-btn--full share-btn--native"
            onClick={handleNativeShare}
          >
            <ShareIcon />
            <span>Share</span>
          </button>
        )}
      </div>
      <div className="share-btn-code">
        Code: <strong>{roomCode}</strong>
      </div>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg
      className="share-btn-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      className="share-btn-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="share-btn-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
