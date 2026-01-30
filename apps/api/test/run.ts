#!/usr/bin/env bun
/**
 * OpenCode Session Runner
 * 
 * Simple script to create an OpenCode sandbox session.
 * 
 * Usage:
 *   bun run test:run
 *   bun run test:run --destroy  # Destroy existing sandbox first
 */

import {
  createOpenCodeSession,
  destroySandbox,
  getSandboxId,
} from "../src/lib/daytona.js";

// Configuration
const CONFIG = {
  repoUrl: "https://github.com/akshithambekar/cursor-demo-repo.git",
  branch: "main",
  name: "opencode-test",
  public: true,
  autoStopInterval: 30,
};

const args = process.argv.slice(2);

function log(message: string, color: "reset" | "green" | "red" | "yellow" | "blue" | "cyan" = "reset") {
  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  console.clear();

  log("OpenCode Session Runner", "cyan");
  console.log("=".repeat(60));

  // Check for destroy flag
  if (args.includes("--destroy")) {
    const existingId = getSandboxId();
    if (existingId) {
      log("Destroying existing sandbox...", "yellow");
      await destroySandbox();
      log("Sandbox destroyed", "green");
    } else {
      log("No existing sandbox to destroy", "blue");
    }
  }

  // Check for existing sandbox
  const existingId = getSandboxId();
  if (existingId) {
    log(`\nExisting sandbox detected: ${existingId}`, "yellow");
    log("Use --destroy flag to destroy it first, or continue with this session.\n");
  }

  // Check environment
  if (!process.env.DAYTONA_API_KEY) {
    logError("DAYTONA_API_KEY environment variable is not set");
    log("Set it with: export DAYTONA_API_KEY=your_key");
    process.exit(1);
  }

  log("\nConfiguration:", "blue");
  log(`  Repository: ${CONFIG.repoUrl}`);
  log(`  Branch: ${CONFIG.branch}`);
  log(`  Name: ${CONFIG.name}`);
  log(`  Public: ${CONFIG.public}`);
  log(`  Auto-stop: ${CONFIG.autoStopInterval} minutes`);

  try {
    log("\nCreating OpenCode session...", "yellow");
    log("This may take a few minutes...\n", "yellow");

    const result = await createOpenCodeSession(CONFIG);

    log("\n" + "=".repeat(60), "green");
    log("Session created successfully!", "green");
    log("=".repeat(60), "green");
    log(`\nSandbox ID: ${result.sandboxId}`, "blue");
    log(`Preview URL: ${result.previewUrl}`, "blue");
    log("\nUse Ctrl+C to stop and destroy the sandbox.", "cyan");

    // Keep process alive
    process.stdin.resume();

  } catch (error) {
    logError(`Failed to create session: ${error}`);
    process.exit(1);
  }
}

function logError(message: string) {
  log(`Error: ${message}`, "red");
}

// Handle Ctrl+C
process.on("SIGINT", async () => {
  console.log("\n");
  log("Cleaning up...", "yellow");
  await destroySandbox();
  log("Sandbox destroyed", "green");
  process.exit(0);
});

main();
