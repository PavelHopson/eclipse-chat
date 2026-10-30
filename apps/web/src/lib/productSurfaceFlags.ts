/**
 * Chat keeps communication as its primary surface. Agent Office is retained
 * as a reversible migration escape hatch while AI workflows move to DnD Forge.
 *
 * The flag is intentionally opt-in: production must not expose the legacy AI
 * surface unless it is explicitly enabled for a migration or rollback.
 */
export const CHAT_AI_OFFICE_ENABLED = import.meta.env.VITE_CHAT_AI_OFFICE_ENABLED === "1";
