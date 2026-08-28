import { randomInt } from "node:crypto";

const TEMP_PASSWORD_ALPHABET =
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEMP_PASSWORD_LENGTH = 16;

export const PASSWORD_HASH_COST = 12;

export function generateTemporaryPassword(): string {
  let password = "";
  for (let index = 0; index < TEMP_PASSWORD_LENGTH; index += 1) {
    password +=
      TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return password;
}
