import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolves the boards root directory.
 * Default: <project root>/boards
 */
function boardsRoot() {
  // Walk up from this file to find the project root (where package.json with workspaces lives)
  // cli/src/lib/store.js → project root is 3 levels up
  return path.resolve(import.meta.dirname, '..', '..', '..', 'boards');
}

function boardDir(boardName) {
  return path.join(boardsRoot(), boardName);
}

function configPath(boardName) {
  return path.join(boardDir(boardName), 'config.json');
}

function cardsPath(boardName) {
  return path.join(boardDir(boardName), 'cards.json');
}

function settingsPath(boardName) {
  return path.join(boardDir(boardName), 'settings.json');
}

// --- Board operations ---

export async function listBoards() {
  const root = boardsRoot();
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function boardExists(name) {
  try {
    await fs.access(configPath(name));
    return true;
  } catch {
    return false;
  }
}

export async function createBoard(name, columns = ['To Do', 'In Progress', 'Done'], customFields = []) {
  const dir = boardDir(name);
  await fs.mkdir(dir, { recursive: true });

  const config = { name, columns, customFields };
  await fs.writeFile(configPath(name), JSON.stringify(config, null, 2) + '\n');
  await fs.writeFile(cardsPath(name), '[]\n');
  return config;
}

export async function deleteBoard(name) {
  const dir = boardDir(name);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function readConfig(name) {
  const raw = await fs.readFile(configPath(name), 'utf-8');
  return JSON.parse(raw);
}

export async function writeConfig(name, config) {
  await fs.writeFile(configPath(name), JSON.stringify(config, null, 2) + '\n');
}

export async function readCards(name) {
  const raw = await fs.readFile(cardsPath(name), 'utf-8');
  return JSON.parse(raw);
}

export async function writeCards(name, cards) {
  await fs.writeFile(cardsPath(name), JSON.stringify(cards, null, 2) + '\n');
}

// --- Settings operations ---

export async function readSettings(name) {
  try {
    const raw = await fs.readFile(settingsPath(name), 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Return default settings if file doesn't exist
    return { githubStatusMap: {} };
  }
}

export async function writeSettings(name, settings) {
  await fs.writeFile(settingsPath(name), JSON.stringify(settings, null, 2) + '\n');
}
