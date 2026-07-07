// Central config: repo paths, deck registry loading, shared constants.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..', '..');

export const PATHS = {
  repo: REPO_ROOT,
  goldens: resolve(REPO_ROOT, 'goldens'),
  shots: resolve(REPO_ROOT, 'shots'),
  reports: resolve(REPO_ROOT, 'reports'),
  config: resolve(REPO_ROOT, 'config'),
  venvOld: resolve(REPO_ROOT, 'envs', '.venv-old'),
  venvNew: resolve(REPO_ROOT, 'envs', '.venv-new'),
  jupyterConfigOld: resolve(REPO_ROOT, 'envs', 'old', 'jupyter-config'),
  jupyterConfigNew: resolve(REPO_ROOT, 'envs', 'new', 'jupyter-config')
};

// Fixed token + ports so servers are addressable and reproducible.
export const TOKEN = 'risetoken';
export const PORT_OLD = 8899;
export const PORT_NEW = 8898;

export interface Viewport {
  width: number;
  height: number;
}

export interface Deck {
  id: string;
  path: string;
  glob: string;
  viewport: Viewport;
  sample?: string[];
  notes?: string;
}

interface DecksFile {
  viewportDefault: Viewport;
  decks: Deck[];
}

export function loadDecks(): DecksFile {
  const raw = readFileSync(resolve(PATHS.config, 'decks.json'), 'utf8');
  return JSON.parse(raw) as DecksFile;
}

export function getDeck(id: string): Deck {
  const { decks } = loadDecks();
  const deck = decks.find((d) => d.id === id);
  if (!deck) {
    throw new Error(`Deck '${id}' not found in config/decks.json`);
  }
  return deck;
}
