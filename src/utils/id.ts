import { randomBytes } from "crypto";

export function genId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = randomBytes(8);
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i]! % chars.length];
  }
  return result;
}
