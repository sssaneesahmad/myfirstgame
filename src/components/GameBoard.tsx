import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BottleState, PourAnimationState } from '../game/types';
import { Bottle, BottlePourTransform } from './Bottle';
import { CentralArtwork } from './CentralArtwork';
import { PourStream, PourStreamGeometry } from './PourStream';

interface GameBoardProps {
  bottles: BottleState[];
  selectedIndex: number | null;
  invalidShakeIndex: number | null;
  hintMove: { fromIndex: number; toIndex: number } | null;
  pourAnim: PourAnimationState | null;
  colorblindSymbols: boolean;
  disabled: boolean;
  onSelectBottle: (index: number) => void;
}

interface ViewportSize {
  width: number;
  height: number;
}

function getRowDistribution(count: number, viewportWidth: number): number[] {
  if (count <= 4) return [count];
  if (count === 5) return viewportWidth >= 600 ? [5] : [3, 2];
  if (count === 6) return viewportWidth >= 680 ? [6] : [3, 3];
  if (count === 7) return [4, 3];
  if (count === 8) return [4, 4];
  if (count === 9) return [5, 4];
  if (count === 10) return [5, 5];
  if (count === 11) return [6, 5];
  if (count === 12) return [6, 6];
  const top = Math.ceil(count / 2);
  return [top, count - top];
}

export const GameBoard: React.FC<GameBoardProps> = ({
  bottles,
  selectedIndex,
  invalidShakeIndex,
  hintMove,
  pourAnim,
  colorblindSymbols,
  disabled,
  onSelectBottle,
}) => {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [viewport, setViewport] = useState<ViewportSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));
  const [pourTransform, setPourTransform] = useState<BottlePourTransform | null>(
    null
  );
  const [streamGeometry, setStreamGeometry] =
    useState<PourStreamGeometry | null>(null);

  useEffect(() => {
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const layout = useMemo(() => {
    const rows = getRowDistribution(bottles.length, viewport.width);
    const maxCols = Math.max(...rows);
    const rowCount = rows.length;

    // Reserve space for header (~72px) and bottom controls (~136px) and vertical padding
    const availableHeight = Math.max(260, viewport.height - 235);
    const availableWidth = Math.min(920, viewport.width - 24);

    const colGap = viewport.width < 400 ? 10 : viewport.width < 768 ? 16 : 24;
    const rowGap = viewport.height < 640 ? 14 : 24;

    const maxBottleWidthByCols = Math.floor(
      (availableWidth - colGap * (maxCols - 1)) / maxCols
    );
    const maxBottleHeightByRows = Math.floor(
      (availableHeight - rowGap * (rowCount - 1)) / rowCount
    );

    // Aspect ratio of bottle SVG is 92 / 224 (~0.4107)
    const widthFromHeight = Math.floor(maxBottleHeightByRows * 0.41);
    const maxCap = viewport.width >= 1024 ? 92 : viewport.width >= 768 ? 82 : 72;
    const bottleWidth = Math.max(
      42,
      Math.min(maxCap, maxBottleWidthByCols, widthFromHeight)
    );
    const bottleHeight = Math.round(bottleWidth / 0.4107);

    return {
      rows,
      bottleWidth,
      bottleHeight,
      colGap,
      rowGap,
    };
  }, [bottles.length, viewport.width, viewport.height]);

  // Calculate exact screen coordinates for the animated pour trajectory
  useEffect(() => {
    if (!pourAnim) {
      setPourTransform(null);
      setStreamGeometry(null);
      return;
    }

    const fromEl = bottleRefs.current[pourAnim.fromIndex];
    const toEl = bottleRefs.current[pourAnim.toIndex];
    if (!fromEl || !toEl) return;

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const fromCenterX = fromRect.left + fromRect.width / 2;
    const toCenterX = toRect.left + toRect.width / 2;

    // Tilt left if destination is to the left, or right if destination is to the right
    const pourRight = toCenterX >= fromCenterX;
    const tiltDeg = pourRight ? 52 : -52;

    // Offset so source bottle mouth hovers cleanly above destination mouth
    const mouthOffsetX = pourRight
      ? -toRect.width * 0.58
      : toRect.width * 0.58;
    const targetX = toCenterX + mouthOffsetX;
    const targetY = toRect.top - fromRect.height * 0.22;

    const tx = targetX - fromCenterX;
    const ty = targetY - fromRect.top;

    if (pourAnim.phase === 'lifting') {
      setPourTransform({ tx, ty, rotate: tiltDeg });
      setStreamGeometry(null);
    } else if (pourAnim.phase === 'pouring') {
      setPourTransform({ tx, ty, rotate: tiltDeg });

      // Compute mouth tip of tilted bottle in screen space
      const mouthX = toCenterX + (pourRight ? -6 : 6);
      const mouthY = toRect.top - 10;

      // Liquid target Y inside destination bottle
      const destBottle = bottles[pourAnim.toIndex];
      const fillRatio = Math.min(
        1,
        (destBottle ? destBottle.colors.length : 1) / 4
      );
      const destBottomY = toRect.bottom - 14;
      const destTopLiquidY =
        destBottomY - fillRatio * (toRect.height * 0.58);

      setStreamGeometry({
        startX: mouthX,
        startY: mouthY,
        endX: toCenterX,
        endY: destTopLiquidY,
        color: pourAnim.color,
      });
    } else if (pourAnim.phase === 'returning') {
      setStreamGeometry(null);
      setPourTransform(null);
    }
  }, [pourAnim, bottles]);

  // Build row slices
  const rowSlices = useMemo(() => {
    const slices: { bottle: BottleState; globalIndex: number }[][] = [];
    let cursor = 0;
    for (const rowLen of layout.rows) {
      const slice: { bottle: BottleState; globalIndex: number }[] = [];
      for (let i = 0; i < rowLen && cursor < bottles.length; i++) {
        slice.push({ bottle: bottles[cursor], globalIndex: cursor });
        cursor++;
      }
      slices.push(slice);
    }
    return slices;
  }, [bottles, layout.rows]);

  return (
    <main className="relative z-10 flex-1 w-full flex flex-col items-center justify-center px-3 py-2 overflow-visible min-h-0">
      {/* Decorative Fantasy Lotus Centerpiece Behind Bottles */}
      <CentralArtwork />

      {/* Balanced Responsive Bottle Rows */}
      <div
        className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl"
        style={{ gap: `${layout.rowGap}px` }}
      >
        {rowSlices.map((row, rIdx) => (
          <div
            key={`row-${rIdx}`}
            className="flex items-end justify-center"
            style={{ gap: `${layout.colGap}px` }}
          >
            {row.map(({ bottle, globalIndex }) => {
              const isSource = pourAnim?.fromIndex === globalIndex;
              const hintRole =
                hintMove?.fromIndex === globalIndex
                  ? 'source'
                  : hintMove?.toIndex === globalIndex
                    ? 'dest'
                    : null;

              return (
                <Bottle
                  key={bottle.id}
                  bottle={bottle}
                  index={globalIndex}
                  width={layout.bottleWidth}
                  height={layout.bottleHeight}
                  selected={selectedIndex === globalIndex}
                  isInvalidShake={invalidShakeIndex === globalIndex}
                  hintRole={hintRole}
                  pourTransform={isSource ? pourTransform : null}
                  colorblindSymbols={colorblindSymbols}
                  disabled={disabled}
                  onSelect={onSelectBottle}
                  bottleRef={(el) => {
                    bottleRefs.current[globalIndex] = el;
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Liquid Pouring Stream Overlay */}
      <PourStream stream={streamGeometry} />
    </main>
  );
};
