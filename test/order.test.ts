import { describe, expect, it } from 'vitest';
import { rowsByJob } from '../src/digest/order.js';
import type { DigestRow } from '../src/digest/types.js';

const row = (job: string): DigestRow => ({
  job,
  owner: 'rook',
  runs: 1,
  retries: 0,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-10-28T23:00:00+01:00',
  lastAt: '2026-10-28T23:00:00+01:00',
});

describe('rowsByJob', () => {
  it('orders rows by job and leaves the input unchanged', () => {
    const rows = [row('lane/sync'), row('digest/render'), row('notes/backup')];
    expect(rowsByJob(rows).map((item) => item.job)).toEqual([
      'digest/render',
      'lane/sync',
      'notes/backup',
    ]);
    expect(rows.map((item) => item.job)).toEqual(['lane/sync', 'digest/render', 'notes/backup']);
  });
});
