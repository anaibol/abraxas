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
  level: string;
  room?: string;
  tick?: number;
  clientId?: string;
  intent?: string;
  posBefore?: { x: number; y: number };
  posAfter?: { x: number; y: number };
  result?: string;
  damage?: number;
  hpAfter?: number;
  [key: string]: unknown;
}

function log(level: string, fields: Omit<LogEntry, "timestamp" | "level">) {
  if ((LEVELS[level] ?? 0) < currentLevel) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  };

  if (LOG_FORMAT === "json") {
    console.log(JSON.stringify(entry));
  } else {
    console.log(
      `[${entry.timestamp}] ${entry.level.toUpperCase()} ${JSON.stringify(fields)}`
    );
  }
}

export const logger = {
  debug: (fields: Omit<LogEntry, "timestamp" | "level">) => log("debug", fields),
  info: (fields: Omit<LogEntry, "timestamp" | "level">) => log("info", fields),
  warn: (fields: Omit<LogEntry, "timestamp" | "level">) => log("warn", fields),
  error: (fields: Omit<LogEntry, "timestamp" | "level">) => log("error", fields),
};
