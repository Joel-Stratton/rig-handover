import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
  counts: { ok: number; retry: number; fail: number };
};

const statuses = new Set<JobStatus>(['ok', 'retry', 'fail']);

type ParsedLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

function parseLine(line: string): ParsedLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== 'string' || typeof row.job !== 'string') return null;
  if (typeof row.status !== 'string' || !statuses.has(row.status as JobStatus)) return null;
  if (row.owner !== null && typeof row.owner !== 'string') return null;
  if (row.error !== undefined && typeof row.error !== 'string') return null;
  return {
    at: row.at,
    job: row.job,
    status: row.status as JobStatus,
    owner: row.owner,
    error: typeof row.error === 'string' ? row.error : null,
  };
}

export function readNight(runsDir: string, night: string): NightDigest {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const byJob = new Map<string, DigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const line of text.split(/\n/)) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const existing = byJob.get(parsed.job);
    if (!existing) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }
    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    existing.lastStatus = parsed.status;
    existing.lastError = parsed.error;
    existing.owner = parsed.owner;
    existing.lastAt = parsed.at;
  }

  return { rows: [...byJob.values()], badLines, counts };
}
