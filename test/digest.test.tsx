import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const configFor = (runsDir: string): RigConfig => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

function tempRuns(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const ok = '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\n';
const fail = '{"at":"2026-10-29T04:00:01+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}\n';
const retries = [
  '{"at":"2026-10-29T01:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:31:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:33:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:37:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
].join('\n');
const orphan = '{"at":"2026-10-29T05:41:09+01:00","job":"digest/render","status":"ok","owner":null}\n';

describe('digest routes', () => {
  it('renders the night and returns the same jobs from JSON', async () => {
    const runsDir = tempRuns({
      '2026-10-28.jsonl': `${ok}${retries}\n${fail}${orphan}this is not json\n`,
    });
    const app = createApp(configFor(runsDir));
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('—');
    expect(html.indexOf('digest/render')).toBeLessThan(html.indexOf('fixtures/refresh'));
    expect(html.indexOf('fixtures/refresh')).toBeLessThan(html.indexOf('notes/backup'));
    expect(html.indexOf('notes/backup')).toBeLessThan(html.indexOf('rig/rotate-logs'));
    expect(html).toContain('class="warn"');

    const json = await app.request('/api/digest/2026-10-28');
    expect(json.status).toBe(200);
    const jobs = (await json.json() as { job: string }[]).map((row) => row.job);
    expect(jobs).toEqual(['digest/render', 'fixtures/refresh', 'notes/backup', 'rig/rotate-logs']);
  });

  it('returns 404 when the night file is missing', async () => {
    const app = createApp(configFor(tempRuns({})));
    expect((await app.request('/digest/1999-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
  });

  it('renders an empty night as nothing ran', async () => {
    const app = createApp(configFor(tempRuns({ '2026-10-28.jsonl': '' })));
    const page = await app.request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const json = await app.request('/api/digest/2026-10-28');
    expect(await json.json()).toEqual([]);
  });

  it('still renders a night that contains a bad line', async () => {
    const app = createApp(configFor(tempRuns({ '2026-10-28.jsonl': `${ok}{"job":\n` })));
    const page = await app.request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('rig/rotate-logs');
    const json = await app.request('/api/digest/2026-10-28');
    const jobs = (await json.json() as { job: string }[]).map((row) => row.job);
    expect(jobs).toEqual(['rig/rotate-logs']);
  });
});

describe('status board digest links', () => {
  it('links both nights on disk to a digest', async () => {
    const app = createApp(configFor('runs'));
    const page = await app.request('/');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('10 ok');
    expect(html).toContain('4 retry');
    expect(html).toContain('1 fail');

    const digest = await app.request('/digest/2026-10-28');
    expect(digest.status).toBe(200);
    const earlier = await app.request('/digest/2026-10-27');
    expect(earlier.status).toBe(200);
  });
});
