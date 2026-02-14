import mineflayer, { type Bot } from "mineflayer";
import { Vec3 } from "vec3";
import type { McMode, MinecraftConnectionConfig } from "./config.js";
import { pathfinder, Movements } from "mineflayer-pathfinder";
import collectblock from "mineflayer-collectblock";
import toolPlugin from "mineflayer-tool";
import minecraftData from "minecraft-data";

// ── Types ────────────────────────────────────────────────────────────────────

export type SessionState = "disconnected" | "connecting" | "ready";

export interface ChatEntry {
  timestamp: number;
  sender: string; // "" for system messages
  text: string;
}

export interface BotStatus {
  state: SessionState;
  mode: McMode;
  host: string | null;
  port: number | null;
  username: string | null;
  health: number | null;
  food: number | null;
  position: { x: number; y: number; z: number } | null;
  recentMessages: ChatEntry[];
}

export interface CommandResult {
  command: string;
  matchedResponse: string | null;
  timedOut: boolean;
  category: "success" | "permission_denied" | "unknown_command" | "timeout";
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_CHAT_BUFFER = 50;
const SPAWN_TIMEOUT_MS = 30_000;
const COMMAND_TIMEOUT_MS = 5_000;
const COMMAND_SUCCESS_PATTERNS = [
  /set the block/i,
  /filled \d+ blocks?/i,
  /gave .* to /i,
  /teleported/i,
  /summoned/i,
  /changed the time/i,
  /changed the weather/i,
  /game mode has been updated/i,
  /saved the game/i,
  /(\d+ )?entities? (?:have been |was )?killed/i,
  /\bok\b/i,
  /\d+ blocks? cloned/i,
  /gamerule .* (?:set to|is )/i,
  /set the time to /i,
  /changing to /i,
];
const COMMAND_PERMISSION_PATTERNS = [
  /you do not have permission/i,
  /i'?m sorry, (?:but )?you do not have permission/i,
  /requires operator/i,
  /unknown or incomplete command/i,
  /cannot execute/i,
  /not permitted/i,
];
const COMMAND_UNKNOWN_PATTERNS = [/unknown command/i, /unknown or incomplete command/i];

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(`[minecraft-session] ${msg}\n`);
}

/**
 * Get minecraft-data for a specific bot version in an ESM-safe way.
 */
function getMcData(version: string): any {
  return minecraftData(version);
}

// ── Session class ────────────────────────────────────────────────────────────

export class MinecraftSession {
  private bot: Bot | null = null;
  private state: SessionState = "disconnected";
  private readonly mode: McMode;
  private readonly connection: MinecraftConnectionConfig;
  private host: string | null = null;
  private port: number | null = null;
  private username: string | null = null;
  private chatBuffer: ChatEntry[] = [];
  private controlTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageWaiters: {
    patterns: RegExp[];
    resolve: (value: ChatEntry | null) => void;
    timer: NodeJS.Timeout;
  }[] = [];

  constructor(options: { mode: McMode; connection: MinecraftConnectionConfig }) {
    this.mode = options.mode;
    this.connection = options.connection;
    this.host = options.connection.host;
    this.port = options.connection.port;
    this.username = options.connection.username;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.state !== "disconnected") {
      throw new Error(
        `Cannot connect: session is currently '${this.state}'. Disconnect first.`
      );
    }

    const { host, port, username, version } = this.connection;

    this.state = "connecting";
    this.host = host;
    this.port = port;
    this.username = username;
    this.chatBuffer = [];

    log(`Connecting to ${host}:${port} as ${username}…`);

    const botOptions: mineflayer.BotOptions = {
      host,
      port,
      username,
      hideErrors: false,
    };
    if (version) {
      botOptions.version = version;
    }

    const bot = mineflayer.createBot(botOptions);
    this.bot = bot;

    try {
      // Wait for spawn (or error/kick)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out waiting for spawn after ${SPAWN_TIMEOUT_MS}ms`));
        }, SPAWN_TIMEOUT_MS);

        const cleanup = () => {
          clearTimeout(timeout);
          bot.removeListener("spawn", onSpawn);
          bot.removeListener("error", onError);
          bot.removeListener("kicked", onKicked);
          bot.removeListener("end", onEnd);
        };

        const onSpawn = () => {
          cleanup();
          resolve();
        };
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };
        const onKicked = (reason: string) => {
          cleanup();
          reject(new Error(`Kicked during login: ${reason}`));
        };
        const onEnd = (reason: string) => {
          cleanup();
          reject(new Error(`Connection ended during login: ${reason}`));
        };

        bot.once("spawn", onSpawn);
        bot.once("error", onError);
        bot.once("kicked", onKicked);
        bot.once("end", onEnd);
      });
    } catch (err) {
      try {
        bot.quit();
      } catch {
        // ignored
      }
      this.teardown();
      throw err;
    }

    // Spawn succeeded – initialize plugins for survival mode
    if (this.mode === "survival") {
      log("Initializing survival plugins...");
      bot.loadPlugin(pathfinder);
      (bot as any).loadPlugin(toolPlugin);
      (bot as any).loadPlugin(collectblock);

      // Initialize pathfinder movements with default settings
      const mcData = getMcData(bot.version);
      const defaultMovements = new Movements(bot);
      bot.pathfinder.setMovements(defaultMovements);
      log("Survival plugins initialized.");
    }

    // Spawn succeeded – wire long-lived listeners
    this.state = "ready";
    log(`Connected and spawned as ${bot.username}`);

    bot.on("chat", (sender: string, message: string) => {
      this.pushChat(sender, message);
    });

    bot.on("message", (jsonMsg) => {
      this.pushChat("", jsonMsg.toString());
    });

    bot.on("kicked", (reason: string) => {
      log(`Kicked: ${reason}`);
      this.pushChat("", `[Kicked] ${reason}`);
      this.teardown();
    });

    bot.on("error", (err: Error) => {
      log(`Bot error: ${err.message}`);
      this.pushChat("", `[Error] ${err.message}`);
    });

    bot.on("end", (reason: string) => {
      log(`Connection ended: ${reason}`);
      this.pushChat("", `[Disconnected] ${reason}`);
      this.teardown();
    });
  }

  disconnect(): void {
    if (this.state === "disconnected") {
      throw new Error("Bot is already disconnected.");
    }
    this.requireBot().quit();
    this.teardown();
    log("Disconnected by request.");
  }

  async reconnect(): Promise<void> {
    if (this.state !== "disconnected") {
      this.disconnect();
    }
    await this.connect();
  }

  // ── Status ───────────────────────────────────────────────────────────────

  getStatus(): BotStatus {
    const bot = this.bot;
    return {
      state: this.state,
      mode: this.mode,
      host: this.host,
      port: this.port,
      username: bot?.username ?? this.username,
      health: bot?.health ?? null,
      food: bot?.food ?? null,
      position: bot?.entity?.position
        ? {
            x: Math.round(bot.entity.position.x * 100) / 100,
            y: Math.round(bot.entity.position.y * 100) / 100,
            z: Math.round(bot.entity.position.z * 100) / 100,
          }
        : null,
      recentMessages: [...this.chatBuffer],
    };
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  sendChat(message: string): void {
    this.requireReady();
    this.requireBot().chat(message);
  }

  async executeCommand(command: string): Promise<CommandResult> {
    this.requireReady();
    const bot = this.requireBot();

    const normalizedCommand = this.normalizeCommand(command);
    const matchPatterns = [
      ...COMMAND_PERMISSION_PATTERNS,
      ...COMMAND_UNKNOWN_PATTERNS,
      ...COMMAND_SUCCESS_PATTERNS,
    ];

    const awaitFeedback = this.awaitMessage(matchPatterns, COMMAND_TIMEOUT_MS);
    bot.chat(normalizedCommand);
    const feedback = await awaitFeedback;

    if (!feedback) {
      return {
        command: normalizedCommand,
        matchedResponse: null,
        timedOut: true,
        category: "timeout",
      };
    }

    const text = feedback.text;
    const lower = text.toLowerCase();

    let category: CommandResult["category"] = "success";
    if (COMMAND_UNKNOWN_PATTERNS.some((pattern) => pattern.test(lower))) {
      category = "unknown_command";
    } else if (COMMAND_PERMISSION_PATTERNS.some((pattern) => pattern.test(lower))) {
      category = "permission_denied";
    }

    return {
      command: normalizedCommand,
      matchedResponse: text,
      timedOut: false,
      category,
    };
  }

  // ── Position ─────────────────────────────────────────────────────────────

  getPosition(): { x: number; y: number; z: number; yaw: number; pitch: number } {
    this.requireReady();
    const bot = this.requireBot();
    const pos = bot.entity.position;
    return {
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100,
      z: Math.round(pos.z * 100) / 100,
      yaw: Math.round(bot.entity.yaw * 100) / 100,
      pitch: Math.round(bot.entity.pitch * 100) / 100,
    };
  }

  // ── Look ─────────────────────────────────────────────────────────────────

  async lookAt(x: number, y: number, z: number): Promise<void> {
    this.requireReady();
    const bot = this.requireBot();
    await bot.lookAt(new Vec3(x, y, z));
  }

  // ── Movement controls ───────────────────────────────────────────────────

  setControl(
    direction: "forward" | "back" | "left" | "right" | "jump" | "sprint" | "sneak",
    active: boolean,
    durationMs?: number
  ): void {
    this.requireReady();
    const bot = this.requireBot();

    // Clear any existing timer for this direction
    const existing = this.controlTimers.get(direction);
    if (existing) {
      clearTimeout(existing);
      this.controlTimers.delete(direction);
    }

    bot.setControlState(direction, active);

    if (active && durationMs !== undefined && durationMs > 0) {
      const timer = setTimeout(() => {
        // Bot may have disconnected by now
        if (this.bot && this.state === "ready") {
          this.bot.setControlState(direction, false);
        }
        this.controlTimers.delete(direction);
      }, durationMs);
      // Allow the Node process to exit even if timers are pending
      timer.unref();
      this.controlTimers.set(direction, timer);
    }
  }

  stopAllControls(): void {
    this.requireReady();
    const bot = this.requireBot();

    // Clear all pending timers
    for (const [, timer] of this.controlTimers) {
      clearTimeout(timer);
    }
    this.controlTimers.clear();

    bot.clearControlStates();
  }

  // ── Inventory ────────────────────────────────────────────────────────────

  getInventory(): { slot: number; name: string; count: number; displayName: string }[] {
    this.requireReady();
    const bot = this.requireBot();
    return bot.inventory
      .items()
      .map((item) => ({
        slot: item.slot,
        name: item.name,
        count: item.count,
        displayName: item.displayName ?? item.name,
      }));
  }

  // ── Bot accessor (for mode-specific APIs like creative flight) ──────────

  /** Returns the underlying mineflayer Bot. Throws if not ready. */
  getRawBot(): Bot {
    this.requireReady();
    return this.requireBot();
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private pushChat(sender: string, text: string): void {
    const entry: ChatEntry = { timestamp: Date.now(), sender, text };
    this.chatBuffer.push(entry);
    if (this.chatBuffer.length > MAX_CHAT_BUFFER) {
      this.chatBuffer.shift();
    }

    for (let i = this.messageWaiters.length - 1; i >= 0; i--) {
      const waiter = this.messageWaiters[i];
      if (waiter.patterns.some((pattern) => pattern.test(text))) {
        clearTimeout(waiter.timer);
        waiter.resolve(entry);
        this.messageWaiters.splice(i, 1);
      }
    }
  }

  private awaitMessage(patterns: RegExp[], timeoutMs: number): Promise<ChatEntry | null> {
    return new Promise<ChatEntry | null>((resolve) => {
      const timer = setTimeout(() => {
        const index = this.messageWaiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) {
          this.messageWaiters.splice(index, 1);
        }
        resolve(null);
      }, timeoutMs);
      timer.unref();

      this.messageWaiters.push({
        patterns,
        resolve,
        timer,
      });
    });
  }

  private normalizeCommand(command: string): string {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new Error("Command cannot be empty.");
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  private requireBot(): Bot {
    if (!this.bot) {
      throw new Error("No bot instance exists.");
    }
    return this.bot;
  }

  private requireReady(): void {
    if (this.state !== "ready") {
      throw new Error(`Bot is not ready (current state: '${this.state}').`);
    }
  }

  private teardown(): void {
    // Clear control timers
    for (const [, timer] of this.controlTimers) {
      clearTimeout(timer);
    }
    this.controlTimers.clear();

    for (const waiter of this.messageWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    this.messageWaiters = [];

    this.bot = null;
    this.state = "disconnected";
  }
}
