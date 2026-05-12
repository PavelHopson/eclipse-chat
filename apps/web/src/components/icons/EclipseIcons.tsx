type IconProps = {
  size?: number;
  className?: string;
};

function baseProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function VoiceChannelIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M10.8 5.4 6.1 9H2.6v6h3.5l4.7 3.6V5.4Z" />
      <path d="M18.9 7.1a7.8 7.8 0 0 1 0 9.8" />
      <path d="M16 9.6a4.2 4.2 0 0 1 0 4.8" />
      <path d="M20.8 4.3a11.2 11.2 0 0 1 0 15.4" />
    </svg>
  );
}

export function MicStateIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  return off ? (
    <svg {...baseProps(size)} className={className}>
      <path d="M9.4 9.2v2.7a2.9 2.9 0 0 0 4.9 2.1" />
      <path d="M14.7 9.6V4.7a2.9 2.9 0 0 0-5.8-.4" />
      <path d="M18.5 11.3a6.5 6.5 0 0 1-1.2 3.7 6.6 6.6 0 0 1-5.3 2.6 6.6 6.6 0 0 1-6.6-6.3" />
      <path d="M12 19v3" />
      <path d="M8.3 22h7.4" />
      <path d="M3 3 21 21" />
    </svg>
  ) : (
    <svg {...baseProps(size)} className={className}>
      <rect x="9.1" y="2.3" width="5.8" height="11.2" rx="2.9" />
      <path d="M18.5 10.6v1.3a6.5 6.5 0 0 1-13 0v-1.3" />
      <path d="M12 18.4V22" />
      <path d="M8.2 22h7.6" />
    </svg>
  );
}

export function HeadsetIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  return off ? (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 13.8v4.2a2 2 0 0 0 2 2h1.3a1.7 1.7 0 0 0 1.7-1.7V15a1.7 1.7 0 0 0-1.7-1.7H3Z" />
      <path d="M21 13.8V18a2 2 0 0 1-2 2h-1.3a1.7 1.7 0 0 1-1.7-1.7V15a1.7 1.7 0 0 1 1.7-1.7H21Z" />
      <path d="M3.5 13.8a8.5 8.5 0 0 1 13.7-6.8" />
      <path d="M20.5 12.2A8.5 8.5 0 0 0 18 6.3" />
      <path d="M3 3 21 21" />
    </svg>
  ) : (
    <svg {...baseProps(size)} className={className}>
      <path d="M3.2 13.6a8.8 8.8 0 0 1 17.6 0" />
      <path d="M4 13.8h2.5A1.5 1.5 0 0 1 8 15.3v3A1.7 1.7 0 0 1 6.3 20H5a2 2 0 0 1-2-2v-4.2Z" />
      <path d="M20 13.8h-2.5a1.5 1.5 0 0 0-1.5 1.5v3A1.7 1.7 0 0 0 17.7 20H19a2 2 0 0 0 2-2v-4.2Z" />
    </svg>
  );
}

export function HangupIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M4.7 15.8a13.1 13.1 0 0 1 14.6 0" />
      <path d="m8 13.6 1.5 2.5" />
      <path d="m16 13.6-1.5 2.5" />
      <path d="M4.7 15.8 3 19.5" />
      <path d="m19.3 15.8 1.7 3.7" />
    </svg>
  );
}

export function CameraLensIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  return off ? (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="6.6" width="13.2" height="10.8" rx="2.2" />
      <path d="m16.2 10.1 4.8-2.5v8.8l-4.8-2.5" />
      <path d="M3 3 21 21" />
    </svg>
  ) : (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="6.6" width="13.2" height="10.8" rx="2.2" />
      <path d="m16.2 10.1 4.8-2.5v8.8l-4.8-2.5" />
      <circle cx="9.6" cy="12" r="2.1" />
    </svg>
  );
}

export function ScreenShareIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  return off ? (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="4.4" width="18" height="12.6" rx="2.2" />
      <path d="M8.4 20h7.2" />
      <path d="M12 17v3" />
      <path d="M3 3 21 21" />
    </svg>
  ) : (
    <svg {...baseProps(size)} className={className}>
      <rect x="3" y="4.4" width="18" height="12.6" rx="2.2" />
      <path d="m10 8.3 4 3.7-4 3.7" />
      <path d="M8.4 20h7.2" />
      <path d="M12 17v3" />
    </svg>
  );
}

export function StatsPulseIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M3 18h3.2l2.1-5.5 3.2 7 3-9.2 2.1 4.2H21" />
      <path d="M3 6.4h18" opacity="0.32" />
    </svg>
  );
}

export function TuningIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M4 6h7" />
      <path d="M15 6h5" />
      <circle cx="12" cy="6" r="2" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <circle cx="9" cy="12" r="2" />
      <path d="M4 18h9" />
      <path d="M17 18h3" />
      <circle cx="15" cy="18" r="2" />
    </svg>
  );
}
