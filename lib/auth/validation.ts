export const validUsername = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(value);
export const validPassword = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 8 && value.length <= 128;
