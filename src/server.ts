import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MinecraftSession, type CommandResult } from "./minecraft-session.js";
import type { McMode } from "./config.js";
import { Vec3 } from "vec3";
import {
  SendChatSchema,
  LookAtSchema,
  MoveControlSchema,
  SetblockSchema,
  FillSchema,
  CloneAreaSchema,
  GiveItemSchema,
  TeleportToSchema,
  SetTimeSchema,
  SetWeatherSchema,
  SetGameruleSchema,
  SummonEntitySchema,
  FlyToSchema,
  GoToSchema,
  DigBlockSchema,
  PlaceBlockSchema,
  CollectBlockSchema,
  CraftItemSchema,
  EquipItemSchema,
} from "./schemas.js";
import { goals } from "mineflayer-pathfinder";
import minecraftData from "minecraft-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get minecraft-data for a specific bot version in an ESM-safe way.
 */
function getMcData(version: string): any {
  return minecraftData(version);
}

type ToolResponse = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Wrap a tool handler so operational errors become `isError: true` responses. */
function safeHandler<T>(
  fn: (args: T) => Promise<ToolResponse>
): (args: T) => Promise<ToolResponse> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

/** Convenience: text-only success response. */
function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function commandText(result: CommandResult): string {
  switch (result.category) {
    case "timeout":
      return `Command executed but no matching feedback within timeout: ${result.command}`;
    case "permission_denied":
      return `Permission error while executing command: ${result.command}\nResponse: ${result.matchedResponse}`;
    case "unknown_command":
      return `Unknown/invalid command: ${result.command}\nResponse: ${result.matchedResponse}`;
    case "success":
    default:
      return `Command executed: ${result.command}\nResponse: ${result.matchedResponse ?? "(no response)"}`;
  }
}

/** Build a structured tool response from a CommandResult with tool metadata. */
function commandResponse(
  toolName: string,
  parameters: Record<string, unknown>,
  result: CommandResult
): ToolResponse {
  return {
    content: [{ type: "text" as const, text: commandText(result) }],
    structuredContent: {
      tool: toolName,
      parameters,
      command: result.command,
      matchedResponse: result.matchedResponse,
      timedOut: result.timedOut,
      category: result.category,
    },
    isError: result.category === "permission_denied" || result.category === "unknown_command",
  };
}

// ── Creative-mode tools ──────────────────────────────────────────────────────

function registerCreativeTools(server: McpServer, session: MinecraftSession): void {
  // ── setblock ──────────────────────────────────────────────────────────────
  server.tool(
    "setblock",
    "Place a block at a specific position with optional mode.",
    SetblockSchema,
    safeHandler(async (args) => {
      const modeArg = args.mode ?? "replace";
      const command = `/setblock ${args.x} ${args.y} ${args.z} ${args.block} ${modeArg}`;
      const result = await session.executeCommand(command);
      return commandResponse("setblock", { x: args.x, y: args.y, z: args.z, block: args.block, mode: modeArg }, result);
    })
  );

  // ── fill ──────────────────────────────────────────────────────────────────
  server.tool(
    "fill",
    "Fill a cuboid region with a block type and optional mode.",
    FillSchema,
    safeHandler(async (args) => {
      const modeArg = args.mode ?? "replace";
      const command =
        `/fill ${args.x1} ${args.y1} ${args.z1} ${args.x2} ${args.y2} ${args.z2} ` +
        `${args.block} ${modeArg}`;
      const result = await session.executeCommand(command);
      return commandResponse("fill", {
        x1: args.x1, y1: args.y1, z1: args.z1,
        x2: args.x2, y2: args.y2, z2: args.z2,
        block: args.block, mode: modeArg,
      }, result);
    })
  );

  // ── clone_area ────────────────────────────────────────────────────────────
  server.tool(
    "clone_area",
    "Clone a cuboid region from a source to a destination position.",
    CloneAreaSchema,
    safeHandler(async (args) => {
      const maskMode = args.maskMode ?? "replace";
      const cloneMode = args.cloneMode ?? "normal";
      const command =
        `/clone ${args.x1} ${args.y1} ${args.z1} ${args.x2} ${args.y2} ${args.z2} ` +
        `${args.dx} ${args.dy} ${args.dz} ${maskMode} ${cloneMode}`;
      const result = await session.executeCommand(command);
      return commandResponse("clone_area", {
        x1: args.x1, y1: args.y1, z1: args.z1,
        x2: args.x2, y2: args.y2, z2: args.z2,
        dx: args.dx, dy: args.dy, dz: args.dz,
        maskMode, cloneMode,
      }, result);
    })
  );

  // ── give_item ─────────────────────────────────────────────────────────────
  server.tool(
    "give_item",
    "Give an item to a player (default: the bot itself).",
    GiveItemSchema,
    safeHandler(async (args) => {
      const target = args.target ?? "@s";
      const count = args.count ?? 1;
      const command = `/give ${target} ${args.item} ${count}`;
      const result = await session.executeCommand(command);
      return commandResponse("give_item", { item: args.item, count, target }, result);
    })
  );

  // ── teleport_to ───────────────────────────────────────────────────────────
  server.tool(
    "teleport_to",
    "Teleport the bot to specific coordinates with optional rotation.",
    TeleportToSchema,
    safeHandler(async (args) => {
      let command = `/tp @s ${args.x} ${args.y} ${args.z}`;
      if (args.yaw !== undefined && args.pitch !== undefined) {
        command += ` ${args.yaw} ${args.pitch}`;
      } else if (args.yaw !== undefined) {
        command += ` ${args.yaw} 0`;
      }
      const result = await session.executeCommand(command);
      const params: Record<string, unknown> = { x: args.x, y: args.y, z: args.z };
      if (args.yaw !== undefined) params.yaw = args.yaw;
      if (args.pitch !== undefined) params.pitch = args.pitch;
      return commandResponse("teleport_to", params, result);
    })
  );

  // ── set_time ──────────────────────────────────────────────────────────────
  server.tool(
    "set_time",
    "Set the world time to a preset (day, noon, night, etc.) or a tick value.",
    SetTimeSchema,
    safeHandler(async (args) => {
      const value = args.value;
      const command = `/time set ${value}`;
      const result = await session.executeCommand(command);
      return commandResponse("set_time", { value }, result);
    })
  );

  // ── set_weather ───────────────────────────────────────────────────────────
  server.tool(
    "set_weather",
    "Set the weather to clear, rain, or thunder with optional duration.",
    SetWeatherSchema,
    safeHandler(async (args) => {
      let command = `/weather ${args.weather}`;
      if (args.durationSeconds !== undefined) {
        command += ` ${args.durationSeconds}`;
      }
      const result = await session.executeCommand(command);
      const params: Record<string, unknown> = { weather: args.weather };
      if (args.durationSeconds !== undefined) params.durationSeconds = args.durationSeconds;
      return commandResponse("set_weather", params, result);
    })
  );

  // ── set_gamerule ──────────────────────────────────────────────────────────
  server.tool(
    "set_gamerule",
    "Set a game rule to a specific value.",
    SetGameruleSchema,
    safeHandler(async (args) => {
      const command = `/gamerule ${args.rule} ${args.value}`;
      const result = await session.executeCommand(command);
      return commandResponse("set_gamerule", { rule: args.rule, value: args.value }, result);
    })
  );

  // ── summon_entity ─────────────────────────────────────────────────────────
  server.tool(
    "summon_entity",
    "Summon an entity at specific coordinates with optional NBT data.",
    SummonEntitySchema,
    safeHandler(async (args) => {
      let command = `/summon ${args.entity} ${args.x} ${args.y} ${args.z}`;
      if (args.nbt) {
        command += ` ${args.nbt}`;
      }
      const result = await session.executeCommand(command);
      const params: Record<string, unknown> = { entity: args.entity, x: args.x, y: args.y, z: args.z };
      if (args.nbt) params.nbt = args.nbt;
      return commandResponse("summon_entity", params, result);
    })
  );

  // ── fly_to ────────────────────────────────────────────────────────────────
  server.tool(
    "fly_to",
    "Fly the bot to specific coordinates using creative flight.",
    FlyToSchema,
    safeHandler(async (args) => {
      const bot = session.getRawBot();
      if (!bot.creative || typeof bot.creative.flyTo !== "function") {
        return {
          content: [{ type: "text" as const, text: "Error: Creative flight API is not available. Ensure the bot is in creative mode and the server supports it." }],
          isError: true,
        };
      }

      const destination = new Vec3(args.x, args.y, args.z);
      await bot.creative.flyTo(destination);
      const pos = session.getPosition();
      return {
        content: [{
          type: "text" as const,
          text: `Flew to (${args.x}, ${args.y}, ${args.z}). Current position: (${pos.x}, ${pos.y}, ${pos.z}).`,
        }],
        structuredContent: {
          tool: "fly_to",
          parameters: { x: args.x, y: args.y, z: args.z },
          arrivedAt: { x: pos.x, y: pos.y, z: pos.z },
        },
      };
    })
  );
}

// ── Survival-mode tools ──────────────────────────────────────────────────────

function registerSurvivalTools(server: McpServer, session: MinecraftSession): void {
  // ── go_to ────────────────────────────────────────────────────────────────
  server.tool(
    "go_to",
    "Navigate to a specific coordinate using pathfinding. Automatically handles obstacles and terrain.",
    GoToSchema,
    safeHandler(async (args) => {
      const bot = session.getRawBot();
      
      // Check if pathfinder is loaded
      if (!bot.pathfinder) {
        return {
          content: [{ type: "text" as const, text: "Error: Pathfinder plugin not loaded. This tool requires survival mode." }],
          isError: true,
        };
      }

      const range = args.range ?? 1;
      const goal = new goals.GoalNear(args.x, args.y, args.z, range);
      
      try {
        await bot.pathfinder.goto(goal);
        const pos = session.getPosition();
        const distance = Math.sqrt(
          Math.pow(pos.x - args.x, 2) + 
          Math.pow(pos.y - args.y, 2) + 
          Math.pow(pos.z - args.z, 2)
        );
        
        return {
          content: [{
            type: "text" as const,
            text: `Navigated to (${args.x}, ${args.y}, ${args.z}). Current position: (${pos.x}, ${pos.y}, ${pos.z}), distance: ${distance.toFixed(2)} blocks.`,
          }],
          structuredContent: {
            tool: "go_to",
            parameters: { x: args.x, y: args.y, z: args.z, range },
            finalPosition: { x: pos.x, y: pos.y, z: pos.z },
            distanceToGoal: distance,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Failed to navigate: ${message}` }],
          structuredContent: {
            tool: "go_to",
            parameters: { x: args.x, y: args.y, z: args.z, range },
            error: message,
          },
          isError: true,
        };
      }
    })
  );

  // ── dig_block ────────────────────────────────────────────────────────────
  server.tool(
    "dig_block",
    "Dig/mine a block at specific coordinates. Automatically equips the best tool.",
    DigBlockSchema,
    safeHandler(async (args) => {
      const bot = session.getRawBot();
      const mcData = getMcData(bot.version);
      
      const blockPos = new Vec3(args.x, args.y, args.z);
      const block = bot.blockAt(blockPos);
      
      if (!block) {
        return {
          content: [{ type: "text" as const, text: `Error: No block found at (${args.x}, ${args.y}, ${args.z}). Position may be unloaded.` }],
          isError: true,
        };
      }

      if (block.name === "air") {
        return {
          content: [{ type: "text" as const, text: `Error: Cannot dig air block at (${args.x}, ${args.y}, ${args.z}).` }],
          isError: true,
        };
      }

      // Check if bot can reach the block
      if (!bot.canDigBlock(block)) {
        return {
          content: [{ type: "text" as const, text: `Error: Block at (${args.x}, ${args.y}, ${args.z}) is out of reach. Try navigating closer first.` }],
          isError: true,
        };
      }

      const blockName = block.name;
      const startTime = Date.now();
      
      try {
        // Equip best tool if plugin available
        if (bot.tool) {
          await bot.tool.equipForBlock(block);
        }
        
        await bot.dig(block);
        const digTimeMs = Date.now() - startTime;
        
        return {
          content: [{
            type: "text" as const,
            text: `Successfully dug ${blockName} at (${args.x}, ${args.y}, ${args.z}). Dig time: ${digTimeMs}ms.`,
          }],
          structuredContent: {
            tool: "dig_block",
            parameters: { x: args.x, y: args.y, z: args.z },
            blockType: blockName,
            digTimeMs,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Failed to dig ${blockName}: ${message}` }],
          structuredContent: {
            tool: "dig_block",
            parameters: { x: args.x, y: args.y, z: args.z },
            blockType: blockName,
            error: message,
          },
          isError: true,
        };
      }
    })
  );

  // ── place_block ──────────────────────────────────────────────────────────
  server.tool(
    "place_block",
    "Place a block at specific coordinates. Item must be in inventory.",
    PlaceBlockSchema,
    safeHandler(async (args) => {
      const bot = session.getRawBot();
      const mcData = getMcData(bot.version);
      
      // Find the item in inventory by name
      const item = bot.inventory.items().find((i) => 
        i.name === args.itemName || i.name === `minecraft:${args.itemName}`
      );
      
      if (!item) {
        return {
          content: [{ type: "text" as const, text: `Error: Item '${args.itemName}' not found in inventory.` }],
          isError: true,
        };
      }

      // Equip the item
      try {
        await bot.equip(item, "hand");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Failed to equip ${args.itemName}: ${message}` }],
          isError: true,
        };
      }

      const targetPos = new Vec3(args.x, args.y, args.z);
      
      // Check if target position is empty or replaceable
      const targetBlock = bot.blockAt(targetPos);
      if (targetBlock && targetBlock.name !== "air") {
        // Check if it's a replaceable block like water, lava, tall grass, etc.
        const replaceable = ["water", "lava", "tall_grass", "grass", "snow"];
        if (!replaceable.includes(targetBlock.name)) {
          return {
            content: [{ type: "text" as const, text: `Error: Position (${args.x}, ${args.y}, ${args.z}) is already occupied by ${targetBlock.name}.` }],
            isError: true,
          };
        }
      }

      // Find a reference block (adjacent block to place against)
      const adjacentOffsets = [
        new Vec3(0, -1, 0),  // below
        new Vec3(0, 1, 0),   // above
        new Vec3(1, 0, 0),   // east
        new Vec3(-1, 0, 0),  // west
        new Vec3(0, 0, 1),   // south
        new Vec3(0, 0, -1),  // north
      ];

      let referenceBlock = null;
      let faceVector = null;

      for (const offset of adjacentOffsets) {
        const refPos = targetPos.plus(offset);
        const block = bot.blockAt(refPos);
        if (block && block.name !== "air") {
          referenceBlock = block;
          faceVector = offset.scaled(-1); // Face vector points from reference toward target
          break;
        }
      }

      if (!referenceBlock || !faceVector) {
        return {
          content: [{ type: "text" as const, text: `Error: No adjacent block found to place against at (${args.x}, ${args.y}, ${args.z}). Position must have at least one solid neighboring block.` }],
          isError: true,
        };
      }

      try {
        await bot.placeBlock(referenceBlock, faceVector);
        
        return {
          content: [{
            type: "text" as const,
            text: `Successfully placed ${args.itemName} at (${args.x}, ${args.y}, ${args.z}).`,
          }],
          structuredContent: {
            tool: "place_block",
            parameters: { x: args.x, y: args.y, z: args.z, itemName: args.itemName },
            placedBlock: args.itemName,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Failed to place ${args.itemName}: ${message}` }],
          structuredContent: {
            tool: "place_block",
            parameters: { x: args.x, y: args.y, z: args.z, itemName: args.itemName },
            error: message,
          },
          isError: true,
        };
      }
    })
  );

  // ── collect_block ────────────────────────────────────────────────────────
  server.tool(
    "collect_block",
    "Find, navigate to, mine, and collect blocks of a specific type. Handles everything automatically.",
    CollectBlockSchema,
    safeHandler(async (args) => {
      const bot = session.getRawBot();
      
      if (!bot.collectBlock) {
        return {
          content: [{ type: "text" as const, text: "Error: collectBlock plugin not loaded." }],
          isError: true,
        };
      }

      const mcData = getMcData(bot.version);
      const blockType = mcData.blocksByName[args.blockName];
      
      if (!blockType) {
        return {
          content: [{ type: "text" as const, text: `Error: Unknown block type '${args.blockName}'.` }],
          isError: true,
        };
      }

      const maxDistance = args.maxDistance ?? 64;
      
      // Find blocks of the specified type
      const blocks = bot.findBlocks({
        matching: blockType.id,
        maxDistance,
        count: args.count,
      });

      if (blocks.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No ${args.blockName} blocks found within ${maxDistance} blocks.` }],
          structuredContent: {
            tool: "collect_block",
            parameters: { blockName: args.blockName, count: args.count, maxDistance },
            blocksFound: 0,
            collected: 0,
          },
        };
      }

      const targets = blocks.slice(0, args.count).map((pos) => bot.blockAt(pos)).filter((b): b is NonNullable<typeof b> => b !== null);

      if (targets.length === 0) {
        return {
          content: [{ type: "text" as const, text: `Found ${blocks.length} ${args.blockName} blocks but couldn't access them.` }],
          isError: true,
        };
      }

      try {
        await bot.collectBlock.collect(targets);
        
        return {
          content: [{
            type: "text" as const,
            text: `Successfully collected ${targets.length} ${args.blockName} block(s).`,
          }],
          structuredContent: {
            tool: "collect_block",
            parameters: { blockName: args.blockName, count: args.count, maxDistance },
            blocksFound: blocks.length,
            collected: targets.length,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Failed to collect ${args.blockName}: ${message}` }],
          structuredContent: {
            tool: "collect_block",
            parameters: { blockName: args.blockName, count: args.count, maxDistance },
            blocksFound: blocks.length,
            error: message,
          },
          isError: true,
        };
      }
    })
  );

  // ── craft_item ───────────────────────────────────────────────────────────
  server.tool(
    "craft_item",
    "Craft an item using available materials in inventory. Uses nearby crafting table if needed.",
    CraftItemSchema,
    safeHandler(async (args) => {
      const bot = session.getRawBot();
      const mcData = getMcData(bot.version);
      
      const count = args.count ?? 1;
      const itemType = mcData.itemsByName[args.itemName];
      
      if (!itemType) {
        return {
          content: [{ type: "text" as const, text: `Error: Unknown item type '${args.itemName}'.` }],
          isError: true,
        };
      }

      // First try without crafting table (2x2 recipes)
      let recipes = bot.recipesFor(itemType.id, null, 1, null);
      let craftingTable = null;

      // If no recipes found, try to find a crafting table for 3x3 recipes
      if (recipes.length === 0) {
        const craftingTableBlock = bot.findBlock({
          matching: mcData.blocksByName.crafting_table?.id,
          maxDistance: 32,
        });

        if (craftingTableBlock) {
          craftingTable = craftingTableBlock;
          recipes = bot.recipesFor(itemType.id, null, 1, craftingTable);
        }
      }

      if (recipes.length === 0) {
        return {
          content: [{ 
            type: "text" as const, 
            text: `Error: No available recipe for '${args.itemName}'. Either missing ingredients or recipe doesn't exist.` 
          }],
          structuredContent: {
            tool: "craft_item",
            parameters: { itemName: args.itemName, count },
            error: "No recipe available",
          },
          isError: true,
        };
      }

      const recipe = recipes[0];

      try {
        // Navigate to crafting table if needed
        if (craftingTable && bot.pathfinder) {
          const goal = new goals.GoalBlock(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z);
          await bot.pathfinder.goto(goal);
        }

        await bot.craft(recipe, count, craftingTable ?? undefined);
        
        return {
          content: [{
            type: "text" as const,
            text: `Successfully crafted ${count}x ${args.itemName}.`,
          }],
          structuredContent: {
            tool: "craft_item",
            parameters: { itemName: args.itemName, count },
            craftedItem: args.itemName,
            craftedCount: count,
            usedCraftingTable: craftingTable !== null,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Failed to craft ${args.itemName}: ${message}` }],
          structuredContent: {
            tool: "craft_item",
            parameters: { itemName: args.itemName, count },
            error: message,
          },
          isError: true,
        };
      }
    })
  );

  // ── equip_item ───────────────────────────────────────────────────────────
  server.tool(
    "equip_item",
    "Equip an item from inventory to a specific slot (hand, head, torso, legs, feet, off-hand).",
    EquipItemSchema,
    safeHandler(async (args) => {
      const bot = session.getRawBot();
      const destination = args.destination ?? "hand";
      
      // Find the item in inventory
      const item = bot.inventory.items().find((i) => 
        i.name === args.itemName || i.name === `minecraft:${args.itemName}`
      );
      
      if (!item) {
        return {
          content: [{ type: "text" as const, text: `Error: Item '${args.itemName}' not found in inventory.` }],
          structuredContent: {
            tool: "equip_item",
            parameters: { itemName: args.itemName, destination },
            error: "Item not in inventory",
          },
          isError: true,
        };
      }

      try {
        await bot.equip(item, destination);
        
        return {
          content: [{
            type: "text" as const,
            text: `Successfully equipped ${args.itemName} to ${destination}.`,
          }],
          structuredContent: {
            tool: "equip_item",
            parameters: { itemName: args.itemName, destination },
            equippedItem: args.itemName,
            slot: destination,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Failed to equip ${args.itemName}: ${message}` }],
          structuredContent: {
            tool: "equip_item",
            parameters: { itemName: args.itemName, destination },
            error: message,
          },
          isError: true,
        };
      }
    })
  );
}

// ── Server factory ───────────────────────────────────────────────────────────

export function createServer(options: { session: MinecraftSession; mode: McMode }): McpServer {
  const server = new McpServer({
    name: "minecraft-mcp-server",
    version: "0.1.0",
  });

  const { session, mode } = options;

  // ── reconnect_bot ────────────────────────────────────────────────────────

  server.tool(
    "reconnect_bot",
    "Reconnect the bot to the configured Minecraft server.",
    safeHandler(async () => {
      await session.reconnect();
      const status = session.getStatus();
      return ok(
        `Connected to ${status.host}:${status.port} as ${status.username}. ` +
          `Position: (${status.position?.x}, ${status.position?.y}, ${status.position?.z}). ` +
          `Health: ${status.health}, Food: ${status.food}.`
      );
    })
  );

  // ── get_bot_status ───────────────────────────────────────────────────────

  server.tool(
    "get_bot_status",
    "Get the current bot status including state, position, health, food, and recent chat messages.",
    safeHandler(async () => {
      const status = session.getStatus();
      const summary =
        status.state === "ready"
          ? "Bot is connected and ready."
          : "Bot is disconnected or connecting. Reconnect may be required.";
      return ok(`${summary}\n${JSON.stringify(status, null, 2)}`);
    })
  );

  // ── send_chat ────────────────────────────────────────────────────────────

  server.tool(
    "send_chat",
    "Send a chat message in-game.",
    SendChatSchema,
    safeHandler(async (args) => {
      session.sendChat(args.message);
      return ok(`Chat sent: "${args.message}"`);
    })
  );

  // ── get_position ─────────────────────────────────────────────────────────

  server.tool(
    "get_position",
    "Get the bot's current position and orientation.",
    safeHandler(async () => {
      const pos = session.getPosition();
      return ok(
        `Position: (${pos.x}, ${pos.y}, ${pos.z}), Yaw: ${pos.yaw}, Pitch: ${pos.pitch}`
      );
    })
  );

  // ── look_at ──────────────────────────────────────────────────────────────

  server.tool(
    "look_at",
    "Make the bot look at specific world coordinates.",
    LookAtSchema,
    safeHandler(async (args) => {
      await session.lookAt(args.x, args.y, args.z);
      const pos = session.getPosition();
      return ok(
        `Now looking at (${args.x}, ${args.y}, ${args.z}). ` +
          `New orientation — yaw: ${pos.yaw}, pitch: ${pos.pitch}.`
      );
    })
  );

  // ── move_control ─────────────────────────────────────────────────────────

  server.tool(
    "move_control",
    "Set a movement control state (forward, back, left, right, jump, sprint, sneak). " +
      "Optionally auto-deactivate after durationMs.",
    MoveControlSchema,
    safeHandler(async (args) => {
      session.setControl(args.direction, args.active, args.durationMs);
      const verb = args.active ? "activated" : "deactivated";
      let text = `Control '${args.direction}' ${verb}.`;
      if (args.active && args.durationMs !== undefined) {
        text += ` Will auto-deactivate after ${args.durationMs}ms.`;
      }
      return ok(text);
    })
  );

  // ── stop_all_controls ────────────────────────────────────────────────────

  server.tool(
    "stop_all_controls",
    "Immediately stop all movement controls (forward, back, left, right, jump, sprint, sneak).",
    safeHandler(async () => {
      session.stopAllControls();
      return ok("All movement controls stopped.");
    })
  );

  // ── get_inventory ────────────────────────────────────────────────────────

  server.tool(
    "get_inventory",
    "List all items in the bot's inventory.",
    safeHandler(async () => {
      const items = session.getInventory();
      if (items.length === 0) {
        return ok("Inventory is empty.");
      }
      const lines = items.map(
        (i) => `Slot ${i.slot}: ${i.displayName} (${i.name}) ×${i.count}`
      );
      return ok(`Inventory (${items.length} items):\n${lines.join("\n")}`);
    })
  );

  // ── Mode-specific tools ──────────────────────────────────────────────────

  if (mode === "creative") {
    registerCreativeTools(server, session);
  } else if (mode === "survival") {
    registerSurvivalTools(server, session);
  }

  return server;
}
