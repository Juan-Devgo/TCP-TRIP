/**
 * Server logging: one line per event.
 *
 * In production every line is a JSON object with `level` and `message`, which
 * is what Railway parses into filterable attributes (`@level:error`,
 * `@path:/api/protocols`). Outside production the same fields print as plain
 * text, because a JSON wall is unreadable in a terminal.
 *
 * Never log a secret: callers pass booleans ("is it set?"), not values.
 */

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const json = process.env.NODE_ENV === "production";

function write(level: Level, message: string, fields: Fields = {}): void {
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (json) {
    sink(JSON.stringify({ level, message, ...fields }));
    return;
  }

  const rest = Object.entries(fields)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
  sink(rest ? `[${level}] ${message} ${rest}` : `[${level}] ${message}`);
}

export const log = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

/** An error as loggable fields — `Error` objects stringify to `{}` in JSON. */
export function errorFields(error: unknown): Fields {
  if (error instanceof Error) {
    return { error: error.message, name: error.name, stack: error.stack };
  }
  return { error: String(error) };
}

/** Resident memory in MB, the number that decides an OOM kill. */
export function memoryFields(): Fields {
  const { rss, heapUsed } = process.memoryUsage();
  return { rssMb: Math.round(rss / 1048576), heapMb: Math.round(heapUsed / 1048576) };
}
