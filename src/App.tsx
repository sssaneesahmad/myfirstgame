import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdSlot } from './components/AdSlot';
import { GameBoard } from './components/GameBoard';
import { GameControls } from './components/GameControls';
import { GameHeader } from './components/GameHeader';
import { HowToPlayModal } from './components/HowToPlayModal';
import { LandingScreen } from './components/LandingScreen';
import { LevelSelectModal } from './components/LevelSelectModal';
import { ParticleBackground } from './components/ParticleBackground';
import { RewardModal } from './components/RewardModal';
import { SettingsModal } from './components/SettingsModal';
import { WinModal } from './components/WinModal';
import {
  addExtraBottle,
  calculatePourAmount,
  checkWinCondition,
  findHintMove,
  generateLevel,
  isBottleCompleted,
  levelConfigToBottleStates,
  performPour,
  undoMove,
  validateMove,
} from './game/engine';
import {
  BottleState,
  DAILY_REWARD_COINS,
  EXTRA_BOTTLE_COST,
  GameSettings,
  HINT_COST,
  LEVEL_REWARD_COINS,
  MoveRecord,
  PlayerProgress,
  PourAnimationState,
  STREAK_BONUS_COINS,
} from './game/types';
import { soundEngine, triggerVibration } from './utils/sound';
import {
  clearBoardState,
  DEFAULT_PROGRESS,
  getTodayDateString,
  loadBoardState,
  loadProgress,
  loadSettings,
  resetAllStorage,
  saveBoardState,
  saveProgress,
  saveSettings,
} from './utils/storage';

type ActiveModal = 'none' | 'settings' | 'howto' | 'rewards' | 'levels';

interface WinSummary {
  levelCompleted: number;
  moves: number;
  coinsEarned: number;
  streakBonus: number;
}

export default function App() {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [winSummary, setWinSummary] = useState<WinSummary | null>(null);

  const [bottles, setBottles] = useState<BottleState[]>(() => {
    const saved = loadBoardState(progress.currentLevel);
    if (saved) return saved.bottles;
    return levelConfigToBottleStates(generateLevel(progress.currentLevel));
  });

  const [history, setHistory] = useState<MoveRecord[]>(() => {
    const saved = loadBoardState(progress.currentLevel);
    return saved ? saved.history : [];
  });

  const [moves, setMoves] = useState<number>(() => {
    const saved = loadBoardState(progress.currentLevel);
    return saved ? saved.moves : 0;
  });

  const [extraBottlesAdded, setExtraBottlesAdded] = useState<number>(() => {
    const saved = loadBoardState(progress.currentLevel);
    return saved ? saved.extraBottlesAdded : 0;
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [invalidShakeIndex, setInvalidShakeIndex] = useState<number | null>(null);
  const [hintMove, setHintMove] = useState<{
    fromIndex: number;
    toIndex: number;
  } | null>(null);
  const [pourAnim, setPourAnim] = useState<PourAnimationState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  const clearAnimTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  // Sync audio preferences
  useEffect(() => {
    soundEngine.setSoundEnabled(settings.soundEnabled);
    soundEngine.setMusicEnabled(settings.musicEnabled);
    saveSettings(settings);
  }, [settings]);

  // Persist player progress
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Persist active board state (unless won)
  useEffect(() => {
    if (!winSummary) {
      saveBoardState({
        levelNumber: progress.currentLevel,
        bottles,
        history,
        moves,
        extraBottlesAdded,
      });
    }
  }, [progress.currentLevel, bottles, history, moves, extraBottlesAdded, winSummary]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearAnimTimers();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      soundEngine.stopAmbientMusic();
    };
  }, [clearAnimTimers]);

  const canClaimDaily = useMemo(() => {
    const today = getTodayDateString();
    return progress.lastDailyRewardDate !== today;
  }, [progress.lastDailyRewardDate]);

  const loadFreshLevel = useCallback(
    (levelNum: number) => {
      clearAnimTimers();
      setPourAnim(null);
      setSelectedIndex(null);
      setHintMove(null);
      setWinSummary(null);
      const config = generateLevel(levelNum);
      setBottles(levelConfigToBottleStates(config));
      setHistory([]);
      setMoves(0);
      setExtraBottlesAdded(0);
    },
    [clearAnimTimers]
  );

  const handleSelectBottle = useCallback(
    (index: number) => {
      soundEngine.unlockAudio();
      if (pourAnim !== null || winSummary !== null) return;

      setHintMove(null);

      // Nothing selected yet -> pick source
      if (selectedIndex === null) {
        const target = bottles[index];
        if (!target || target.colors.length === 0) {
          soundEngine.playInvalid();
          setInvalidShakeIndex(index);
          const t = window.setTimeout(() => setInvalidShakeIndex(null), 340);
          timersRef.current.push(t);
          return;
        }
        soundEngine.playSelect();
        triggerVibration(settings.vibrationEnabled, 10);
        setSelectedIndex(index);
        return;
      }

      // Clicking the same bottle deselects it
      if (selectedIndex === index) {
        soundEngine.playDeselect();
        setSelectedIndex(null);
        return;
      }

      // Attempt pour from selectedIndex -> index
      if (!validateMove(bottles, selectedIndex, index)) {
        soundEngine.playInvalid();
        triggerVibration(settings.vibrationEnabled, [18, 28, 18]);
        setInvalidShakeIndex(index);
        setSelectedIndex(null);
        const t = window.setTimeout(() => setInvalidShakeIndex(null), 340);
        timersRef.current.push(t);
        return;
      }

      const amount = calculatePourAmount(bottles, selectedIndex, index);
      const poured = performPour(bottles, selectedIndex, index);
      if (!poured || amount <= 0) return;

      const fromIdx = selectedIndex;
      const toIdx = index;
      const color = poured.move.color;

      setSelectedIndex(null);
      setPourAnim({
        fromIndex: fromIdx,
        toIndex: toIdx,
        color,
        count: amount,
        phase: 'lifting',
      });

      const t1 = window.setTimeout(() => {
        setPourAnim((prev) => (prev ? { ...prev, phase: 'pouring' } : null));
        soundEngine.playPour(amount);
        triggerVibration(settings.vibrationEnabled, 16);
      }, 200);

      const t2 = window.setTimeout(() => {
        setBottles(poured.bottles);
        setHistory((prev) => [...prev, poured.move]);
        setMoves((prev) => prev + 1);

        const destCompleted = isBottleCompleted(poured.bottles[toIdx]);
        if (destCompleted) {
          soundEngine.playBottleComplete();
        }
      }, 280);

      const t3 = window.setTimeout(() => {
        setPourAnim((prev) =>
          prev ? { ...prev, phase: 'returning' } : null
        );
      }, 460);

      const t4 = window.setTimeout(() => {
        setPourAnim(null);

        if (checkWinCondition(poured.bottles)) {
          const nextStreak = progress.streakCount + 1;
          const streakBonus = nextStreak % 3 === 0 ? STREAK_BONUS_COINS : 0;
          const earned = LEVEL_REWARD_COINS + streakBonus;
          const completedLvl = progress.currentLevel;
          const totalMovesForLevel = moves + 1;

          soundEngine.playWin();
          triggerVibration(settings.vibrationEnabled, [25, 40, 45]);
          clearBoardState();

          setProgress((prev) => ({
            ...prev,
            coins: prev.coins + earned,
            highestUnlockedLevel: Math.max(
              prev.highestUnlockedLevel,
              completedLvl + 1
            ),
            completedLevels: prev.completedLevels.includes(completedLvl)
              ? prev.completedLevels
              : [...prev.completedLevels, completedLvl],
            totalMoves: prev.totalMoves + totalMovesForLevel,
            streakCount: nextStreak,
          }));

          setWinSummary({
            levelCompleted: completedLvl,
            moves: totalMovesForLevel,
            coinsEarned: earned,
            streakBonus,
          });
        }
      }, 650);

      timersRef.current.push(t1, t2, t3, t4);
    },
    [
      bottles,
      moves,
      pourAnim,
      progress.currentLevel,
      progress.streakCount,
      selectedIndex,
      settings.vibrationEnabled,
      winSummary,
    ]
  );

  const handleRestart = useCallback(() => {
    soundEngine.unlockAudio();
    if (pourAnim !== null) return;
    soundEngine.playButtonClick();
    triggerVibration(settings.vibrationEnabled, 12);
    loadFreshLevel(progress.currentLevel);
  }, [loadFreshLevel, pourAnim, progress.currentLevel, settings.vibrationEnabled]);

  const handleUndo = useCallback(() => {
    soundEngine.unlockAudio();
    if (pourAnim !== null || history.length === 0) return;
    const result = undoMove(bottles, history);
    if (!result) return;

    soundEngine.playButtonClick();
    triggerVibration(settings.vibrationEnabled, 10);
    setSelectedIndex(null);
    setHintMove(null);
    setBottles(result.bottles);
    setHistory(result.history);
    setMoves((m) => Math.max(0, m - 1));
  }, [bottles, history, pourAnim, settings.vibrationEnabled]);

  const handleAddBottle = useCallback(() => {
    soundEngine.unlockAudio();
    if (pourAnim !== null || extraBottlesAdded >= 2) return;
    if (progress.coins < EXTRA_BOTTLE_COST) {
      soundEngine.playInvalid();
      showToast(`Need ${EXTRA_BOTTLE_COST} coins to add a bottle`);
      return;
    }

    soundEngine.playCoin();
    triggerVibration(settings.vibrationEnabled, 16);
    setSelectedIndex(null);
    setHintMove(null);
    setBottles((prev) => addExtraBottle(prev));
    setExtraBottlesAdded((prev) => prev + 1);
    setProgress((prev) => ({
      ...prev,
      coins: prev.coins - EXTRA_BOTTLE_COST,
    }));
  }, [
    extraBottlesAdded,
    pourAnim,
    progress.coins,
    settings.vibrationEnabled,
    showToast,
  ]);

  const handleHint = useCallback(() => {
    soundEngine.unlockAudio();
    if (pourAnim !== null || winSummary !== null) return;
    if (progress.coins < HINT_COST) {
      soundEngine.playInvalid();
      showToast(`Need ${HINT_COST} coins for a hint`);
      return;
    }

    const suggestion = findHintMove(bottles);
    if (!suggestion) {
      soundEngine.playInvalid();
      showToast('No moves available — try Undo or + Bottle');
      return;
    }

    soundEngine.playSelect();
    triggerVibration(settings.vibrationEnabled, 12);
    setSelectedIndex(null);
    setHintMove(suggestion);
    setProgress((prev) => ({
      ...prev,
      coins: prev.coins - HINT_COST,
    }));

    const t = window.setTimeout(() => setHintMove(null), 3500);
    timersRef.current.push(t);
  }, [
    bottles,
    pourAnim,
    progress.coins,
    settings.vibrationEnabled,
    showToast,
    winSummary,
  ]);

  const handleNextLevel = useCallback(() => {
    soundEngine.playButtonClick();
    const nextLvl = progress.currentLevel + 1;
    setProgress((prev) => ({
      ...prev,
      currentLevel: nextLvl,
      highestUnlockedLevel: Math.max(prev.highestUnlockedLevel, nextLvl),
    }));
    loadFreshLevel(nextLvl);
  }, [loadFreshLevel, progress.currentLevel]);

  const handleReplayFromWin = useCallback(() => {
    soundEngine.playButtonClick();
    loadFreshLevel(progress.currentLevel);
  }, [loadFreshLevel, progress.currentLevel]);

  const handleSelectLevel = useCallback(
    (levelNum: number) => {
      soundEngine.playButtonClick();
      setActiveModal('none');
      setProgress((prev) => ({
        ...prev,
        currentLevel: levelNum,
      }));
      loadFreshLevel(levelNum);
    },
    [loadFreshLevel]
  );

  const handleClaimDaily = useCallback(() => {
    if (!canClaimDaily) return;
    soundEngine.playCoin();
    triggerVibration(settings.vibrationEnabled, 20);
    const today = getTodayDateString();
    setProgress((prev) => ({
      ...prev,
      coins: prev.coins + DAILY_REWARD_COINS,
      lastDailyRewardDate: today,
    }));
    showToast(`Daily gift claimed: +${DAILY_REWARD_COINS} coins!`);
  }, [canClaimDaily, settings.vibrationEnabled, showToast]);

  const handleResetProgress = useCallback(() => {
    soundEngine.playButtonClick();
    resetAllStorage();
    setProgress({ ...DEFAULT_PROGRESS });
    setActiveModal('none');
    loadFreshLevel(1);
    showToast('Progress reset to Level 1');
  }, [loadFreshLevel, showToast]);

  // Desktop keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showLanding) {
        if (e.key === 'Enter' && activeModal === 'none') {
          setShowLanding(false);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (activeModal !== 'none') {
          setActiveModal('none');
        } else if (selectedIndex !== null) {
          setSelectedIndex(null);
        }
        return;
      }

      if (activeModal !== 'none' || winSummary !== null || pourAnim !== null) {
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (idx < bottles.length) handleSelectBottle(idx);
      } else if (e.key === '0') {
        if (9 < bottles.length) handleSelectBottle(9);
      } else if (e.key.toLowerCase() === 'r') {
        handleRestart();
      } else if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'u') {
        handleUndo();
      } else if (e.key.toLowerCase() === 'h') {
        handleHint();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeModal,
    bottles.length,
    handleHint,
    handleRestart,
    handleSelectBottle,
    handleUndo,
    pourAnim,
    selectedIndex,
    showLanding,
    winSummary,
  ]);

  return (
    <div className="relative w-full h-[100dvh] flex flex-col overflow-hidden bg-[#050A2D] text-[#F3F8FF]">
      <ParticleBackground />

      {showLanding ? (
        <LandingScreen
          currentLevel={progress.currentLevel}
          coins={progress.coins}
          completedCount={progress.completedLevels.length}
          onPlay={() => {
            soundEngine.unlockAudio();
            soundEngine.playButtonClick();
            setShowLanding(false);
          }}
          onHowToPlay={() => {
            soundEngine.unlockAudio();
            soundEngine.playButtonClick();
            setActiveModal('howto');
          }}
        />
      ) : (
        <>
          <GameHeader
            levelNumber={progress.currentLevel}
            moves={moves}
            coins={progress.coins}
            canClaimDaily={canClaimDaily}
            onOpenSettings={() => {
              soundEngine.unlockAudio();
              soundEngine.playButtonClick();
              setActiveModal('settings');
            }}
            onOpenRewards={() => {
              soundEngine.unlockAudio();
              soundEngine.playButtonClick();
              setActiveModal('rewards');
            }}
            onOpenLevels={() => {
              soundEngine.unlockAudio();
              soundEngine.playButtonClick();
              setActiveModal('levels');
            }}
          />

          {/* Non-intrusive Transient Toast Feedback */}
          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-[#12226B]/95 border border-[#27D9FF]/50 shadow-[0_8px_24px_rgba(0,0,0,0.45)] text-xs sm:text-sm font-semibold text-[#F3F8FF] whitespace-nowrap"
            >
              {toastMessage}
            </div>
          )}

          <GameBoard
            bottles={bottles}
            selectedIndex={selectedIndex}
            invalidShakeIndex={invalidShakeIndex}
            hintMove={hintMove}
            pourAnim={pourAnim}
            colorblindSymbols={settings.colorblindSymbols}
            disabled={pourAnim !== null || winSummary !== null}
            onSelectBottle={handleSelectBottle}
          />

          <GameControls
            canUndo={history.length > 0}
            undoCount={history.length}
            canAddBottle={extraBottlesAdded < 2}
            extraBottlesAdded={extraBottlesAdded}
            coins={progress.coins}
            disabled={pourAnim !== null || winSummary !== null}
            onRestart={handleRestart}
            onUndo={handleUndo}
            onAddBottle={handleAddBottle}
            onHint={handleHint}
          />

          <AdSlot enabled={false} />
        </>
      )}

      {/* Win Celebration Modal */}
      {winSummary && (
        <WinModal
          levelCompleted={winSummary.levelCompleted}
          moves={winSummary.moves}
          coinsEarned={winSummary.coinsEarned}
          streakBonus={winSummary.streakBonus}
          onNextLevel={handleNextLevel}
          onReplay={handleReplayFromWin}
        />
      )}

      {/* Settings Modal */}
      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={(next) => {
            soundEngine.playButtonClick();
            setSettings(next);
          }}
          onOpenHowToPlay={() => {
            soundEngine.playButtonClick();
            setActiveModal('howto');
          }}
          onResetProgress={handleResetProgress}
          onClose={() => {
            soundEngine.playButtonClick();
            setActiveModal('none');
          }}
        />
      )}

      {/* How To Play Modal */}
      {activeModal === 'howto' && (
        <HowToPlayModal
          onClose={() => {
            soundEngine.playButtonClick();
            setActiveModal('none');
          }}
        />
      )}

      {/* Rewards Modal */}
      {activeModal === 'rewards' && (
        <RewardModal
          coins={progress.coins}
          streakCount={progress.streakCount}
          canClaimDaily={canClaimDaily}
          onClaimDaily={handleClaimDaily}
          onClose={() => {
            soundEngine.playButtonClick();
            setActiveModal('none');
          }}
        />
      )}

      {/* Level Select Modal */}
      {activeModal === 'levels' && (
        <LevelSelectModal
          currentLevel={progress.currentLevel}
          highestUnlockedLevel={progress.highestUnlockedLevel}
          completedLevels={progress.completedLevels}
          onSelectLevel={handleSelectLevel}
          onClose={() => {
            soundEngine.playButtonClick();
            setActiveModal('none');
          }}
        />
      )}
    </div>
  );
}
