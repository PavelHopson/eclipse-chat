/**
 * FileReader → base64 без префикса `data:...;base64,`.
 *
 * Используется в avatar upload (useProfile) и attachment upload
 * (useMessages.sendMessage). Backend ожидает base64 чистый, без
 * data-URI префикса.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result"));
        return;
      }
      const idx = result.indexOf("base64,");
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.readAsDataURL(file);
  });
}
