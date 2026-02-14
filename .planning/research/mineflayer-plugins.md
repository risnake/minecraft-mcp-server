# Mineflayer Core APIs & Plugin Ecosystem Research

> Research for building explicit MCP tools in two modes: **creative** and **survival**.
> Project: `minecraft-mcp-server` — current deps: `mineflayer@4.20.1`, `mineflayer-pathfinder@2.4.5`, `minecraft-data@3.100.0`, `vec3@0.1.10`

---

## 1. Mineflayer Core APIs

### 1.1 Movement

| API | Signature | Notes |
|-----|-----------|-------|
| `bot.setControlState(control, state)` | `control: 'forward'|'back'|'left'|'right'|'jump'|'sprint'|'sneak', state: boolean` | Low-level, already used in project |
| `bot.clearControlStates()` | `void` | Stops all movement, already used |
| `bot.lookAt(point, force?)` | `Vec3, boolean` | Async, already used |
| `bot.look(yaw, pitch, force?)` | `number, number, boolean` | Raw yaw/pitch |
| `bot.creative.flyTo(destination)` | `Vec3` → Promise | **Creative mode only** — smooth fly to position |
| `bot.creative.startFlying()` / `stopFlying()` | `void` | Toggle creative flight |
| `bot.mount(entity)` / `bot.dismount()` | Entity | Vehicle/horse/boat control |
| `bot.moveVehicle(left, forward)` | `number, number` | Control mounted vehicle |

### 1.2 Block Interaction

| API | Signature | Notes |
|-----|-----------|-------|
| `bot.blockAt(point, extraInfos?)` | `Vec3, boolean` → `Block|null` | Get block at position |
| `bot.findBlocks(options)` | `{matching, maxDistance, count, useExtraInfo?, point?}` → `Vec3[]` | Find blocks by ID/predicate. Returns positions. |
| `bot.findBlock(options)` | Same but returns single `Block|null` | Convenience for first match |
| `bot.canDigBlock(block)` | `Block` → `boolean` | Reachability + permission check |
| `bot.dig(block, forceLook?, digFace?)` | `Block, boolean, string` → Promise | Mine a block. **Survival**: time depends on tool. |
| `bot.stopDigging()` | `void` | Cancel in-progress dig |
| `bot.digTime(block)` | `Block` → `number` (ms) | Predict dig time for current held item |
| `bot.placeBlock(referenceBlock, faceVector)` | `Block, Vec3` → Promise | Place held item against reference face |
| `bot.activateBlock(block, direction?, cursorPos?)` | `Block, Vec3?, Vec3?` → Promise | Right-click a block (chests, doors, buttons, etc.) |
| `bot.canSeeBlock(block)` | `Block` → `boolean` | Line-of-sight check |
| `bot.waitForChunksToLoad()` | `void` → Promise | Wait for chunk data |

### 1.3 Inventory

| API | Signature | Notes |
|-----|-----------|-------|
| `bot.inventory.items()` | → `Item[]` | All items in inventory |
| `bot.inventory.slots` | `Item[]` (length 46) | Raw slot array |
| `bot.heldItem` | `Item|null` | Currently held item |
| `bot.equip(item, destination)` | `Item, 'hand'|'off-hand'|'head'|'torso'|'legs'|'feet'` → Promise | Equip item to slot |
| `bot.unequip(destination)` | `string` → Promise | Remove equipment |
| `bot.toss(itemType, metadata, count)` | `number, number|null, number` → Promise | Drop items by type |
| `bot.tossStack(item)` | `Item` → Promise | Drop entire stack |
| `bot.setQuickBarSlot(slot)` | `0-8` | Switch hotbar slot |
| `bot.transfer(options)` | `{window, itemType, metadata, count, sourceStart, sourceEnd, destStart, destEnd}` → Promise | Move items between slot ranges |
| `bot.openContainer(block_or_entity)` | → `Container` window | Open chest/dispenser/etc |
| `bot.openFurnace(block)` | → `Furnace` window | Interact with furnace |

**Creative-only:**
| API | Signature | Notes |
|-----|-----------|-------|
| `bot.creative.setInventorySlot(slot, item)` | `number, Item` → Promise | Spawn any item into inventory |
| `bot.creative.clearSlot(slot)` | `number` → Promise | Delete item from slot |
| `bot.creative.clearInventory()` | → Promise | Empty entire inventory |

### 1.4 Crafting

| API | Signature | Notes |
|-----|-----------|-------|
| `bot.recipesFor(itemType, metadata, minResultCount, craftingTable)` | `number, number|null, number, Block|null` → `Recipe[]` | Find available recipes. Pass `null` for 2×2 inventory crafting. |
| `bot.recipesAll(itemType, metadata, craftingTable)` | Same → `Recipe[]` | All recipes regardless of ingredients in inventory |
| `bot.craft(recipe, count, craftingTable)` | `Recipe, number, Block|null` → Promise | Execute crafting. **Must be near crafting table if recipe requires 3×3.** |

### 1.5 Combat

| API | Signature | Notes |
|-----|-----------|-------|
| `bot.attack(entity, swing?)` | `Entity, boolean` → void | Single melee attack |
| `bot.swingArm(hand?, showHand?)` | `'right'|'left', boolean` | Arm animation |
| `bot.activateItem(offHand?)` | `boolean` | Use held item (bow draw, eat, shield) |
| `bot.deactivateItem()` | void | Stop using item |
| `bot.useOn(targetEntity)` | `Entity` → void | Use held item on entity |
| `bot.nearestEntity(match?)` | `(Entity) => boolean` → `Entity|null` | Find closest entity by predicate |
| `bot.entities` | `{[id]: Entity}` | All loaded entities map |
| `bot.getExplosionDamages(entity, position, radius)` | → `number` | Predict explosion damage |

### 1.6 Entity Observation

| Property | Type | Notes |
|----------|------|-------|
| `bot.players` | `{[username]: Player}` | All players with `.entity`, `.ping`, `.gamemode` |
| `bot.entity` | `Entity` | Bot's own entity |
| `entity.position` | `Vec3` | Position |
| `entity.velocity` | `Vec3` | Movement vector |
| `entity.type` | `string` | `'player'`, `'mob'`, `'object'` etc |
| `entity.mobType` / `entity.name` | `string` | Entity name (e.g. `'zombie'`) |
| `entity.health` | `number` | Health (only for bot's own entity reliably) |
| `entity.metadata` | `object[]` | Raw entity metadata |
| `entity.equipment` | `Item[]` | Visible equipment |

### 1.7 World Query

| API | Notes |
|-----|-------|
| `bot.game.gameMode` | `'survival'`, `'creative'`, `'adventure'`, `'spectator'` |
| `bot.game.dimension` | `'overworld'`, `'the_nether'`, `'the_end'` |
| `bot.game.difficulty` | Current difficulty |
| `bot.time.timeOfDay` | 0–24000 ticks |
| `bot.time.isDay` | boolean |
| `bot.isRaining` | boolean |
| `bot.health` | 0–20 |
| `bot.food` | 0–20 |
| `bot.foodSaturation` | float |
| `bot.experience.level` | XP level |
| `bot.oxygenLevel` | 0–20 |
| `bot.isSleeping` | boolean |

---

## 2. Plugin Ecosystem Analysis

### 2.1 mineflayer-pathfinder (ALREADY INSTALLED)
- **Package**: `mineflayer-pathfinder` — https://github.com/PrismarineJS/mineflayer-pathfinder
- **Status**: Already in `package.json` at `^2.4.5`
- **Purpose**: A* pathfinding with break/place support, goal system
- **Key APIs**:
  - `bot.pathfinder.goto(goal)` → Promise (resolves on arrival, rejects on error)
  - `bot.pathfinder.setGoal(goal, dynamic?)` — fire-and-forget goal tracking
  - `bot.pathfinder.stop()` — stop pathing
  - `bot.pathfinder.setMovements(movements)` — configure allowed moves
  - `bot.pathfinder.isMoving()` / `isMining()` / `isBuilding()`
  - `Movements` class: `canDig`, `digCost`, `placeCost`, `maxDropDown`, `allow1by1towers`, `allowParkour`, `allowSprinting`, `scafoldingBlocks`, `blocksToAvoid`, `blocksCantBreak`, etc.
- **Goals**: `GoalBlock`, `GoalNear`, `GoalXZ`, `GoalNearXZ`, `GoalY`, `GoalGetToBlock`, `GoalFollow`, `GoalCompositeAny`, `GoalCompositeAll`, `GoalInvert`, `GoalPlaceBlock`, `GoalLookAtBlock`
- **Events**: `goal_reached`, `path_update` (success/partial/timeout/noPath), `path_reset` (with reason)
- **Critical for**: `navigate_to`, `goto_block`, `follow_player`, any tool that needs the bot to move to a position
- **Mode differences**:
  - **Creative**: Set `movements.canDig = false`, `movements.allow1by1towers = false` (use creative flight instead)
  - **Survival**: Full movement config with digging, scaffolding, parkour

### 2.2 mineflayer-collectblock (NOT INSTALLED — RECOMMENDED)
- **Package**: `mineflayer-collectblock` — https://github.com/PrismarineJS/mineflayer-collectblock
- **Purpose**: High-level "go mine this block and pick up drops" wrapper
- **Dependencies**: Requires `mineflayer-pathfinder` (✅ have), uses `mineflayer-tool` internally
- **Key API**: `bot.collectBlock.collect(target | target[], options?)` → callback/Promise
  - `target`: Block or Entity (item drop) or array of them
  - Options: `append`, `ignoreNoPath`, `chestLocations`, `itemFilter`
- **Why useful**: Eliminates boilerplate of pathfind → equip tool → dig → walk to drop → pick up
- **Limitation**: Designed for simple collection tasks; less control over individual steps
- **Recommendation**: **Install now** — significantly simplifies `mine_block` and `collect_items` tools
- **Survival only**: Not useful in creative mode (no need to mine)

### 2.3 mineflayer-pvp (NOT INSTALLED — OPTIONAL/LATER)
- **Package**: `mineflayer-pvp` — https://github.com/PrismarineJS/mineflayer-pvp
- **Purpose**: Automated PvP/PvE combat with approach + attack loop
- **Dependencies**: Requires `mineflayer-pathfinder` (✅ have)
- **Key API**:
  - `bot.pvp.attack(entity)` — start attacking (pathfinds + auto-attacks)
  - `bot.pvp.stop()` / `bot.pvp.forceStop()`
  - `bot.pvp.attackRange`, `bot.pvp.followRange`, `bot.pvp.viewDistance`
- **Events**: `startedAttacking`, `stoppedAttacking`, `attackedTarget`
- **Recommendation**: **Defer** — we can implement basic combat with `bot.attack(entity)` + pathfinder for v1. PvP plugin adds melee rate optimization and auto-follow, which is nice but not essential.

### 2.4 mineflayer-auto-eat (NOT INSTALLED — RECOMMENDED)
- **Package**: `mineflayer-auto-eat` — https://github.com/link-discord/mineflayer-auto-eat
- **⚠️ ESM-only** (no CommonJS support)
- **Purpose**: Automatic food consumption when hunger/health drops
- **Key API**:
  - `bot.autoEat.enableAuto()` / `bot.autoEat.disableAuto()`
  - `bot.autoEat.eat(opts?)` — manual trigger
  - `bot.autoEat.setOpts({priority, minHunger, minHealth, bannedFood, eatingTimeout})`
- **Events**: `eatStart`, `eatFinish`, `eatFail`
- **Recommendation**: **Install now** — survival mode essential. Hunger management is critical and tedious to implement manually.
- **Caveat**: ESM-only means our project must use `"type": "module"` (which it already does ✅)

### 2.5 mineflayer-tool (NOT INSTALLED — RECOMMENDED)
- **Package**: `mineflayer-tool` — https://github.com/PrismarineJS/mineflayer-tool
- **Purpose**: Auto-select best tool for mining a block
- **Key API**: `bot.tool.equipForBlock(block, options?)` → Promise
  - Options: `requireHarvest: boolean` (only tools that can actually harvest)
- **Recommendation**: **Install now** — required by `collectblock` and essential for survival mining efficiency
- **Note**: `pathfinder` has `bot.pathfinder.bestHarvestTool(block)` but `mineflayer-tool` is more comprehensive

### 2.6 Other Plugins (NOT NEEDED NOW)

| Plugin | Purpose | Recommendation |
|--------|---------|----------------|
| `mineflayer-armor-manager` | Auto-equip best armor | **Later** — can manually equip for v1 |
| `mineflayer-hawkeye` | Bow aiming/trajectory calc | **Later** — ranged combat is secondary |
| `mineflayer-web-inventory` | Web UI for inventory | **Never** — MCP is our UI |
| `mineflayer-steer` | Vehicle steering | **Later** — niche use case |
| `mineflayer-block-finder` | Enhanced block search | **No** — `bot.findBlocks()` is sufficient |
| `prismarine-viewer` | 3D browser viewer | **Debug only** — not for production |

---

## 3. Recommended Dependency Set

### Install NOW (minimal viable set)

```json
{
  "mineflayer": "^4.20.1",
  "mineflayer-pathfinder": "^2.4.5",
  "mineflayer-collectblock": "^1.4.1",
  "mineflayer-tool": "^1.2.0",
  "mineflayer-auto-eat": "^4.1.0",
  "minecraft-data": "^3.100.0",
  "vec3": "^0.1.10"
}
```

**Rationale**:
- `pathfinder` — already installed, core navigation
- `collectblock` — wraps pathfind+tool+dig+pickup into one call
- `tool` — auto tool selection for mining (also used by collectblock internally)
- `auto-eat` — automatic hunger management in survival (ESM-only, project is ESM ✅)

### Install LATER (when needed)

```json
{
  "mineflayer-pvp": "^1.3.2",
  "mineflayer-armor-manager": "^2.0.1"
}
```

---

## 4. MCP Tool Mapping Proposals

### 4.1 Navigation Tools

#### `navigate_to`
```
Parameters:
  x: number (required) — Target X coordinate
  y: number (required) — Target Y coordinate
  z: number (required) — Target Z coordinate
  range: number (optional, default 1) — How close to get (GoalNear range)
  canDig: boolean (optional, default true) — Allow breaking blocks en route (survival)
  canPlace: boolean (optional, default true) — Allow placing scaffolding
  timeout: number (optional, default 60000) — Max pathfinding time in ms

Output:
  success: boolean
  finalPosition: {x, y, z}
  distanceToGoal: number
  pathStatus: 'success' | 'partial' | 'timeout' | 'noPath'

Implementation:
  - Create Movements instance, configure canDig/canPlace based on game mode
  - Creative mode: disable dig/place, consider using bot.creative.flyTo() for short distances
  - Use bot.pathfinder.goto(new GoalNear(x, y, z, range))
  - Wrap in timeout Promise.race
```

#### `follow_player`
```
Parameters:
  username: string (required) — Player to follow
  range: number (optional, default 3) — Follow distance
  duration: number (optional, default 30000) — Max follow time in ms

Output:
  success: boolean
  reason: 'timeout' | 'player_lost' | 'stopped' | 'arrived'

Implementation:
  - Look up bot.players[username]?.entity
  - Use GoalFollow(entity, range) with dynamic=true
  - Set timeout to stop after duration
```

### 4.2 Block Interaction Tools

#### `dig_block`
```
Parameters:
  x: number (required)
  y: number (required)
  z: number (required)
  autoEquipTool: boolean (optional, default true) — Use mineflayer-tool to equip best tool

Output:
  success: boolean
  blockType: string — What was mined
  digTimeMs: number — How long it took
  error?: string

Implementation:
  - bot.blockAt(new Vec3(x, y, z))
  - If autoEquipTool: bot.tool.equipForBlock(block)
  - If !bot.canDigBlock(block): navigate close first
  - await bot.dig(block)
  - Report block.name and elapsed time
```

#### `place_block`
```
Parameters:
  x: number (required) — Target position for new block
  y: number (required)
  z: number (required)
  blockName: string (required) — Item name to place (e.g. 'cobblestone')

Output:
  success: boolean
  placedBlock: string
  error?: string

Implementation:
  - Find the item in inventory by name
  - Equip it to hand
  - Determine reference block and face vector (adjacent block + face pointing toward target)
  - Navigate within reach if needed
  - await bot.placeBlock(referenceBlock, faceVector)
```

#### `find_blocks`
```
Parameters:
  blockName: string (required) — Block name to search for (e.g. 'diamond_ore')
  maxDistance: number (optional, default 64) — Search radius
  count: number (optional, default 10) — Max results

Output:
  blocks: Array<{x, y, z, name, distanceFromBot}>
  totalFound: number

Implementation:
  - Resolve blockName → block ID via bot.registry.blocksByName
  - bot.findBlocks({matching: blockId, maxDistance, count})
  - Map positions to include distance info
```

#### `mine_block_type`
```
Parameters:
  blockName: string (required) — Block type to mine (e.g. 'oak_log')
  count: number (optional, default 1) — How many to mine
  maxDistance: number (optional, default 64) — Search radius

Output:
  success: boolean
  minedCount: number
  errors: string[]

Implementation:
  - Find blocks with bot.findBlocks()
  - Use bot.collectBlock.collect(blocks.slice(0, count))
  - collectblock handles pathfind → tool equip → dig → pickup
```

### 4.3 Inventory Tools

#### `get_inventory` (ALREADY EXISTS — enhance)
Already implemented. No changes needed.

#### `equip_item`
```
Parameters:
  itemName: string (required) — Item name to equip
  destination: 'hand' | 'off-hand' | 'head' | 'torso' | 'legs' | 'feet' (default 'hand')

Output:
  success: boolean
  equippedItem: string
  error?: string

Implementation:
  - Find item in inventory by name
  - await bot.equip(item, destination)
```

#### `drop_item`
```
Parameters:
  itemName: string (required)
  count: number (optional) — null = entire stack

Output:
  success: boolean
  droppedCount: number

Implementation:
  - Resolve item ID
  - await bot.toss(itemType, null, count)
```

#### `craft_item`
```
Parameters:
  itemName: string (required) — Target item to craft
  count: number (optional, default 1) — How many to craft
  useCraftingTable: boolean (optional, default false) — Use nearby crafting table

Output:
  success: boolean
  craftedItem: string
  craftedCount: number
  error?: string

Implementation:
  - Resolve item ID via bot.registry.itemsByName
  - Find crafting table block if useCraftingTable (bot.findBlock)
  - Navigate to crafting table if needed (GoalGetToBlock)
  - bot.recipesFor(itemId, null, count, craftingTable)
  - If no recipes: return error with available recipes info
  - await bot.craft(recipe, count, craftingTable)
```

#### `open_container`
```
Parameters:
  x: number (required)
  y: number (required)
  z: number (required)
  action: 'list' | 'deposit' | 'withdraw' (default 'list')
  itemName?: string — For deposit/withdraw
  count?: number — For deposit/withdraw

Output:
  success: boolean
  items?: Array<{slot, name, count}> — For 'list'
  transferredCount?: number — For deposit/withdraw

Implementation:
  - Navigate to block (GoalGetToBlock)
  - const container = await bot.openContainer(block)
  - For 'list': return container.containerItems()
  - For 'deposit': await container.deposit(itemType, null, count)
  - For 'withdraw': await container.withdraw(itemType, null, count)
  - container.close()
```

### 4.4 Combat Tools

#### `attack_entity`
```
Parameters:
  entityName: string (optional) — Entity type name (e.g. 'zombie', 'skeleton')
  username: string (optional) — Player username (mutually exclusive with entityName)
  maxDistance: number (optional, default 32) — Search radius
  once: boolean (optional, default true) — Single attack vs continuous

Output:
  success: boolean
  targetType: string
  targetPosition: {x, y, z}
  error?: string

Implementation:
  - Find entity via bot.nearestEntity(e => e.name === entityName)
  - Navigate within attack range (GoalNear range 3)
  - bot.attack(entity)
  - If !once: loop with 500ms delay until entity gone or stop called
```

#### `eat_food`
```
Parameters:
  foodName: string (optional) — Specific food to eat (auto-selects best if omitted)

Output:
  success: boolean
  foodEaten: string
  healthAfter: number
  foodAfter: number

Implementation:
  - If using auto-eat plugin: bot.autoEat.eat({food: foodName})
  - Manual: find food in inventory, equip, bot.consume()
```

### 4.5 Observation / Query Tools

#### `get_nearby_entities`
```
Parameters:
  range: number (optional, default 32)
  type: string (optional) — Filter: 'player', 'mob', 'object', 'all'

Output:
  entities: Array<{name, type, position, distance, health?}>
  count: number

Implementation:
  - Filter bot.entities by distance and type
  - Sort by distance
```

#### `get_block_info`
```
Parameters:
  x: number (required)
  y: number (required)
  z: number (required)

Output:
  name: string
  type: number
  hardness: number
  diggable: boolean
  material: string
  harvestTools: string[]
  drops: string[]
  canSee: boolean

Implementation:
  - const block = bot.blockAt(new Vec3(x, y, z))
  - Return block properties from minecraft-data
```

#### `get_surroundings`
```
Parameters:
  radius: number (optional, default 4) — Scan radius

Output:
  blocks: {[position]: blockName} — Nearby blocks summary
  entities: Array<{name, type, distance}>
  biome: string
  timeOfDay: number
  weather: string

Implementation:
  - Scan blocks in radius using bot.blockAt
  - List entities in range
  - Include game state info
```

### 4.6 Creative-Mode Tools

#### `creative_give_item`
```
Parameters:
  itemName: string (required)
  count: number (optional, default 1)
  slot: number (optional) — Specific inventory slot

Output:
  success: boolean
  item: string
  count: number

Implementation:
  - Resolve item via bot.registry.itemsByName
  - Create prismarine-item instance
  - bot.creative.setInventorySlot(slot, item)
```

#### `creative_fly_to`
```
Parameters:
  x: number (required)
  y: number (required)
  z: number (required)

Output:
  success: boolean
  finalPosition: {x, y, z}

Implementation:
  - Check bot.game.gameMode === 'creative'
  - bot.creative.startFlying()
  - await bot.creative.flyTo(new Vec3(x, y, z))
```

### 4.7 Utility / Mode-Aware Tools

#### `sleep_in_bed`
```
Parameters:
  searchRadius: number (optional, default 32)

Output:
  success: boolean
  bedPosition: {x, y, z}
  error?: string

Implementation:
  - Find bed block (bot.findBlock matching bed block IDs)
  - Navigate to bed (GoalGetToBlock)
  - bot.sleep(bedBlock)
  - Listen for 'sleep' event
```

---

## 5. Caveats & Failure Modes

### 5.1 Permissions
- **Operator commands fail silently or with vague errors** on servers without op. The current `executeCommand` handles this via pattern matching.
- **Creative mode tools must check `bot.game.gameMode === 'creative'`** before calling `bot.creative.*`. Calling creative APIs in survival silently fails or throws.
- **Anti-cheat plugins** (NoCheatPlus, Spartan, Matrix) will flag:
  - Movement speed exceeding walk/sprint norms
  - Instant block breaks
  - Reaching blocks beyond 4.5 blocks distance
  - Attacking entities beyond 3.5 blocks
  - Place/break speed exceeding normal rates
  - **Mitigation**: Respect natural dig times via `bot.digTime()`, don't teleport, use pathfinder for movement

### 5.2 Reachability
- **Block reach distance**: 4.5 blocks in survival, 5 in creative. Always navigate within reach before dig/place/interact.
- **Entity interact range**: ~3.5 blocks for attack, ~6 blocks for `activateEntity`.
- **Pathfinder failure**: If no valid path exists (enclosed space, lava moat, etc.), `goto()` rejects with 'noPath'. Always handle this gracefully.
- **Unloaded chunks**: `bot.blockAt()` returns `null` for unloaded positions. `bot.findBlocks()` only searches loaded chunks. **Always check for null returns.**

### 5.3 Missing Recipes
- `bot.recipesFor()` returns `[]` when:
  - Items not in inventory (insufficient materials)
  - Requires crafting table but none provided
  - Recipe doesn't exist for that item
- **minecraft-data recipes are version-specific**. Some recipes differ between 1.20.x versions.
- **3×3 recipes** need a crafting table block passed to `bot.craft()`. Always check recipe size.

### 5.4 Timing & Async Issues
- **Dig time varies wildly**: Stone with bare hand = 7.5s, with diamond pickaxe = 0.3s. Always use `bot.digTime()` to predict.
- **Entity spawn/despawn**: Entities can vanish between finding and reaching them. Always re-validate target existence.
- **Pathfinding is expensive**: Long paths (>200 blocks) can take 1-5 seconds to compute. Set appropriate `thinkTimeout`.
- **Chunk loading race**: After teleport, chunks may not be loaded. Use `bot.waitForChunksToLoad()` before scanning.

### 5.5 Inventory Edge Cases
- **Full inventory**: Mining with full inventory drops items on ground. Check `bot.inventory.emptySlotCount()` before mining.
- **Crafting table distance**: Must be within 4 blocks. Pathfinder's `GoalGetToBlock` handles this.
- **Armor equip during combat**: Equipping triggers animation delay. Don't equip mid-combat.
- **Stack limits**: Different items stack to 1, 16, or 64. Check `item.stackSize`.

### 5.6 Timeout Patterns
Every async operation should be wrapped with a timeout:
```typescript
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Usage:
await withTimeout(bot.pathfinder.goto(goal), 60_000, 'navigate_to');
await withTimeout(bot.dig(block), 30_000, 'dig_block');
await withTimeout(bot.craft(recipe, count, table), 10_000, 'craft_item');
```

### 5.7 Mode-Specific Considerations
| Concern | Creative Mode | Survival Mode |
|---------|--------------|---------------|
| Movement | Use `bot.creative.flyTo()` for direct flight | Use pathfinder with dig/place |
| Mining | No need (use `/setblock air`) | Use `dig()` with proper tool |
| Inventory | `creative.setInventorySlot()` for any item | Must mine/craft/trade |
| Combat | Usually unnecessary | Must manage health/food/equipment |
| Food | Not needed (no hunger) | Essential — use auto-eat plugin |
| Death | Irrelevant | Must handle death event, respawn logic |
| Building | Place from unlimited items | Must have items in inventory |

### 5.8 Plugin Interaction Pitfalls
- **collectblock + pathfinder**: collectblock manages pathfinder goals internally. Don't set competing goals while collecting.
- **auto-eat + combat**: auto-eat may trigger during combat, causing the bot to stop attacking momentarily. Consider `bot.autoEat.disableAuto()` during fights.
- **pathfinder + creative flight**: Pathfinder doesn't understand creative flight. Use pathfinder OR creative.flyTo, not both.
- **Plugin load order matters**: Load pathfinder before pvp/collectblock since they depend on it.

---

## 6. Implementation Priority

### Phase 1 (Core survival + creative)
1. `navigate_to` — pathfinder-based, mode-aware
2. `dig_block` — with tool auto-equip
3. `place_block` — block placement
4. `find_blocks` — block search
5. `equip_item` — inventory management
6. `craft_item` — crafting with table support
7. `get_nearby_entities` — entity awareness
8. `get_block_info` — block inspection

### Phase 2 (Quality of life)
9. `mine_block_type` — collectblock wrapper for batch mining
10. `open_container` — chest/furnace interaction
11. `drop_item` — inventory management
12. `eat_food` — manual food consumption
13. `attack_entity` — basic combat
14. `get_surroundings` — situational awareness
15. `follow_player` — player tracking

### Phase 3 (Polish)
16. `creative_give_item` — creative inventory
17. `creative_fly_to` — creative flight
18. `sleep_in_bed` — sleep cycle
19. Advanced PvP (install mineflayer-pvp when needed)

---

## 7. Source URLs

| Package | npm | GitHub |
|---------|-----|--------|
| mineflayer | https://www.npmjs.com/package/mineflayer | https://github.com/PrismarineJS/mineflayer |
| mineflayer-pathfinder | https://www.npmjs.com/package/mineflayer-pathfinder | https://github.com/PrismarineJS/mineflayer-pathfinder |
| mineflayer-collectblock | https://www.npmjs.com/package/mineflayer-collectblock | https://github.com/PrismarineJS/mineflayer-collectblock |
| mineflayer-tool | https://www.npmjs.com/package/mineflayer-tool | https://github.com/PrismarineJS/mineflayer-tool |
| mineflayer-auto-eat | https://www.npmjs.com/package/mineflayer-auto-eat | https://github.com/link-discord/mineflayer-auto-eat |
| mineflayer-pvp | https://www.npmjs.com/package/mineflayer-pvp | https://github.com/PrismarineJS/mineflayer-pvp |
| minecraft-data | https://www.npmjs.com/package/minecraft-data | https://github.com/PrismarineJS/minecraft-data |
| prismarine-item | https://www.npmjs.com/package/prismarine-item | https://github.com/PrismarineJS/prismarine-item |
| prismarine-block | https://www.npmjs.com/package/prismarine-block | https://github.com/PrismarineJS/prismarine-block |
| prismarine-entity | https://www.npmjs.com/package/prismarine-entity | https://github.com/PrismarineJS/prismarine-entity |
| prismarine-recipe | https://www.npmjs.com/package/prismarine-recipe | https://github.com/PrismarineJS/prismarine-recipe |
| prismarine-windows | https://www.npmjs.com/package/prismarine-windows | https://github.com/PrismarineJS/prismarine-windows |
| vec3 | https://www.npmjs.com/package/vec3 | https://github.com/PrismarineJS/node-vec3 |
