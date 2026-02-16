# minecraft-mcp-server

An MCP (Model Context Protocol) server that connects an AI assistant to a Minecraft server via a [Mineflayer](https://github.com/PrismarineJS/mineflayer) bot. Supports **creative** and **survival** modes with distinct toolsets for each. The bot auto-connects on startup using config from environment variables — no connection parameters are passed from the agent.

Communicates over **stdio** — plug it into any MCP-compatible client (Claude Desktop, etc.).

## Prerequisites

- **Node.js** ≥ 20
- **Minecraft Java Edition** server (vanilla, Paper, Spigot, etc.)
- Server must be in **offline mode** (`online-mode=false` in `server.properties`) or configured for the bot to join without auth
- **Creative mode**: bot needs **operator permissions** (`/op <username>`) for command tools (`setblock`, `fill`, etc.)
- **Survival mode**: no special server permissions required

## Quick Start

```bash
npm install
npm run build
```

### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc -p tsconfig.json` | Compile TypeScript to `dist/` |
| `dev`   | `tsx src/main.ts` | Run directly without compiling |
| `start` | `node dist/main.js` | Run compiled output |

## Configuration

All configuration is via **environment variables**. The bot connects automatically on startup — the agent never passes connection parameters.

| Variable | Default | Description |
|----------|---------|-------------|
| `MC_MODE` | `creative` | Mode: `creative` or `survival`. Determines which tools are exposed. |
| `MC_HOST` | `127.0.0.1` | Minecraft server host. |
| `MC_PORT` | `25565` | Minecraft server port. |
| `MC_USERNAME` | `mcp-bot` | Bot username. |
| `MC_VERSION` | *(auto-detect)* | Minecraft protocol version (e.g. `1.20.4`). |
| `MC_AUTO_CONNECT` | `true` | Connect to the server on startup. Set to `false` to defer connection. |

## MCP Client Integration

This server uses **stdio transport**. Set the mode and connection via `env` in your MCP client config.

### Creative mode (default)

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "node",
      "args": ["/absolute/path/to/dist/main.js"],
      "env": {
        "MC_MODE": "creative",
        "MC_HOST": "localhost",
        "MC_PORT": "25565",
        "MC_USERNAME": "Builder"
      }
    }
  }
}
```

### Survival mode

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "node",
      "args": ["/absolute/path/to/dist/main.js"],
      "env": {
        "MC_MODE": "survival",
        "MC_HOST": "localhost",
        "MC_PORT": "25565",
        "MC_USERNAME": "Survivor"
      }
    }
  }
}
```

### Development (no build step)

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/src/main.ts"],
      "env": {
        "MC_MODE": "survival"
      }
    }
  }
}
```

## Tools

Tools are split into **common** (always available), **creative-only**, and **survival-only** sets depending on the configured `MC_MODE`.

### Common Tools (both modes)

| Tool | Description |
|------|-------------|
| `reconnect_bot` | Reconnect to the configured Minecraft server |
| `get_bot_status` | Get state, position, health, food, recent chat |
| `send_chat` | Send a chat message in-game |
| `get_position` | Get current coordinates and orientation |
| `look_at` | Look at specific world coordinates |
| `move_control` | Set movement state (forward/back/left/right/jump/sprint/sneak) with optional auto-stop duration |
| `stop_all_controls` | Stop all movement |
| `get_inventory` | List inventory items |

### Creative-Only Tools

Available when `MC_MODE=creative`. These use server commands and require **operator permissions**.

| Tool | Description |
|------|-------------|
| `setblock` | Place a block at coordinates — modes: `replace`, `destroy`, `keep` |
| `fill` | Fill a cuboid region — modes: `replace`, `destroy`, `keep`, `hollow`, `outline` |
| `clone_area` | Clone a cuboid region to a destination |
| `give_item` | Give an item to a player (default: the bot) |
| `teleport_to` | Teleport the bot to coordinates with optional rotation |
| `set_time` | Set world time (day, noon, night, or tick value) |
| `set_weather` | Set weather (clear, rain, thunder) with optional duration |
| `set_gamerule` | Set a game rule |
| `summon_entity` | Summon an entity with optional NBT data |
| `fly_to` | Fly the bot to coordinates using creative flight (fallback chain: direct → arc → teleport) |

### Survival-Only Tools

Available when `MC_MODE=survival`. These use Mineflayer plugins ([pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder), [collectblock](https://github.com/PrismarineJS/mineflayer-collectblock), [tool](https://github.com/PrismarineJS/mineflayer-tool)) for autonomous bot behavior — no operator permissions needed.

| Tool | Description |
|------|-------------|
| `go_to` | Navigate to coordinates using pathfinding (handles obstacles automatically) |
| `dig_block` | Mine a block at coordinates (auto-equips best tool) |
| `place_block` | Place a block from inventory at coordinates |
| `collect_block` | Find, navigate to, mine, and collect blocks of a type |
| `craft_item` | Craft an item using inventory materials (auto-finds crafting table if needed) |
| `equip_item` | Equip an item to a slot (hand, head, torso, legs, feet, off-hand) |

> **Why no `execute_command`?** We intentionally expose explicit, typed tools instead of a raw command passthrough. Each tool validates its inputs and returns structured results, giving the agent better feedback and preventing command-injection mistakes.

### Structured Tool Output

All creative command tools (`setblock`, `fill`, `clone_area`, `give_item`, `teleport_to`, `set_time`, `set_weather`, `set_gamerule`, `summon_entity`) return structured metadata alongside the human-readable text:

| Field | Type | Description |
|-------|------|-------------|
| `executed` | `boolean` | Whether the command was confirmed as successfully executed |
| `category` | `string` | Outcome category: `success`, `permission_denied`, `unknown_command`, `failed`, or `timeout` |
| `timedOut` | `boolean` | Whether the server feedback window expired before a response was received |

Unconfirmed, timed-out, and failed outcomes are reported as errors (`isError: true`) so the agent can detect and recover from issues automatically.

`fly_to` uses a three-stage fallback chain and returns additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `method` | `string` | Which strategy succeeded: `direct_fly`, `arc_fly`, or `teleport_fallback` |
| `executionConfirmed` | `boolean` | Whether the bot arrived at the target coordinates |
| `arrivedAt` | `object \| null` | Final `{x, y, z}` position after the attempt |

## Examples

### Creative mode

```
# Fly to a build site
fly_to(x: 100, y: 80, z: 200)

# Place a single diamond block
setblock(x: 100, y: 64, z: 200, block: "diamond_block")

# Build a 10×1×10 stone platform
fill(x1: 0, y1: 63, z1: 0, x2: 10, y2: 63, z2: 10, block: "stone")

# Hollow out a cube of glass
fill(x1: 0, y1: 64, z1: 0, x2: 10, y2: 74, z2: 10, block: "glass", mode: "hollow")

# Give yourself 64 diamonds
give_item(item: "diamond", count: 64)

# Set daytime
set_time(value: "day")
```

### Survival mode

```
# Navigate to coordinates
go_to(x: 100, y: 64, z: 200)

# Mine a block (auto-selects best tool)
dig_block(x: 100, y: 63, z: 200)

# Collect 10 oak logs nearby
collect_block(blockName: "oak_log", count: 10)

# Craft planks from logs
craft_item(itemName: "oak_planks", count: 4)

# Equip a sword
equip_item(itemName: "stone_sword", destination: "hand")
```

## Troubleshooting

### Permission denied (creative mode)

The bot needs operator permissions on the server:

```
/op <bot_username>
```

Creative command tools (`setblock`, `fill`, etc.) return `isError: true` with category `"permission_denied"` if the bot lacks permissions.

### Unknown command

Returned when a command is invalid or misspelled. Check:
- Correct block IDs (e.g. `stone`, `diamond_block`, not `Stone`)
- Valid coordinate ranges
- Proper command syntax

### No response / timeout

Creative command tools wait **5 seconds** for server feedback. A timeout means:
- The command may have executed but produced no recognizable response
- The server may be lagging

The tool returns `category: "timeout"` and `timedOut: true`, and is treated as an error (`isError: true`) so the agent can decide how to proceed.

### `fly_to` failures

`fly_to` automatically tries three strategies in order:
1. **Direct flight** — `bot.creative.flyTo()` to the target
2. **Arc flight** — rises to a dynamic altitude above current/target Y, flies horizontally, then descends (avoids obstacles)
3. **Teleport fallback** — `/tp` command if both flight methods fail

Check `method` in the response to see which strategy was used. If all three fail, `executionConfirmed` is `false` and `isError` is `true`.

### Connection issues

- Verify the Minecraft server is running and reachable
- Check `online-mode=false` in `server.properties` for offline-mode bots
- Ensure the port is correct (default: `25565`)
- The bot cannot connect if the server is full or the username is already in use
- Check `MC_AUTO_CONNECT` is not set to `false` if you expect auto-connection
