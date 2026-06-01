export type Storyboard = {
  id: string;
  name: string;
  pxPerSecond: number;
  rowWidthPx: number;
  laneCount: number;
  createdAt: number;
  updatedAt: number;
};

export type Shot = {
  id: string;
  storyboardId: string;
  order: number;
  title: string;
  description: string;
  durationSec: number;
  imageUrl: string | null;
};

export type AudioMarker = {
  id: string;
  storyboardId: string;
  lane: number;
  startSec: number;
  endSec: number;
  label: string;
  color: string;
};

export type StoryboardDetail = Storyboard & {
  shots: Shot[];
  audioMarkers: AudioMarker[];
};
