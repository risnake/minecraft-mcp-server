import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadConfig } from "./config.js";
import { MinecraftSession } from "./minecraft-session.js";

function log(msg: string): void {
  process.stderr.write(`[minecraft-mcp-server] ${msg}\n`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const session = new MinecraftSession({
    mode: config.mode,
    connection: config.connection,
  });
  const server = createServer({ session, mode: config.mode });
  const transport = new StdioServerTransport();

  log(`Starting MCP server (pid=${process.pid})…`);
  log(
    `Configured mode=${config.mode}, endpoint=${config.connection.host}:${config.connection.port}, ` +
      `username=${config.connection.username}, autoConnect=${config.autoConnect}`
  );

  if (config.autoConnect) {
    try {
      await session.connect();
      log("Auto-connect succeeded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Auto-connect failed: ${message}`);
    }
  }

  await server.connect(transport);

  log("MCP server running on stdio.");

  // Graceful shutdown
  const shutdown = (signal: string) => {
    log(`Received ${signal}, shutting down…`);
    if (session.getStatus().state !== "disconnected") {
      try {
        session.disconnect();
      } catch (err) {
        log(`Error during disconnect: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  log(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
