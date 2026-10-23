// Logger estructurado (JSON por línea). Redacta campos sensibles: RN-05.
type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SENSITIVE_KEY = /pass(word)?|secret|token|cookie|authorization|hash/i;
const REDACTED = "[redactado]";

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redact(val, depth + 1),
    ]),
  );
}

function write(level: Level, message: string, fields: Fields = {}) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(redact(fields) as Fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
