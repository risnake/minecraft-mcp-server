import { z } from "zod";

// ── send_chat ────────────────────────────────────────────────────────────────

export const SendChatSchema = {
  message: z.string().min(1).max(256).describe("Chat message to send (max 256 chars)"),
};

// ── look_at ──────────────────────────────────────────────────────────────────

export const LookAtSchema = {
  x: z.number().describe("Target X coordinate"),
  y: z.number().describe("Target Y coordinate"),
  z: z.number().describe("Target Z coordinate"),
};

// ── move_control ─────────────────────────────────────────────────────────────

export const MoveControlSchema = {
  direction: z
    .enum(["forward", "back", "left", "right", "jump", "sprint", "sneak"])
    .describe("Movement control to set"),
  active: z.boolean().describe("Whether to activate (true) or deactivate (false) the control"),
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(30_000)
    .optional()
    .describe(
      "If provided, automatically deactivate the control after this many milliseconds (max 30 s)"
    ),
};

// ── creative-mode tool schemas ───────────────────────────────────────────────

export const SetBlockModeSchema = z.enum(["replace", "destroy", "keep"]);

export const SetblockSchema = {
  x: z.number().int().describe("Target X coordinate"),
  y: z.number().int().describe("Target Y coordinate"),
  z: z.number().int().describe("Target Z coordinate"),
  block: z.string().min(1).describe("Minecraft block id/state string"),
  mode: SetBlockModeSchema.optional().describe("setblock mode (default replace)"),
};

export const FillModeSchema = z.enum(["replace", "destroy", "keep", "hollow", "outline"]);

export const FillSchema = {
  x1: z.number().int().describe("First corner X coordinate"),
  y1: z.number().int().describe("First corner Y coordinate"),
  z1: z.number().int().describe("First corner Z coordinate"),
  x2: z.number().int().describe("Second corner X coordinate"),
  y2: z.number().int().describe("Second corner Y coordinate"),
  z2: z.number().int().describe("Second corner Z coordinate"),
  block: z.string().min(1).describe("Minecraft block id/state string"),
  mode: FillModeSchema.optional().describe("fill mode (default replace)"),
};

export const CloneMaskModeSchema = z.enum(["replace", "masked", "filtered"]);
export const CloneModeModeSchema = z.enum(["normal", "force", "move"]);

export const CloneAreaSchema = {
  x1: z.number().int().describe("Source region first corner X"),
  y1: z.number().int().describe("Source region first corner Y"),
  z1: z.number().int().describe("Source region first corner Z"),
  x2: z.number().int().describe("Source region second corner X"),
  y2: z.number().int().describe("Source region second corner Y"),
  z2: z.number().int().describe("Source region second corner Z"),
  dx: z.number().int().describe("Destination lower-NW corner X"),
  dy: z.number().int().describe("Destination lower-NW corner Y"),
  dz: z.number().int().describe("Destination lower-NW corner Z"),
  maskMode: CloneMaskModeSchema.optional().describe("Mask mode (default replace)"),
  cloneMode: CloneModeModeSchema.optional().describe("Clone mode (default normal)"),
};

export const GiveItemSchema = {
  item: z.string().min(1).describe("Minecraft item id (e.g. 'diamond', 'minecraft:stone')"),
  count: z.number().int().min(1).max(6400).optional().describe("Number of items (default 1, max 6400)"),
  target: z.string().optional().describe("Target player selector or name (default: bot itself, '@s')"),
};

export const TeleportToSchema = {
  x: z.number().describe("Destination X coordinate"),
  y: z.number().describe("Destination Y coordinate"),
  z: z.number().describe("Destination Z coordinate"),
  yaw: z.number().optional().describe("Horizontal rotation in degrees (optional)"),
  pitch: z.number().optional().describe("Vertical rotation in degrees (optional)"),
};

export const SetTimeSchema = {
  value: z
    .union([
      z.enum(["day", "noon", "night", "midnight", "sunrise", "sunset"]),
      z.number().int().min(0),
    ])
    .describe("Time preset name (day, noon, night, midnight, sunrise, sunset) or tick value (0+)"),
};

export const WeatherTypeSchema = z.enum(["clear", "rain", "thunder"]);

export const SetWeatherSchema = {
  weather: WeatherTypeSchema.describe("Weather type to set"),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(1_000_000)
    .optional()
    .describe("Duration in seconds (optional)"),
};

export const SetGameruleSchema = {
  rule: z.string().min(1).describe("Game rule name (e.g. 'doDaylightCycle', 'keepInventory')"),
  value: z
    .union([z.string(), z.number().int(), z.boolean()])
    .describe("Game rule value (string, integer, or boolean)"),
};

export const SummonEntitySchema = {
  entity: z.string().min(1).describe("Entity type id (e.g. 'zombie', 'minecraft:creeper')"),
  x: z.number().describe("Spawn X coordinate"),
  y: z.number().describe("Spawn Y coordinate"),
  z: z.number().describe("Spawn Z coordinate"),
  nbt: z.string().optional().describe("Optional NBT data tag string (e.g. '{NoAI:1b}')"),
};

export const FlyToSchema = {
  x: z.number().describe("Destination X coordinate"),
  y: z.number().describe("Destination Y coordinate"),
  z: z.number().describe("Destination Z coordinate"),
};

// ── survival-mode tool schemas ───────────────────────────────────────────────

export const GoToSchema = {
  x: z.number().describe("Target X coordinate"),
  y: z.number().describe("Target Y coordinate"),
  z: z.number().describe("Target Z coordinate"),
  range: z.number().min(0).max(32).optional().describe("How close to get to target (default: 1)"),
};

export const DigBlockSchema = {
  x: z.number().int().describe("Block X coordinate"),
  y: z.number().int().describe("Block Y coordinate"),
  z: z.number().int().describe("Block Z coordinate"),
};

export const PlaceBlockSchema = {
  x: z.number().int().describe("Target X coordinate for new block"),
  y: z.number().int().describe("Target Y coordinate for new block"),
  z: z.number().int().describe("Target Z coordinate for new block"),
  itemName: z.string().min(1).describe("Item name to place (e.g. 'cobblestone', 'dirt')"),
};

export const CollectBlockSchema = {
  blockName: z.string().min(1).describe("Block type to collect (e.g. 'oak_log', 'stone')"),
  count: z.number().int().min(1).max(64).describe("Number of blocks to collect"),
  maxDistance: z.number().min(1).max(256).optional().describe("Maximum search distance (default: 64)"),
};

export const CraftItemSchema = {
  itemName: z.string().min(1).describe("Item name to craft (e.g. 'stick', 'crafting_table')"),
  count: z.number().int().min(1).max(64).optional().describe("Number to craft (default: 1)"),
};

export const EquipItemSchema = {
  itemName: z.string().min(1).describe("Item name to equip from inventory"),
  destination: z
    .enum(["hand", "head", "torso", "legs", "feet", "off-hand"])
    .optional()
    .describe("Equipment slot (default: 'hand')"),
};
