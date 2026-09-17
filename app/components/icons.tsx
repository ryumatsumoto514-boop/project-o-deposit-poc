export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.086l6.79-6.79a1 1 0 011.414-.006z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className ?? ""}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.169 2.63-1.516 2.63H3.72c-1.347 0-2.189-1.463-1.515-2.63l6.28-10.875zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.32-.17-1.95H10v3.69h5.38a4.6 4.6 0 01-1.99 3.02v2.5h3.22c1.89-1.74 2.99-4.3 2.99-7.26z" />
      <path fill="#34A853" d="M10 20c2.7 0 4.96-.9 6.61-2.43l-3.22-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.08v2.59A10 10 0 0010 20z" />
      <path fill="#FBBC05" d="M4.41 11.91A6.01 6.01 0 014.09 10c0-.66.11-1.31.32-1.91V5.5H1.08A10 10 0 000 10c0 1.61.39 3.14 1.08 4.5l3.33-2.59z" />
      <path fill="#EA4335" d="M10 3.96c1.47 0 2.78.5 3.82 1.5l2.86-2.86C14.95.99 12.7 0 10 0 6.09 0 2.71 2.24 1.08 5.5l3.33 2.59C5.2 5.72 7.4 3.96 10 3.96z" />
    </svg>
  );
}

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="4.5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 5.5l7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M2.5 6.5A2.5 2.5 0 015 4h10a1 1 0 011 1v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="2.5" y="6.5" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="11.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 1.5l6.5 2.6v5.1c0 4.2-2.8 7.9-6.5 9.3-3.7-1.4-6.5-5.1-6.5-9.3V4.1L10 1.5zm-1.03 10.72l4.47-4.47-1.06-1.06-3.41 3.4-1.38-1.37-1.06 1.06 2.44 2.44z"
        clipRule="evenodd"
      />
    </svg>
  );
}
