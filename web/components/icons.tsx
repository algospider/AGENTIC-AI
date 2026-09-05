"use client";
import type { SVGProps } from "react";

// Hand-drawn-feel icon set: 24×24, 2px stroke, round caps — one family, no emoji,
// no text glyphs. Add new icons here, never inline ad-hoc characters.

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      width="16" height="16" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...props}>
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <path d="M12 5 L18.5 12 L12 19 L5.5 12 Z" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.6" fill="var(--accent-ink)" />
    </svg>
  );
}

export function SunIcon() {
  return (<Base><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Base>);
}
export function MoonIcon() {
  return (<Base><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></Base>);
}
export function DownloadIcon() {
  return (<Base><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Base>);
}
export function UploadIcon() {
  return (<Base><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Base>);
}
export function PlusIcon() {
  return (<Base><path d="M12 5v14M5 12h14" /></Base>);
}
export function TrashIcon() {
  return (<Base><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Base>);
}
export function PencilIcon() {
  return (<Base><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Base>);
}
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (<Base {...props}><path d="M20 6 9 17l-5-5" /></Base>);
}
export function XIcon() {
  return (<Base><path d="M18 6 6 18M6 6l12 12" /></Base>);
}
export function AlertIcon() {
  return (<Base><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></Base>);
}
export function InfoIcon() {
  return (<Base><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Base>);
}
export function ArrowRightIcon() {
  return (<Base><path d="M5 12h14M12 5l7 7-7 7" /></Base>);
}
export function PlayIcon() {
  return (<Base><path d="M6 4.5v15l13-7.5Z" /></Base>);
}
export function ChartIcon() {
  return (<Base><path d="M3 3v18h18" /><path d="M7 15l4-6 4 3 5-8" /></Base>);
}
export function WalletIcon() {
  return (<Base><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16V7" /><path d="M18 12h.01" /></Base>);
}
export function TargetIcon() {
  return (<Base><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Base>);
}
export function ChatIcon() {
  return (<Base><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></Base>);
}
export function DatabaseIcon() {
  return (<Base><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></Base>);
}
export function RefreshIcon() {
  return (<Base><path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" /><path d="M3 21v-5h5" /></Base>);
}
export function FlaskIcon() {
  return (<Base><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.3 21.5h11.4a2 2 0 0 0 1.8-3L14 9V3" /><path d="M7.5 14h9" /></Base>);
}
export function ScaleIcon() {
  return (<Base><path d="M12 3v18M5 7l7-4 7 4" /><path d="M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7ZM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7Z" /></Base>);
}
export function TrendUpIcon() {
  return (<Base><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></Base>);
}
export function UserIcon() {
  return (<Base><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Base>);
}
export function LogoutIcon() {
  return (<Base><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Base>);
}
export function BookmarkIcon() {
  return (<Base><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" /></Base>);
}
