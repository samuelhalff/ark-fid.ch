#!/usr/bin/env node
/**
 * Development orchestrator: runs the Tailwind watcher alongside Next.js dev server.
 * Keeps non-critical CSS up-to-date so styles match production without manual steps.
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

const tailwindCmd = path.join(
  root,
  "node_modules",
  ".bin",
  isWindows ? "tailwindcss.cmd" : "tailwindcss"
);

const nextCmd = path.join(
  root,
  "node_modules",
  ".bin",
  isWindows ? "next.cmd" : "next"
);

const processes = [];
let nextChild = null;
let restartingNext = false;

function spawnProcess(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT") return;
    if (code && code !== 0) {
      console.error(`\n[dev] ${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  child.on("error", (err) => {
    console.error(`\n[dev] Failed to start ${name}:`, err);
    shutdown(1);
  });

  processes.push(child);
  return child;
}

function shutdown(code = 0) {
  if (nextChild && !nextChild.killed) {
    nextChild.kill("SIGTERM");
  }
  while (processes.length) {
    const child = processes.pop();
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  if (!process.exitCode) {
    process.exitCode = code;
  }
}

process.on("SIGINT", () => {
  shutdown(0);
  process.exit();
});

process.on("SIGTERM", () => {
  shutdown(0);
  process.exit();
});

process.on("exit", () => {
  shutdown(0);
});

spawnProcess(
  tailwindCmd,
  [
    "-i",
    path.join("app", "globals.css"),
    "-o",
    path.join("public", "assets", "css", "non-critical.css"),
    "--config",
    "tailwind.config.ts",
    "--watch",
  ],
  "tailwindcss --watch"
);

function startNext() {
    const child = spawn(nextCmd, ["dev", "-p", "5000"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env },
    });

    child.on("exit", (code, signal) => {
      if (restartingNext) {
        restartingNext = false;
        startNext();
        return;
      }
      if (signal === "SIGTERM" || signal === "SIGINT") return;
      if (code && code !== 0) {
        console.error(`\n[dev] next dev exited with code ${code}`);
        shutdown(code);
      }
    });

    child.on("error", (err) => {
      console.error(`\n[dev] Failed to start next dev:`, err);
      shutdown(1);
    });

    nextChild = child;
}

startNext();

const criticalCssPath = path.join(
  root,
  "public",
  "assets",
  "css",
  "critical.css"
);

let restartTimer = null;
try {
  fs.watch(criticalCssPath, { persistent: true }, (eventType) => {
    if (eventType !== "change" && eventType !== "rename") return;
    if (restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      console.log("\n[dev] Detected critical.css change. Restarting next dev...");
      if (nextChild && !nextChild.killed) {
        restartingNext = true;
        nextChild.kill("SIGTERM");
      } else {
        startNext();
      }
    }, 150);
  });
} catch (err) {
  console.warn("[dev] Unable to watch critical.css for reloads:", err.message);
}
