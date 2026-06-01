import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  db, UPLOAD_DIR, toStoryboard, toShot, toAudio, touchStoryboard,
  StoryboardRow, ShotRow, AudioRow,
} from './db.js';

const app = new Hono();
app.use('*', cors());

app.use('/uploads/*', serveStatic({ root: './data' }));

// ---- Storyboards ----
app.get('/api/storyboards', (c) => {
  const rows = db.prepare('SELECT * FROM storyboards ORDER BY updated_at DESC').all() as StoryboardRow[];
  return c.json(rows.map(toStoryboard));
});

app.post('/api/storyboards', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO storyboards (id,name,px_per_second,row_width_px,lane_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?)'
  ).run(id, body.name || 'Untitled storyboard', 40, 1100, 3, now, now);
  const sb = db.prepare('SELECT * FROM storyboards WHERE id=?').get(id) as StoryboardRow;
  return c.json(toStoryboard(sb));
});

app.get('/api/storyboards/:id', (c) => {
  const id = c.req.param('id');
  const sb = db.prepare('SELECT * FROM storyboards WHERE id=?').get(id) as StoryboardRow | undefined;
  if (!sb) return c.json({ error: 'not found' }, 404);
  const shots = db.prepare('SELECT * FROM shots WHERE storyboard_id=? ORDER BY "order"').all(id) as ShotRow[];
  const audio = db.prepare('SELECT * FROM audio_markers WHERE storyboard_id=?').all(id) as AudioRow[];
  return c.json({
    ...toStoryboard(sb),
    shots: shots.map(toShot),
    audioMarkers: audio.map(toAudio),
  });
});

app.patch('/api/storyboards/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const map: Record<string, string> = {
    name: 'name', pxPerSecond: 'px_per_second', rowWidthPx: 'row_width_px', laneCount: 'lane_count',
  };
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col}=?`); vals.push(body[k]); }
  }
  if (!sets.length) return c.json({ ok: true });
  sets.push('updated_at=?'); vals.push(Date.now()); vals.push(id);
  db.prepare(`UPDATE storyboards SET ${sets.join(',')} WHERE id=?`).run(...vals as never[]);
  const sb = db.prepare('SELECT * FROM storyboards WHERE id=?').get(id) as StoryboardRow;
  return c.json(toStoryboard(sb));
});

app.delete('/api/storyboards/:id', (c) => {
  db.prepare('DELETE FROM storyboards WHERE id=?').run(c.req.param('id'));
  return c.json({ ok: true });
});

// ---- Shots ----
app.post('/api/storyboards/:id/shots', async (c) => {
  const sbId = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const id = randomUUID();
  const maxOrder = db.prepare('SELECT COALESCE(MAX("order"), -1) AS m FROM shots WHERE storyboard_id=?').get(sbId) as { m: number };
  db.prepare(
    'INSERT INTO shots (id,storyboard_id,"order",title,description,duration_sec,image_url) VALUES (?,?,?,?,?,?,?)'
  ).run(
    id, sbId, maxOrder.m + 1,
    body.title || '', body.description || '',
    body.durationSec ?? 3, body.imageUrl || null,
  );
  touchStoryboard(sbId);
  return c.json(toShot(db.prepare('SELECT * FROM shots WHERE id=?').get(id) as ShotRow));
});

app.patch('/api/shots/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const map: Record<string, string> = {
    title: 'title', description: 'description', durationSec: 'duration_sec', imageUrl: 'image_url',
  };
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col}=?`); vals.push(body[k]); }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE shots SET ${sets.join(',')} WHERE id=?`).run(...vals as never[]);
  const shot = db.prepare('SELECT * FROM shots WHERE id=?').get(id) as ShotRow;
  touchStoryboard(shot.storyboard_id);
  return c.json(toShot(shot));
});

app.delete('/api/shots/:id', (c) => {
  const id = c.req.param('id');
  const shot = db.prepare('SELECT * FROM shots WHERE id=?').get(id) as ShotRow | undefined;
  if (!shot) return c.json({ ok: true });
  db.prepare('DELETE FROM shots WHERE id=?').run(id);
  // Re-pack order
  const rest = db.prepare('SELECT id FROM shots WHERE storyboard_id=? ORDER BY "order"').all(shot.storyboard_id) as { id: string }[];
  const stmt = db.prepare('UPDATE shots SET "order"=? WHERE id=?');
  const tx = db.transaction(() => rest.forEach((r, i) => stmt.run(i, r.id)));
  tx();
  touchStoryboard(shot.storyboard_id);
  return c.json({ ok: true });
});

app.put('/api/storyboards/:id/shot-order', async (c) => {
  const sbId = c.req.param('id');
  const { ids } = await c.req.json() as { ids: string[] };
  const stmt = db.prepare('UPDATE shots SET "order"=? WHERE id=? AND storyboard_id=?');
  const tx = db.transaction(() => ids.forEach((id, i) => stmt.run(i, id, sbId)));
  tx();
  touchStoryboard(sbId);
  return c.json({ ok: true });
});

// ---- Audio markers ----
app.post('/api/storyboards/:id/audio', async (c) => {
  const sbId = c.req.param('id');
  const body = await c.req.json();
  const id = randomUUID();
  db.prepare(
    'INSERT INTO audio_markers (id,storyboard_id,lane,start_sec,end_sec,label,color) VALUES (?,?,?,?,?,?,?)'
  ).run(
    id, sbId, body.lane ?? 0, body.startSec, body.endSec,
    body.label || '', body.color || '#7c3aed',
  );
  touchStoryboard(sbId);
  return c.json(toAudio(db.prepare('SELECT * FROM audio_markers WHERE id=?').get(id) as AudioRow));
});

app.patch('/api/audio/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const map: Record<string, string> = {
    lane: 'lane', startSec: 'start_sec', endSec: 'end_sec', label: 'label', color: 'color',
  };
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col}=?`); vals.push(body[k]); }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE audio_markers SET ${sets.join(',')} WHERE id=?`).run(...vals as never[]);
  const a = db.prepare('SELECT * FROM audio_markers WHERE id=?').get(id) as AudioRow;
  touchStoryboard(a.storyboard_id);
  return c.json(toAudio(a));
});

app.delete('/api/audio/:id', (c) => {
  const id = c.req.param('id');
  const a = db.prepare('SELECT * FROM audio_markers WHERE id=?').get(id) as AudioRow | undefined;
  db.prepare('DELETE FROM audio_markers WHERE id=?').run(id);
  if (a) touchStoryboard(a.storyboard_id);
  return c.json({ ok: true });
});

// ---- Upload ----
app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'no file' }, 400);
  const ext = (path.extname(file.name) || '.png').toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  return c.json({ url: `/uploads/${filename}` });
});

const port = Number(process.env.PORT ?? 5174);
serve({ fetch: app.fetch, port });
console.log(`overboard server listening on http://localhost:${port}`);
