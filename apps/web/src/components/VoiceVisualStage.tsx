import { useState, type ReactNode } from "react";
import { PushPinIcon } from "@phosphor-icons/react/dist/csr/PushPin";
import type { VoiceVisualTrack, VoiceParticipant } from "../hooks/useVoice";
import { Avatar } from "./Avatar";
import { CameraLensIcon, ScreenShareIcon } from "./icons/EclipseIcons";

export function VoiceVisualStage({ channelId, tracks, participants, avatar, renderTrack, openParticipant }: {
  channelId: string;
  tracks: VoiceVisualTrack[];
  participants: VoiceParticipant[];
  avatar: (id: string) => string | null;
  renderTrack: (track: VoiceVisualTrack) => ReactNode;
  openParticipant: (participant: VoiceParticipant, event: React.MouseEvent) => void;
}) {
  const [pinned, setPinned] = useState<{ channel: string; id: string } | null>(null);
  const chosen = pinned?.channel === channelId ? tracks.find(track => track.id === pinned.id) : undefined;
  const active = chosen ?? tracks.find(track => track.source === "screen") ?? tracks[0];
  if (!active) return null;
  const audioOnly = participants.filter(person => !tracks.some(track => track.identity === person.identity));
  return <div className="ec-voice-visual-stage">
    <div className="ec-voice-visual-stage__main">
      {renderTrack(active)}
      {chosen && <button type="button" className="ec-voice-visual-stage__unpin" onClick={() => setPinned(null)}>
        <PushPinIcon size={14} aria-hidden />Снять закрепление
      </button>}
    </div>
    <div className="ec-voice-visual-stage__filmstrip" aria-label="Источники и участники звонка">
      {tracks.map(track => <button type="button" key={track.id}
        className="ec-voice-source" aria-pressed={active.id === track.id}
        aria-label={"Закрепить: " + track.name + (track.source === "screen" ? ", экран" : ", камера")}
        onClick={() => setPinned({ channel: channelId, id: track.id })}>
        <Avatar name={track.name} url={avatar(track.identity)} size={30} />
        <span><strong>{track.name}{track.isLocal ? " · ты" : ""}</strong><small>
          {track.source === "screen" ? <ScreenShareIcon size={12} /> : <CameraLensIcon size={12} />}
          {track.source === "screen" ? "Экран" : "Камера"}
        </small></span>
        {chosen?.id === track.id && <PushPinIcon size={13} aria-hidden />}
      </button>)}
      {audioOnly.map(person => <button key={person.identity} type="button" className="ec-voice-source"
        data-speaking={person.isSpeaking && !person.isMicMuted || undefined}
        onClick={event => openParticipant(person, event)}
        aria-label={"Настройки участника " + person.name}>
        <Avatar name={person.name} url={avatar(person.identity)} size={30} />
        <span><strong>{person.name}</strong><small>{person.isMicMuted ? "Микрофон выкл." : person.isSpeaking ? "Говорит" : "В звонке"}</small></span>
      </button>)}
    </div>
  </div>;
}
