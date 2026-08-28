import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";

/** Both glyphs stay mounted; only opacity/transform changes, never button geometry. */
export function PlayerStateIcon({ playing, size = 20 }: { playing: boolean; size?: number }) {
  return <span className="ec-player-state" data-playing={playing} aria-hidden style={{ width: size, height: size }}>
    <PlayIcon size={size} weight="fill" /><PauseIcon size={size} weight="fill" />
  </span>;
}
