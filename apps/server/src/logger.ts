const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_FORMAT = process.env.LOG_FORMAT || "json";

const LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LEVELS[LOG_LEVEL] ?? 1;

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
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
}

function log(level: LogEntry["level"], fields: string | (Omit<LogEntry, "timestamp" | "level">)) {
  if ((LEVELS[level] ?? 0) < currentLevel) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    ...(typeof fields === "string" ? { message: fields } : fields),
  };

  const output = LOG_FORMAT === "json" 
    ? JSON.stringify(entry)
    : `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message || ""} ${JSON.stringify(typeof fields === "object" ? fields : {})}`;
  
  console.log(output);
}

export const logger = {
  debug: (fields: string | Omit<LogEntry, "timestamp" | "level">) => log("debug", fields),
  info: (fields: string | Omit<LogEntry, "timestamp" | "level">) => log("info", fields),
  warn: (fields: string | Omit<LogEntry, "timestamp" | "level">) => log("warn", fields),
  error: (fields: string | Omit<LogEntry, "timestamp" | "level">) => log("error", fields),
};
