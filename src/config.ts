export type McMode = "creative" | "survival";

export interface MinecraftConnectionConfig {
  host: string;
  port: number;
  username: string;
  version?: string;
}

export interface AppConfig {
  mode: McMode;
  autoConnect: boolean;
  connection: MinecraftConnectionConfig;
}

const DEFAULT_MODE: McMode = "creative";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 25565;
const DEFAULT_USERNAME = "mcp-bot";
const DEFAULT_AUTO_CONNECT = true;

function parseMode(value: string | undefined): McMode {
  if (!value) {
    return DEFAULT_MODE;
  }
  if (value === "creative" || value === "survival") {
    return value;
  }
  throw new Error(`Invalid MC_MODE: '${value}'. Expected 'creative' or 'survival'.`);
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid MC_PORT: '${value}'. Expected integer in range 1-65535.`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new Error(
    `Invalid MC_AUTO_CONNECT: '${value}'. Expected true/false, 1/0, yes/no, on/off.`
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = parseMode(env.MC_MODE);
  const host = env.MC_HOST?.trim() || DEFAULT_HOST;
  const port = parsePort(env.MC_PORT);
  const username = env.MC_USERNAME?.trim() || DEFAULT_USERNAME;
  const version = env.MC_VERSION?.trim() || undefined;
  const autoConnect = parseBoolean(env.MC_AUTO_CONNECT, DEFAULT_AUTO_CONNECT);

  return {
    mode,
    autoConnect,
    connection: {
      host,
      port,
      username,
      version,
    },
  };
}
