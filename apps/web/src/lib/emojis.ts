import { apiJson } from "./api";

/**
 * v1.2.21 — Custom emoji API client. Backend MVP — v1.2.20.
 * Парсер `:shortcode:` в RichContent и picker UI — отдельные слайсы.
 */

export type ServerEmoji = {
  id: string;
  shortcode: string;
  url: string;
  createdAt: string;
  uploader: { id: string; displayName: string } | null;
};

export async function listServerEmojis(serverId: string): Promise<ServerEmoji[]> {
  const res = await apiJson<{ emojis: ServerEmoji[] }>(
    `/api/servers/${encodeURIComponent(serverId)}/emojis`,
  );
  return res.emojis;
}

export type UploadEmojiInput = {
  shortcode: string;
  contentType: string;
  dataBase64: string;
};

export async function uploadServerEmoji(
  serverId: string,
  input: UploadEmojiInput,
): Promise<ServerEmoji> {
  const res = await apiJson<{ emoji: ServerEmoji }>(
    `/api/servers/${encodeURIComponent(serverId)}/emojis`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return res.emoji;
}

export async function deleteServerEmoji(emojiId: string): Promise<void> {
  await apiJson(`/api/emojis/${encodeURIComponent(emojiId)}`, {
    method: "DELETE",
  });
}
