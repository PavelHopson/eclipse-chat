import { useCallback, useState } from "react";
import { panelWidth } from "../lib/conversationNavigation";

const WIDTH_KEY = "ec.discussion.width";
function storedWidth() {
  try { return panelWidth(Number(localStorage.getItem(WIDTH_KEY) || 400)); } catch { return 400; }
}
export function useWorkspaceLayout() {
  // Focus is session-only. Reopening the app never silently hides navigation.
  const [focused, setFocused] = useState(false);
  const [width, setWidth] = useState(storedWidth);
  const resize = useCallback((next: number) => {
    const safe = panelWidth(next);
    setWidth(safe);
    try { localStorage.setItem(WIDTH_KEY, String(safe)); } catch { /* Preferences are optional. */ }
  }, []);
  return { focused, toggle: () => setFocused(value => !value), width, resize };
}
