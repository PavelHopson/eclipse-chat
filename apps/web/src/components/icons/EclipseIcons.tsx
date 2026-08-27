import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { MicrophoneSlashIcon } from "@phosphor-icons/react/dist/csr/MicrophoneSlash";
import { HeadphonesIcon } from "@phosphor-icons/react/dist/csr/Headphones";
import { SpeakerSlashIcon } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { PhoneDisconnectIcon } from "@phosphor-icons/react/dist/csr/PhoneDisconnect";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { VideoCameraSlashIcon } from "@phosphor-icons/react/dist/csr/VideoCameraSlash";
import { MonitorArrowUpIcon } from "@phosphor-icons/react/dist/csr/MonitorArrowUp";
import { MonitorIcon } from "@phosphor-icons/react/dist/csr/Monitor";
import { PulseIcon } from "@phosphor-icons/react/dist/csr/Pulse";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
type IconProps = { size?: number; className?: string };
const defaults = { weight: "regular" as const, "aria-hidden": true as const, focusable: false as const };
export function VoiceChannelIcon({ size = 18, className }: IconProps) {
  return <SpeakerHighIcon {...defaults} size={size} className={className} />;
}
export function MicStateIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  const Icon = off ? MicrophoneSlashIcon : MicrophoneIcon;
  return <Icon {...defaults} size={size} className={className} />;
}
export function HeadsetIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  const Icon = off ? SpeakerSlashIcon : HeadphonesIcon;
  return <Icon {...defaults} size={size} className={className} />;
}
export function HangupIcon({ size = 18, className }: IconProps) {
  return <PhoneDisconnectIcon {...defaults} size={size} className={className} />;
}
export function CameraLensIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  const Icon = off ? VideoCameraSlashIcon : VideoCameraIcon;
  return <Icon {...defaults} size={size} className={className} />;
}
export function ScreenShareIcon({ size = 18, className, off = false }: IconProps & { off?: boolean }) {
  const Icon = off ? MonitorIcon : MonitorArrowUpIcon;
  return <Icon {...defaults} size={size} className={className} />;
}
export function StatsPulseIcon({ size = 18, className }: IconProps) {
  return <PulseIcon {...defaults} size={size} className={className} />;
}
export function TuningIcon({ size = 18, className }: IconProps) {
  return <SlidersHorizontalIcon {...defaults} size={size} className={className} />;
}
