#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const CACHE_PREFIX = ".elm-dep-cache";

function log(message) {
  console.log(`[elm-dep-cache] ${message}`);
}

function error(message) {
  console.error(`[elm-dep-cache] ERROR: ${message}`);
}

function calculateChecksum(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function getElmHome() {
  // Check ELM_HOME environment variable first
  if (process.env.ELM_HOME) {
    return process.env.ELM_HOME;
  }

  // Default ELM_HOME locations based on OS
  const homeDir = process.env.HOME || process.env.USERPROFILE;

  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"),
      "elm",
    );
  } else if (process.platform === "darwin") {
    return path.join(homeDir, ".elm");
  } else {
    // Linux and others
    return path.join(homeDir, ".elm");
  }
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyDirectory(src, dest) {
  ensureDirectoryExists(dest);

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function restoreFromCache(cacheDir, elmHome) {
  log(`Restoring Elm dependencies from cache: ${cacheDir}`);

  try {
    // Ensure ELM_HOME exists
    ensureDirectoryExists(elmHome);

    // Copy cached dependencies to ELM_HOME
    const entries = fs.readdirSync(cacheDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(cacheDir, entry.name);
      const destPath = path.join(elmHome, entry.name);

      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }

    log("✓ Successfully restored dependencies from cache");
    return true;
  } catch (err) {
    error(`Failed to restore from cache: ${err.message}`);
    return false;
  }
}

function installDependencies() {
  log("Installing Elm dependencies...");

  try {
    // Check if there's an elm.json
    if (!fs.existsSync("elm.json")) {
      error("No elm.json found in current directory");
      process.exit(1);
    }

    // Create a temporary file to compile
    const tempFile = "__elm_deps_temp__.elm";
    const elmJson = JSON.parse(fs.readFileSync("elm.json", "utf8"));

    // Generate a minimal Elm file
    const isApp = elmJson.type === "application";
    const moduleContent = isApp
      ? 'module Main exposing (main)\nimport Html\nmain = Html.text ""'
      : 'module Temp exposing (..)\ntemp = ""';

    fs.writeFileSync(tempFile, moduleContent);

    try {
      execSync("elm make " + tempFile + " --output=/dev/null", {
        stdio: "inherit",
        env: process.env,
      });
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }

    log("✓ Successfully installed Elm dependencies");
    return true;
  } catch (err) {
    error(`Failed to install dependencies: ${err.message}`);
    return false;
  }
}

function cacheElmHome(cacheDir, elmHome) {
  log(`Caching Elm dependencies to: ${cacheDir}`);

  try {
    // Ensure cache directory exists
    ensureDirectoryExists(cacheDir);

    // Copy ELM_HOME contents to cache
    if (!fs.existsSync(elmHome)) {
      error(`ELM_HOME does not exist: ${elmHome}`);
      return false;
    }

    const entries = fs.readdirSync(elmHome, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(elmHome, entry.name);
      const destPath = path.join(cacheDir, entry.name);

      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }

    log("✓ Successfully cached dependencies");
    return true;
  } catch (err) {
    error(`Failed to cache dependencies: ${err.message}`);
    return false;
  }
}

function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        removeDirectory(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }

    fs.rmdirSync(dirPath);
  }
}

function cleanOldCaches(currentChecksum) {
  log("Cleaning old cache entries...");

  const cacheBaseDir = path.join(process.cwd(), CACHE_PREFIX);

  if (!fs.existsSync(cacheBaseDir)) {
    log("No cache directory found, nothing to clean");
    return;
  }

  try {
    const entries = fs.readdirSync(cacheBaseDir, { withFileTypes: true });
    let removedCount = 0;
    let keptCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const checksumDir = entry.name;

        if (checksumDir !== currentChecksum) {
          const fullPath = path.join(cacheBaseDir, checksumDir);
          log(`  Removing old cache: ${checksumDir}`);
          removeDirectory(fullPath);
          removedCount++;
        } else {
          log(`  Keeping current cache: ${checksumDir}`);
          keptCount++;
        }
      }
    }

    log(`✓ Cleaned ${removedCount} old cache ${removedCount === 1 ? "entry" : "entries"}`);
    if (keptCount > 0) {
      log(`✓ Kept ${keptCount} current cache ${keptCount === 1 ? "entry" : "entries"}`);
    }
  } catch (err) {
    error(`Failed to clean caches: ${err.message}`);
  }
}

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const cleanMode = args.includes("--clean");

  log("Starting elm-dep-cache");

  // Check if elm.json exists
  const elmJsonPath = path.join(process.cwd(), "elm.json");
  if (!fs.existsSync(elmJsonPath)) {
    error("No elm.json found in current directory");
    process.exit(1);
  }

  // Calculate checksum
  const checksum = calculateChecksum(elmJsonPath);
  log(`elm.json checksum: ${checksum}`);

  // If clean mode, remove old caches and exit
  if (cleanMode) {
    cleanOldCaches(checksum);
    log("✓ Done!");
    process.exit(0);
  }

  // Determine cache directory
  const cacheDir = path.join(process.cwd(), CACHE_PREFIX, checksum);
  const elmHome = getElmHome();

  log(`ELM_HOME: ${elmHome}`);
  log(`Cache directory: ${cacheDir}`);

  // Check if cache exists
  if (fs.existsSync(cacheDir)) {
    log("Cache found!");
    if (restoreFromCache(cacheDir, elmHome)) {
      log("✓ Done! Dependencies restored from cache.");
      process.exit(0);
    } else {
      log("Cache restoration failed, falling back to fresh install...");
    }
  } else {
    log("No cache found, will install and cache dependencies");
  }

  // Install dependencies
  if (!installDependencies()) {
    error("Failed to install dependencies");
    process.exit(1);
  }

  // Cache the installed dependencies
  if (cacheElmHome(cacheDir, elmHome)) {
    log("✓ Done! Dependencies installed and cached.");
  } else {
    log("⚠ Dependencies installed but caching failed");
  }
}

// Run main
main();
