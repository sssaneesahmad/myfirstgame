import React from 'react';
import { Lightbulb, Plus, RotateCcw, Undo2 } from 'lucide-react';
import { EXTRA_BOTTLE_COST, HINT_COST } from '../game/types';

interface GameControlsProps {
  canUndo: boolean;
  undoCount: number;
  canAddBottle: boolean;
  extraBottlesAdded: number;
  coins: number;
  disabled: boolean;
  onRestart: () => void;
  onUndo: () => void;
  onAddBottle: () => void;
  onHint: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  canUndo,
  undoCount,
  canAddBottle,
  extraBottlesAdded,
  coins,
  disabled,
  onRestart,
  onUndo,
  onAddBottle,
  onHint,
}) => {
  const canAffordExtra = coins >= EXTRA_BOTTLE_COST;
  const canAffordHint = coins >= HINT_COST;

  return (
    <footer className="relative z-20 w-full max-w-xl mx-auto px-3 sm:px-6 safe-pb pb-3 pt-2 flex flex-col items-center gap-2.5">
      {/* Primary Trio Control Bar: Restart / Undo / Add Bottle + Hint */}
      <div className="flex items-center justify-center gap-3 sm:gap-5 w-full">
        {/* Restart Button */}
        <button
          type="button"
          onClick={onRestart}
          disabled={disabled}
          aria-label="Restart level"
          title="Restart level (R)"
          className="group relative flex flex-col items-center justify-center w-16 h-14 sm:w-20 sm:h-16 rounded-2xl bg-gradient-to-b from-[#2DA3FF] via-[#087BFF] to-[#054EC2] border border-[#8EDBFF]/65 shadow-[0_8px_22px_rgba(8,123,255,0.45),inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-110 hover:shadow-[0_0_26px_rgba(39,217,255,0.65)] active:translate-y-0.5 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#27D9FF]"
        >
          <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7 text-[#F3F8FF] drop-shadow-sm" />
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#E8F6FF] mt-0.5 whitespace-nowrap">
            Restart
          </span>
        </button>

        {/* Undo Button */}
        <button
          type="button"
          onClick={onUndo}
          disabled={disabled || !canUndo}
          aria-label={`Undo last move (${undoCount} available)`}
          title="Undo move (Z)"
          className="group relative flex flex-col items-center justify-center w-16 h-14 sm:w-20 sm:h-16 rounded-2xl bg-gradient-to-b from-[#2DA3FF] via-[#087BFF] to-[#054EC2] border border-[#8EDBFF]/65 shadow-[0_8px_22px_rgba(8,123,255,0.45),inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-110 hover:shadow-[0_0_26px_rgba(39,217,255,0.65)] active:translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#27D9FF]"
        >
          <Undo2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#F3F8FF] drop-shadow-sm" />
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#E8F6FF] mt-0.5 whitespace-nowrap">
            Undo
          </span>
          {undoCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full bg-[#27D9FF] text-[#050A2D] font-mono-nums text-[11px] font-bold shadow-[0_2px_8px_rgba(39,217,255,0.75)]">
              {undoCount}
            </span>
          )}
        </button>

        {/* Add Bottle Button */}
        <button
          type="button"
          onClick={onAddBottle}
          disabled={disabled || !canAddBottle || !canAffordExtra}
          aria-label={`Add extra empty bottle for ${EXTRA_BOTTLE_COST} coins`}
          title={
            !canAddBottle
              ? 'Maximum extra bottles added'
              : !canAffordExtra
                ? `Need ${EXTRA_BOTTLE_COST} coins`
                : `Add extra bottle (${EXTRA_BOTTLE_COST} coins)`
          }
          className="group relative flex flex-col items-center justify-center w-16 h-14 sm:w-20 sm:h-16 rounded-2xl bg-gradient-to-b from-[#2DA3FF] via-[#087BFF] to-[#054EC2] border border-[#8EDBFF]/65 shadow-[0_8px_22px_rgba(8,123,255,0.45),inset_0_2px_0_rgba(255,255,255,0.45)] hover:brightness-110 hover:shadow-[0_0_26px_rgba(39,217,255,0.65)] active:translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#27D9FF]"
        >
          <div className="relative flex items-center justify-center">
            {/* Custom Mini Bottle + Plus Icon */}
            <svg
              viewBox="0 0 28 28"
              fill="none"
              className="w-6 h-6 sm:w-7 sm:h-7 text-[#F3F8FF]"
              aria-hidden="true"
            >
              <path
                d="M11 3H17V7.2C17 8.4 19.5 9.8 19.5 12.2V22.2C19.5 23.8 18 25 14 25C10 25 8.5 23.8 8.5 22.2V12.2C8.5 9.8 11 8.4 11 7.2V3Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M10 3H18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <Plus className="w-3.5 h-3.5 text-[#A7EEFF] stroke-[3] -ml-1 -mt-3" />
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#E8F6FF] mt-0.5 whitespace-nowrap">
            + Bottle
          </span>

          <span
            className={`absolute -top-2 -right-2 px-1.5 h-[22px] flex items-center justify-center rounded-full font-mono-nums text-[10px] font-bold shadow-md ${
              canAddBottle && canAffordExtra
                ? 'bg-[#FFD32F] text-[#050A2D]'
                : 'bg-[#18255E] text-[#A7EEFF]/70 border border-[#A7EEFF]/25'
            }`}
          >
            {extraBottlesAdded >= 2 ? 'MAX' : `${EXTRA_BOTTLE_COST}c`}
          </span>
        </button>

        {/* Hint Button */}
        <button
          type="button"
          onClick={onHint}
          disabled={disabled || !canAffordHint}
          aria-label={`Show smart move hint for ${HINT_COST} coins`}
          title={`Hint (${HINT_COST} coins, press H)`}
          className="group relative flex flex-col items-center justify-center w-16 h-14 sm:w-20 sm:h-16 rounded-2xl bg-gradient-to-b from-[#1F4CB8] via-[#132E82] to-[#0C1D5A] border border-[#6ACFFF]/45 shadow-[0_6px_18px_rgba(8,123,255,0.3),inset_0_1.5px_0_rgba(167,238,255,0.3)] hover:brightness-115 hover:border-[#27D9FF]/80 active:translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#27D9FF]"
        >
          <Lightbulb className="w-6 h-6 sm:w-7 sm:h-7 text-[#FFD32F] drop-shadow-sm" />
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#E8F6FF] mt-0.5 whitespace-nowrap">
            Hint
          </span>
          <span
            className={`absolute -top-2 -right-2 px-1.5 h-[22px] flex items-center justify-center rounded-full font-mono-nums text-[10px] font-bold shadow-md ${
              canAffordHint
                ? 'bg-[#FFD32F] text-[#050A2D]'
                : 'bg-[#18255E] text-[#A7EEFF]/70 border border-[#A7EEFF]/25'
            }`}
          >
            {HINT_COST}c
          </span>
        </button>
      </div>
    </footer>
  );
};
