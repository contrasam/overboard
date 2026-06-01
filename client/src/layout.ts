import type { Shot, AudioMarker } from './types';

export type RowShot = {
  shot: Shot;
  xPx: number;
  widthPx: number;
  startSec: number;
  endSec: number;
};

export type RowLayout = {
  index: number;
  startSec: number;
  endSec: number;
  widthPx: number;
  shots: RowShot[];
};

const MIN_SHOT_PX = 60;

export function layoutRows(shots: Shot[], pxPerSecond: number, rowWidthPx: number): RowLayout[] {
  const rows: RowLayout[] = [];
  let runningSec = 0;
  let rowWidthUsed = 0;
  let cur: RowLayout = { index: 0, startSec: 0, endSec: 0, widthPx: 0, shots: [] };
  rows.push(cur);

  for (const shot of shots) {
    const wPx = Math.max(MIN_SHOT_PX, shot.durationSec * pxPerSecond);
    if (cur.shots.length > 0 && rowWidthUsed + wPx > rowWidthPx) {
      cur.widthPx = rowWidthUsed;
      cur = { index: rows.length, startSec: runningSec, endSec: runningSec, widthPx: 0, shots: [] };
      rows.push(cur);
      rowWidthUsed = 0;
    }
    if (cur.shots.length === 0) cur.startSec = runningSec;
    cur.shots.push({
      shot, xPx: rowWidthUsed, widthPx: wPx,
      startSec: runningSec, endSec: runningSec + shot.durationSec,
    });
    rowWidthUsed += wPx;
    runningSec += shot.durationSec;
    cur.endSec = runningSec;
    cur.widthPx = rowWidthUsed;
  }
  return rows;
}

export function totalDuration(shots: Shot[]): number {
  return shots.reduce((s, x) => s + x.durationSec, 0);
}

/**
 * Convert a time range (sec) within a single row into x/width pixel coords.
 * Accounts for variable shot widths when MIN_SHOT_PX > duration*pxPerSecond,
 * so audio bars line up with shot edges even for very short shots.
 */
export function rowSecToX(row: RowLayout, sec: number): number {
  if (row.shots.length === 0) return 0;
  // Clamp to row range.
  if (sec <= row.startSec) return 0;
  if (sec >= row.endSec) return row.widthPx;
  // Find shot containing this sec.
  for (const s of row.shots) {
    if (sec >= s.startSec && sec <= s.endSec) {
      const tFrac = (sec - s.startSec) / Math.max(1e-6, s.endSec - s.startSec);
      return s.xPx + tFrac * s.widthPx;
    }
  }
  return row.widthPx;
}

export function xToRowSec(row: RowLayout, x: number): number {
  if (row.shots.length === 0) return row.startSec;
  if (x <= 0) return row.startSec;
  if (x >= row.widthPx) return row.endSec;
  for (const s of row.shots) {
    if (x >= s.xPx && x <= s.xPx + s.widthPx) {
      const tFrac = (x - s.xPx) / Math.max(1e-6, s.widthPx);
      return s.startSec + tFrac * (s.endSec - s.startSec);
    }
  }
  return row.endSec;
}

export type AudioSegment = {
  marker: AudioMarker;
  rowIndex: number;
  xPx: number;
  widthPx: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

export function audioSegments(rows: RowLayout[], markers: AudioMarker[]): AudioSegment[] {
  const out: AudioSegment[] = [];
  for (const marker of markers) {
    for (const row of rows) {
      if (marker.endSec <= row.startSec || marker.startSec >= row.endSec) continue;
      const segStart = Math.max(marker.startSec, row.startSec);
      const segEnd = Math.min(marker.endSec, row.endSec);
      const x1 = rowSecToX(row, segStart);
      const x2 = rowSecToX(row, segEnd);
      out.push({
        marker,
        rowIndex: row.index,
        xPx: x1,
        widthPx: Math.max(4, x2 - x1),
        continuesLeft: marker.startSec < row.startSec,
        continuesRight: marker.endSec > row.endSec,
      });
    }
  }
  return out;
}
