import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/types.js';
import { rowsByJob } from './digest/order.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard, type NightLink } from './views/status.js';

function isMissingFile(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

function digestRows(config: RigConfig, night: string) {
  try {
    return rowsByJob(readNight(config.runsDir, night).rows);
  } catch (err) {
    if (isMissingFile(err)) return null;
    throw err;
  }
}

function nightLinks(config: RigConfig): NightLink[] {
  return readStatus(config).nights.map((night) => {
    const { counts } = readNight(config.runsDir, night);
    return { night, ok: counts.ok, retry: counts.retry, fail: counts.fail };
  });
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} nights={nightLinks(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const rows = digestRows(config, night);
    if (!rows) return c.notFound();
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} rows={rows} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const rows = digestRows(config, c.req.param('night'));
    if (!rows) return c.notFound();
    return c.json(rows);
  });

  return app;
}
