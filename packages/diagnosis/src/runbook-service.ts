import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunbookEntry } from '@aapsd/contracts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_RUNBOOKS_DIR = resolve(__dirname, '../../../docs/runbooks');

interface RawRunbook {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

function parseFrontmatter(text: string): RawRunbook | null {
  const lines = text.split('\n');
  if (lines.length < 3 || lines[0].trim() !== '---') return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return null;

  const fmLines = lines.slice(1, endIndex);
  const content = lines
    .slice(endIndex + 1)
    .join('\n')
    .trim();

  const fm: Record<string, string> = {};
  for (const raw of fmLines) {
    const colonIdx = raw.indexOf(':');
    if (colonIdx === -1) continue;
    const key = raw.slice(0, colonIdx).trim();
    let value = raw.slice(colonIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }

  if (!fm.id || !fm.title) return null;

  let tags: string[] = [];
  if (fm.tags) {
    const raw = fm.tags.replace(/[[\]"']/g, '');
    tags = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return { id: fm.id, title: fm.title, tags, content };
}

function loadRunbooks(dir: string): RawRunbook[] {
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const runbooks: RawRunbook[] = [];

  for (const file of files) {
    const fullPath = resolve(dir, file);
    const text = readFileSync(fullPath, 'utf-8');
    const parsed = parseFrontmatter(text);
    if (parsed) {
      runbooks.push(parsed);
    }
  }

  return runbooks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreRunbook(runbook: RawRunbook, queryTokens: string[]): number {
  let score = 0;

  const tagMatches = runbook.tags.filter((tag) =>
    queryTokens.some((t) => tag.includes(t) || t.includes(tag)),
  ).length;
  score += tagMatches * 3;

  const titleTokens = tokenize(runbook.title);
  const titleMatches = queryTokens.filter((t) =>
    titleTokens.some((tt) => tt.includes(t) || t.includes(tt)),
  ).length;
  score += titleMatches * 2;

  const contentTokens = tokenize(runbook.content);
  const contentMatches = queryTokens.filter((t) =>
    contentTokens.some((ct) => ct.includes(t) || t.includes(ct)),
  ).length;
  score += contentMatches;

  return score;
}

export function buildRunbookLookup(dir?: string): (query: string) => RunbookEntry | null {
  const runbooks = loadRunbooks(dir ?? DEFAULT_RUNBOOKS_DIR);

  return (query: string): RunbookEntry | null => {
    if (!query || query.trim().length === 0) return null;

    const queryTokens = tokenize(query);

    let best: RawRunbook | null = null;
    let bestScore = 0;

    for (const rb of runbooks) {
      const score = scoreRunbook(rb, queryTokens);
      if (score > bestScore) {
        bestScore = score;
        best = rb;
      }
    }

    if (!best || bestScore === 0) return null;

    return {
      id: best.id,
      title: best.title,
      content: best.content,
      tags: best.tags,
    };
  };
}

let defaultLookup: ((query: string) => RunbookEntry | null) | null = null;

export async function retrieveRunbook(query: string): Promise<RunbookEntry | null> {
  if (!defaultLookup) {
    defaultLookup = buildRunbookLookup();
  }
  return defaultLookup(query);
}
