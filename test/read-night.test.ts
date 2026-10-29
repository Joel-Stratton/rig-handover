import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight', () => {
  it('reads 2026-10-28 as 5 jobs and 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows).toHaveLength(5);

    const refresh = night.rows.find((row) => row.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      owner: 'rook',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });

    const backup = night.rows.find((row) => row.job === 'notes/backup');
    expect(backup).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      owner: 'lane-07',
    });

    const render = night.rows.find((row) => row.job === 'digest/render');
    expect(render?.owner).toBeNull();
  });
});
