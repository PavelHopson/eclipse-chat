import { createContext } from "react";

export const VoiceMusicGainContext = createContext(1);
export const VoiceChatContext = createContext<{
  visible: boolean;
  reportUnread?: (unread: { total: number; mentions: number }) => void;
}>({ visible: true });
