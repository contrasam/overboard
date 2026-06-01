import { useRef } from 'react';
import type { AudioSegment } from '../layout';

type Props = {
  segment: AudioSegment;
  active?: boolean;
  pxPerSecond: number;
  onClick: () => void;
  onDrag: (deltaSec: number) => void;
  onResizeLeft: (deltaSec: number) => void;
  onResizeRight: (deltaSec: number) => void;
  onCommit: () => void;
};

export default function AudioBarView(props: Props) {
  const { segment, active, pxPerSecond, onClick, onDrag, onResizeLeft, onResizeRight, onCommit } = props;
  const startXRef = useRef(0);

  const beginDrag = (
    e: React.PointerEvent,
    handler: (deltaSec: number) => void,
  ) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    let moved = false;
    const move = (ev: PointerEvent) => {
      moved = true;
      const dx = ev.clientX - startXRef.current;
      handler(dx / pxPerSecond);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) onCommit();
      else onClick();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const cls = [
    'audio-bar',
    active ? 'active' : '',
    segment.continuesLeft ? 'continues-left' : '',
    segment.continuesRight ? 'continues-right' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{
        left: segment.xPx,
        width: segment.widthPx,
        background: segment.marker.color,
      }}
      onPointerDown={(e) => beginDrag(e, onDrag)}
    >
      {!segment.continuesLeft && (
        <div className="handle left" onPointerDown={(e) => beginDrag(e, onResizeLeft)} />
      )}
      <span style={{ paddingLeft: 8, paddingRight: 8, pointerEvents: 'none' }}>
        {segment.marker.label || 'audio'}
      </span>
      {!segment.continuesRight && (
        <div className="handle right" onPointerDown={(e) => beginDrag(e, onResizeRight)} />
      )}
    </div>
  );
}
