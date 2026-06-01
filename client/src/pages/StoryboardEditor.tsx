import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { AudioMarker, Shot, StoryboardDetail } from '../types';
import { audioSegments, layoutRows, rowSecToX, totalDuration, xToRowSec } from '../layout';
import ShotCard from '../components/ShotCard';
import AudioBarView from '../components/AudioBarView';
import SidePanel from '../components/SidePanel';

const PALETTE = ['#7c3aed', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#3b82f6'];

export default function StoryboardEditor() {
  const { id } = useParams<{ id: string }>();
  const [sb, setSb] = useState<StoryboardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggingShotId, setDraggingShotId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [playSec, setPlaySec] = useState(0);
  const playStartRef = useRef<{ wallMs: number; baseSec: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await api.getStoryboard(id);
    setSb(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ---- Playback loop ----
  useEffect(() => {
    if (!playing || !sb) return;
    const total = totalDuration(sb.shots);
    playStartRef.current = { wallMs: performance.now(), baseSec: playSec >= total ? 0 : playSec };
    if (playSec >= total) setPlaySec(0);
    const tick = () => {
      const st = playStartRef.current!;
      const elapsed = (performance.now() - st.wallMs) / 1000;
      const t = st.baseSec + elapsed;
      if (t >= total) {
        setPlaySec(total);
        setPlaying(false);
        return;
      }
      setPlaySec(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const rows = useMemo(() => {
    if (!sb) return [];
    return layoutRows(sb.shots, sb.pxPerSecond, sb.rowWidthPx);
  }, [sb]);

  const segments = useMemo(() => {
    if (!sb) return [];
    return audioSegments(rows, sb.audioMarkers);
  }, [rows, sb]);

  const segmentsByRowLane = useMemo(() => {
    const m = new Map<string, typeof segments>();
    for (const seg of segments) {
      const key = `${seg.rowIndex}:${seg.marker.lane}`;
      const arr = m.get(key) ?? [];
      arr.push(seg);
      m.set(key, arr);
    }
    return m;
  }, [segments]);

  if (loading || !sb) {
    return <div className="empty">Loading…</div>;
  }

  const total = totalDuration(sb.shots);

  // ---- Mutations ----
  const updateSettings = async (patch: Partial<StoryboardDetail>) => {
    setSb({ ...sb, ...patch });
    await api.updateStoryboard(sb.id, patch);
  };

  const addShot = async () => {
    const shot = await api.addShot(sb.id, { title: 'New shot', durationSec: 3 });
    setSb({ ...sb, shots: [...sb.shots, shot] });
    setSelectedShotId(shot.id);
  };

  const updateShot = async (shotId: string, patch: Partial<Shot>) => {
    setSb({ ...sb, shots: sb.shots.map((s) => s.id === shotId ? { ...s, ...patch } : s) });
    await api.updateShot(shotId, patch);
  };

  const deleteShot = async (shotId: string) => {
    if (!confirm('Delete this shot?')) return;
    await api.deleteShot(shotId);
    setSb({ ...sb, shots: sb.shots.filter((s) => s.id !== shotId) });
    setSelectedShotId(null);
  };

  const reorderShot = async (shotId: string, toIdx: number) => {
    const cur = sb.shots.slice();
    const fromIdx = cur.findIndex((s) => s.id === shotId);
    if (fromIdx === -1) return;
    const [moved] = cur.splice(fromIdx, 1);
    const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx;
    cur.splice(adjusted, 0, moved);
    setSb({ ...sb, shots: cur });
    await api.reorderShots(sb.id, cur.map((s) => s.id));
  };

  const addAudio = async () => {
    const start = Math.max(0, total - 2);
    const end = total > 0 ? total : 2;
    const marker = await api.addAudio(sb.id, {
      startSec: start, endSec: end, label: 'audio',
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      lane: 0,
    });
    setSb({ ...sb, audioMarkers: [...sb.audioMarkers, marker] });
    setSelectedAudioId(marker.id);
  };

  const updateAudioLocal = (audioId: string, patch: Partial<AudioMarker>) => {
    setSb((cur) => cur ? {
      ...cur,
      audioMarkers: cur.audioMarkers.map((m) => m.id === audioId ? { ...m, ...patch } : m),
    } : cur);
  };
  const commitAudio = async (audioId: string) => {
    const m = sb.audioMarkers.find((x) => x.id === audioId);
    if (!m) return;
    await api.updateAudio(audioId, {
      startSec: m.startSec, endSec: m.endSec, lane: m.lane, label: m.label, color: m.color,
    });
  };
  const deleteAudio = async (audioId: string) => {
    await api.deleteAudio(audioId);
    setSb({ ...sb, audioMarkers: sb.audioMarkers.filter((m) => m.id !== audioId) });
    setSelectedAudioId(null);
  };

  // Active shot/audio under the playhead
  const activeShotId = useMemo(() => {
    let acc = 0;
    for (const s of sb.shots) {
      acc += s.durationSec;
      if (playSec < acc) return s.id;
    }
    return null;
  }, [sb.shots, playSec]);

  const activeAudioIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of sb.audioMarkers) {
      if (playSec >= m.startSec && playSec < m.endSec) set.add(m.id);
    }
    return set;
  }, [sb.audioMarkers, playSec]);

  const selectedShot = sb.shots.find((s) => s.id === selectedShotId) ?? null;
  const selectedAudio = sb.audioMarkers.find((m) => m.id === selectedAudioId) ?? null;

  // ---- Audio drag handlers ----
  const moveAudio = (audioId: string, deltaSec: number) => {
    const m = sb.audioMarkers.find((x) => x.id === audioId);
    if (!m) return;
    const len = m.endSec - m.startSec;
    const newStart = Math.max(0, Math.min(total - len, m.startSec + deltaSec));
    updateAudioLocal(audioId, { startSec: newStart, endSec: newStart + len });
  };
  const resizeAudioLeft = (audioId: string, deltaSec: number) => {
    const m = sb.audioMarkers.find((x) => x.id === audioId);
    if (!m) return;
    const newStart = Math.max(0, Math.min(m.endSec - 0.1, m.startSec + deltaSec));
    updateAudioLocal(audioId, { startSec: newStart });
  };
  const resizeAudioRight = (audioId: string, deltaSec: number) => {
    const m = sb.audioMarkers.find((x) => x.id === audioId);
    if (!m) return;
    const newEnd = Math.max(m.startSec + 0.1, Math.min(total, m.endSec + deltaSec));
    updateAudioLocal(audioId, { endSec: newEnd });
  };

  // Click empty lane to create marker
  const createAudioAtClick = async (rowIdx: number, lane: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.audio-bar')) return;
    const laneEl = e.currentTarget as HTMLDivElement;
    const rect = laneEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const row = rows[rowIdx];
    if (!row) return;
    const sec = xToRowSec(row, x);
    const len = Math.min(2, row.endSec - sec);
    const m = await api.addAudio(sb.id, {
      startSec: sec, endSec: sec + Math.max(0.5, len),
      label: 'audio', color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      lane,
    });
    setSb({ ...sb, audioMarkers: [...sb.audioMarkers, m] });
    setSelectedAudioId(m.id);
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <Link to="/" className="btn ghost">← Storyboards</Link>
        <input
          className="name"
          value={sb.name}
          onChange={(e) => setSb({ ...sb, name: e.target.value })}
          onBlur={(e) => api.updateStoryboard(sb.id, { name: e.target.value })}
          style={{ minWidth: 220 }}
        />
        <span className="meta">{total.toFixed(1)}s · {sb.shots.length} shots · {sb.audioMarkers.length} audio</span>
        <div className="spacer" />
        <label className="meta">px/sec
          <input
            type="number" min={5} max={400} value={sb.pxPerSecond}
            style={{ width: 70, marginLeft: 6 }}
            onChange={(e) => updateSettings({ pxPerSecond: Number(e.target.value) })}
          />
        </label>
        <label className="meta">row width
          <input
            type="number" min={400} max={4000} step={50} value={sb.rowWidthPx}
            style={{ width: 80, marginLeft: 6 }}
            onChange={(e) => updateSettings({ rowWidthPx: Number(e.target.value) })}
          />
        </label>
        <label className="meta">lanes
          <input
            type="number" min={1} max={8} value={sb.laneCount}
            style={{ width: 50, marginLeft: 6 }}
            onChange={(e) => updateSettings({ laneCount: Number(e.target.value) })}
          />
        </label>
        <button className="btn" onClick={addShot}>+ Shot</button>
        <button className="btn" onClick={addAudio} disabled={total === 0}>+ Audio</button>
        <button
          className="btn primary"
          onClick={() => setPlaying((p) => !p)}
          disabled={total === 0}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        {playing || playSec > 0 ? (
          <button className="btn" onClick={() => { setPlaying(false); setPlaySec(0); }}>Stop</button>
        ) : null}
        <span className="meta">{playSec.toFixed(1)}s / {total.toFixed(1)}s</span>
      </div>

      <div className="editor-body" style={{ paddingRight: (selectedShot || selectedAudio) ? 380 : 16 }}>
        {sb.shots.length === 0 ? (
          <div className="empty">No shots yet. Click <span className="kbd">+ Shot</span> to add the first one.</div>
        ) : (
          rows.map((row) => {
            const playInRow = playSec >= row.startSec && playSec <= row.endSec;
            const playX = playInRow ? rowSecToX(row, playSec) : -9999;
            return (
              <div key={row.index} className="row-block" style={{ width: row.widthPx }}>
                <div className="row-time-axis" style={{ width: row.widthPx }}>
                  {makeTicks(row.startSec, row.endSec, sb.pxPerSecond).map((t, i) => (
                    <span key={i} className="tick" style={{ left: (t - row.startSec) * sb.pxPerSecond }}>{t.toFixed(0)}s</span>
                  ))}
                </div>

                <div className="row-shots" style={{ width: row.widthPx }}>
                  <DropTarget
                    active={draggingShotId !== null && dropIdx === firstShotIndex(sb.shots, row, 0)}
                    onDragEnter={() => setDropIdx(firstShotIndex(sb.shots, row, 0))}
                    onDragLeave={() => setDropIdx(null)}
                    onDrop={() => {
                      if (draggingShotId) reorderShot(draggingShotId, firstShotIndex(sb.shots, row, 0));
                      setDropIdx(null);
                    }}
                  />
                  {row.shots.map((rs, i) => {
                    const globalIdx = sb.shots.findIndex((s) => s.id === rs.shot.id);
                    return (
                      <div key={rs.shot.id} style={{ display: 'flex' }}>
                        <ShotCard
                          shot={rs.shot}
                          widthPx={rs.widthPx}
                          active={activeShotId === rs.shot.id}
                          dragging={draggingShotId === rs.shot.id}
                          onClick={() => { setSelectedShotId(rs.shot.id); setSelectedAudioId(null); }}
                          onDragStart={() => setDraggingShotId(rs.shot.id)}
                          onDragEnd={() => { setDraggingShotId(null); setDropIdx(null); }}
                        />
                        <DropTarget
                          active={draggingShotId !== null && dropIdx === globalIdx + 1}
                          onDragEnter={() => setDropIdx(globalIdx + 1)}
                          onDragLeave={() => setDropIdx(null)}
                          onDrop={() => {
                            if (draggingShotId) reorderShot(draggingShotId, globalIdx + 1);
                            setDropIdx(null);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="lanes" style={{ width: row.widthPx, position: 'relative' }}>
                  {Array.from({ length: sb.laneCount }).map((_, lane) => (
                    <div
                      key={lane}
                      className="lane"
                      style={{ width: row.widthPx }}
                      onClick={(e) => createAudioAtClick(row.index, lane, e)}
                    >
                      <span className="lane-label">A{lane + 1}</span>
                      {(segmentsByRowLane.get(`${row.index}:${lane}`) ?? []).map((seg) => (
                        <AudioBarView
                          key={seg.marker.id + ':' + seg.rowIndex}
                          segment={seg}
                          pxPerSecond={sb.pxPerSecond}
                          active={selectedAudioId === seg.marker.id || activeAudioIds.has(seg.marker.id)}
                          onClick={() => { setSelectedAudioId(seg.marker.id); setSelectedShotId(null); }}
                          onDrag={(d) => moveAudio(seg.marker.id, d)}
                          onResizeLeft={(d) => resizeAudioLeft(seg.marker.id, d)}
                          onResizeRight={(d) => resizeAudioRight(seg.marker.id, d)}
                          onCommit={() => commitAudio(seg.marker.id)}
                        />
                      ))}
                    </div>
                  ))}
                  {playInRow && <div className="playhead" style={{ left: playX, top: -2, height: `calc(100% + 4px)` }} />}
                </div>
              </div>
            );
          })
        )}
      </div>

      <SidePanel
        title="Shot"
        open={!!selectedShot}
        onClose={() => setSelectedShotId(null)}
      >
        {selectedShot && (
          <ShotForm
            key={selectedShot.id}
            shot={selectedShot}
            onChange={(p) => updateShot(selectedShot.id, p)}
            onDelete={() => deleteShot(selectedShot.id)}
          />
        )}
      </SidePanel>

      <SidePanel
        title="Audio marker"
        open={!!selectedAudio}
        onClose={() => setSelectedAudioId(null)}
      >
        {selectedAudio && (
          <AudioForm
            key={selectedAudio.id}
            marker={selectedAudio}
            laneCount={sb.laneCount}
            totalDuration={total}
            onChange={(p) => { updateAudioLocal(selectedAudio.id, p); }}
            onCommit={() => commitAudio(selectedAudio.id)}
            onDelete={() => deleteAudio(selectedAudio.id)}
          />
        )}
      </SidePanel>
    </div>
  );
}

function makeTicks(startSec: number, endSec: number, pxPerSecond: number): number[] {
  const span = endSec - startSec;
  // Aim for ~80px between ticks
  const desired = 80 / pxPerSecond;
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60];
  const step = candidates.find((c) => c >= desired) ?? 60;
  const ticks: number[] = [];
  const first = Math.ceil(startSec / step) * step;
  for (let t = first; t <= endSec + 1e-6 && ticks.length < 30; t += step) ticks.push(t);
  if (span > 0 && ticks.length === 0) ticks.push(startSec);
  return ticks;
}

function firstShotIndex(shots: Shot[], row: { shots: { shot: Shot }[] }, offset: number): number {
  if (row.shots.length === 0) return shots.length;
  return shots.findIndex((s) => s.id === row.shots[offset].shot.id);
}

function DropTarget(props: { active: boolean; onDragEnter: () => void; onDragLeave: () => void; onDrop: () => void }) {
  return (
    <div
      className={`drop-target ${props.active ? 'active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; props.onDragEnter(); }}
      onDragLeave={props.onDragLeave}
      onDrop={(e) => { e.preventDefault(); props.onDrop(); }}
    />
  );
}

function ShotForm({ shot, onChange, onDelete }: {
  shot: Shot;
  onChange: (p: Partial<Shot>) => void;
  onDelete: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await api.upload(file);
      onChange({ imageUrl: url });
    } finally { setUploading(false); }
  };

  return (
    <>
      <div className="field">
        <label>Title</label>
        <input value={shot.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="field">
        <label>Description / prompt</label>
        <textarea rows={4} value={shot.description} onChange={(e) => onChange({ description: e.target.value })} />
      </div>
      <div className="field">
        <label>Duration (seconds)</label>
        <input
          type="number" min={0.1} step={0.1} value={shot.durationSec}
          onChange={(e) => onChange({ durationSec: Math.max(0.1, Number(e.target.value)) })}
        />
      </div>
      <div className="field">
        <label>Reference image</label>
        {shot.imageUrl && (
          <div style={{ marginBottom: 8 }}>
            <img src={shot.imageUrl} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)' }} />
            <button className="btn ghost danger" style={{ marginTop: 6 }} onClick={() => onChange({ imageUrl: null })}>
              Remove image
            </button>
          </div>
        )}
        <input
          type="file" accept="image/*" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
        />
        {uploading && <div className="meta">Uploading…</div>}
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn danger" onClick={onDelete}>Delete shot</button>
      </div>
    </>
  );
}

function AudioForm({ marker, laneCount, totalDuration, onChange, onCommit, onDelete }: {
  marker: AudioMarker;
  laneCount: number;
  totalDuration: number;
  onChange: (p: Partial<AudioMarker>) => void;
  onCommit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="field">
        <label>Label</label>
        <input value={marker.label} onChange={(e) => onChange({ label: e.target.value })} onBlur={onCommit} />
      </div>
      <div className="row-2">
        <div className="field">
          <label>Start (sec)</label>
          <input
            type="number" min={0} max={totalDuration} step={0.1}
            value={marker.startSec}
            onChange={(e) => {
              const v = Math.max(0, Math.min(marker.endSec - 0.1, Number(e.target.value)));
              onChange({ startSec: v });
            }}
            onBlur={onCommit}
          />
        </div>
        <div className="field">
          <label>End (sec)</label>
          <input
            type="number" min={0} max={totalDuration} step={0.1}
            value={marker.endSec}
            onChange={(e) => {
              const v = Math.max(marker.startSec + 0.1, Math.min(totalDuration, Number(e.target.value)));
              onChange({ endSec: v });
            }}
            onBlur={onCommit}
          />
        </div>
      </div>
      <div className="field">
        <label>Lane</label>
        <select value={marker.lane} onChange={(e) => { onChange({ lane: Number(e.target.value) }); onCommit(); }}>
          {Array.from({ length: laneCount }).map((_, i) => (
            <option key={i} value={i}>A{i + 1}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Color</label>
        <div className="color-row">
          {PALETTE.map((c) => (
            <div
              key={c}
              className={`color-swatch ${marker.color === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => { onChange({ color: c }); onCommit(); }}
            />
          ))}
        </div>
      </div>
      <div className="field meta">
        Duration: {(marker.endSec - marker.startSec).toFixed(2)}s
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn danger" onClick={onDelete}>Delete marker</button>
      </div>
    </>
  );
}
