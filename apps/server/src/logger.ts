const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_FORMAT = process.env.LOG_FORMAT || "json";
const LOG_CATEGORIES = process.env.LOG_CATEGORIES
  ? new Set(process.env.LOG_CATEGORIES.split(",").map((c) => c.trim()))
  : null;

const LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LEVELS[LOG_LEVEL] ?? 1;

type LogEntry = {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  category?: string;
  room?: string;
  tick?: number;
  clientId?: string;
  intent?: string;
  posBefore?: { x: number; y: number };
  posAfter?: { x: number; y: number };
  result?: "success" | "failed" | "error";
  damage?: number;
  hpAfter?: number;
  message?: string;
  error?: unknown;
  [key: string]: unknown;
};

type LogFields = string | Omit<LogEntry, "timestamp" | "level">;

function log(level: LogEntry["level"], fields: LogFields) {
  if ((LEVELS[level] ?? 0) < currentLevel) return;

  const resolved = typeof fields === "string" ? { message: fields } : fields;

  if (LOG_CATEGORIES && resolved.category && !LOG_CATEGORIES.has(resolved.category)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    ...resolved,
  };

  let output: string;
  if (LOG_FORMAT === "json") {
    output = JSON.stringify(entry);
  } else {
    const category = entry.category ? `[${entry.category.toUpperCase()}] ` : "";
    const rest = { ...resolved } as Record<string, unknown>;
    delete rest.message;
    delete rest.category;
    const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    output = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${category}${entry.message ?? ""}${extras}`;
  }

  console.log(output);
}

type CategoryLogger = {
  debug: (fields: LogFields) => void;
  info: (fields: LogFields) => void;
  warn: (fields: LogFields) => void;
  error: (fields: LogFields) => void;
};

export function createCategoryLogger(category: string): CategoryLogger {
  const withCategory = (fields: LogFields): LogFields =>
    typeof fields === "string"
      ? { message: fields, category }
      : { ...fields, category };

  return {
    debug: (fields) => log("debug", withCategory(fields)),
    info: (fields) => log("info", withCategory(fields)),
    warn: (fields) => log("warn", withCategory(fields)),
    error: (fields) => log("error", withCategory(fields)),
  };
}

export const logger = {
  debug: (fields: LogFields) => log("debug", fields),
  info: (fields: LogFields) => log("info", fields),
  warn: (fields: LogFields) => log("warn", fields),
  error: (fields: LogFields) => log("error", fields),
};
