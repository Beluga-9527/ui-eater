import type { ReactNode } from 'react';

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/** One small, consistent icon vocabulary for the whole fictional desktop. */
export function Icon({ name, size = 20, className = '', strokeWidth = 1.7 }: IconProps) {
  let drawing: ReactNode;
  switch (name) {
    case 'arrow-right':
      drawing = <path d="M4 12h15m-6-6 6 6-6 6" />;
      break;
    case 'arrow-up-right':
      drawing = <path d="M6 18 18 6M6 6h12v12" />;
      break;
    case 'play':
      drawing = <path d="m8 5 11 7-11 7Z" fill="currentColor" strokeLinejoin="round" />;
      break;
    case 'pause':
      drawing = <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>;
      break;
    case 'restart':
      drawing = <><path d="M4 10a8 8 0 1 1 1.7 7.2M4 4v6h6" /></>;
      break;
    case 'sound':
    case 'volume':
      drawing = <><path d="m10 5-5 4H2v6h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>;
      break;
    case 'muted':
      drawing = <><path d="m10 5-5 4H2v6h3l5 4ZM16 9l6 6m0-6-6 6" /></>;
      break;
    case 'expand':
      drawing = <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />;
      break;
    case 'help':
      drawing = <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3v.1" /></>;
      break;
    case 'x':
      drawing = <path d="m6 6 12 12M18 6 6 18" />;
      break;
    case 'minus':
      drawing = <path d="M5 12h14" />;
      break;
    case 'folder':
      drawing = <path d="M3 7V5h6l2 2h10v12H3Zm0 4h18" />;
      break;
    case 'file':
      drawing = <><path d="M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8m-8 4h5" /></>;
      break;
    case 'lock':
      drawing = <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>;
      break;
    case 'crosshair':
    case 'target':
      drawing = <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>;
      break;
    case 'cursor':
      drawing = <path d="m4 3 15 10-7 1-3 7Z" />;
      break;
    case 'chevron':
      drawing = <path d="m9 5 7 7-7 7" />;
      break;
    case 'check':
      drawing = <path d="m5 12 4 4L19 6" />;
      break;
    case 'spark':
      drawing = <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 3v3m-1.5-1.5h3" /></>;
      break;
    case 'settings':
      drawing = <><path d="m9 3-.6 2.2-2 .9-2.1-.6-2 3.4L4 10.5v2.9L2.3 15l2 3.4 2.1-.6 2 .9L9 21h4l.6-2.3 2-.9 2.1.6 2-3.4-1.7-1.6v-2.9L19.7 9l-2-3.4-2.1.6-2-.9L13 3Z" /><circle cx="11" cy="12" r="3" /></>;
      break;
    case 'terminal':
      drawing = <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3m6 0h4" /></>;
      break;
    case 'grip':
      drawing = <>{[7, 12, 17].map(y => <g key={y}><circle cx="9" cy={y} r=".8" fill="currentColor" /><circle cx="15" cy={y} r=".8" fill="currentColor" /></g>)}</>;
      break;
    case 'mouse':
      drawing = <><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 2v7m-6 1h12" /></>;
      break;
    case 'bolt':
      drawing = <path d="m13 2-9 12h7l-1 8L21 9h-8Z" />;
      break;
    case 'shield':
      drawing = <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>;
      break;
    case 'info':
    default:
      drawing = <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>;
  }

  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {drawing}
    </svg>
  );
}

export default Icon;
