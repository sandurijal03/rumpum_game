import * as React from "react";

import "./Main.css";
import rumpumChickenSrc from "./Rumpum Chicken.png";
import rumpumRamailoSrc from "./rumpum_ramailo.png";
import rumpumVegSrc from "./rumpum veg.png";
import winMusicSrc from "./win-music.mp4";

type DrawHistoryItem = {
  code: string;
  title: string;
  time: string;
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const DEFAULT_REEL_COUNT = 7;
const MAX_REEL_COUNT = 10;
const MAX_DRAW_NUMBER = 9999999999;
const BULB_COUNT = 14;

const Main: React.FC = () => {
  const [midDigits, setMidDigits] = React.useState<string[]>(
    Array(DEFAULT_REEL_COUNT).fill("0"),
  );
  const [winNumber, setWinNumber] = React.useState<string>(
    "0".padStart(DEFAULT_REEL_COUNT, "0"),
  );
  const [winMeta, setWinMeta] = React.useState<string>(
    "Draw #0  |  No draw yet",
  );
  const [status, setStatus] = React.useState<string>(
    "Set your range below and press SPIN DRAW",
  );
  const [history, setHistory] = React.useState<DrawHistoryItem[]>([]);
  const [excludedCount, setExcludedCount] = React.useState<number>(0);
  const [isSpinning, setIsSpinning] = React.useState<boolean>(false);
  const [showStopMusic, setShowStopMusic] = React.useState<boolean>(false);
  const [celebrating, setCelebrating] = React.useState<boolean>(false);
  const [winColor, setWinColor] = React.useState<string>("#ffff00");
  const [floatingWinner, setFloatingWinner] = React.useState<string>("");

  const [minVal, setMinVal] = React.useState<string>("1");
  const [maxVal, setMaxVal] = React.useState<string>("9999999");
  const [eventTitle, setEventTitle] = React.useState<string>(
    "RUMPUM LUCKY DRAW 2082",
  );
  const [spinSpeed, setSpinSpeed] = React.useState<string>("80");
  const [winnerFloatDurationMs, setWinnerFloatDurationMs] =
    React.useState<string>("3200");

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const winMusicRef = React.useRef<HTMLAudioElement | null>(null);
  const excludedRef = React.useRef<Set<number>>(new Set());
  const drawCountRef = React.useRef<number>(0);
  const intervalIdsRef = React.useRef<Set<number>>(new Set());
  const timeoutIdsRef = React.useRef<Set<number>>(new Set());
  const unmountedRef = React.useRef<boolean>(false);

  const addInterval = (id: number): void => {
    intervalIdsRef.current.add(id);
  };

  const clearTrackedInterval = (id: number): void => {
    window.clearInterval(id);
    intervalIdsRef.current.delete(id);
  };

  const addTimeout = (id: number): void => {
    timeoutIdsRef.current.add(id);
  };

  const clearTrackedTimeout = (id: number): void => {
    window.clearTimeout(id);
    timeoutIdsRef.current.delete(id);
  };

  React.useEffect(() => {
    unmountedRef.current = false;

    return () => {
      unmountedRef.current = true;
      intervalIdsRef.current.forEach((id) => {
        window.clearInterval(id);
      });
      timeoutIdsRef.current.forEach((id) => {
        window.clearTimeout(id);
      });
      intervalIdsRef.current.clear();
      timeoutIdsRef.current.clear();

      if (winMusicRef.current) {
        winMusicRef.current.pause();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          return;
        });
      }
    };
  }, []);

  const getRange = React.useCallback((): { min: number; max: number } => {
    const min = Math.max(0, Number.parseInt(minVal, 10) || 0);
    const max = Math.min(
      MAX_DRAW_NUMBER,
      Number.parseInt(maxVal, 10) || MAX_DRAW_NUMBER,
    );
    return { min, max };
  }, [maxVal, minVal]);

  const reelCount = React.useMemo(() => {
    const { max } = getRange();
    return Math.min(MAX_REEL_COUNT, Math.max(1, String(max).length));
  }, [getRange]);

  const normalizeToDigits = React.useCallback(
    (value: string, targetCount: number = reelCount): string => {
      const safe = value.replace(/\D/g, "") || "0";
      return safe.padStart(targetCount, "0").slice(-targetCount);
    },
    [reelCount],
  );

  const winnerFloatDuration = React.useMemo(() => {
    const parsed = Number.parseInt(winnerFloatDurationMs, 10);
    if (Number.isNaN(parsed)) {
      return 3200;
    }
    return Math.min(12000, Math.max(1000, parsed));
  }, [winnerFloatDurationMs]);

  React.useEffect(() => {
    setMidDigits((previousDigits) => {
      if (previousDigits.length === reelCount) {
        return previousDigits;
      }
      return normalizeToDigits(previousDigits.join(""), reelCount).split("");
    });
  }, [normalizeToDigits, reelCount]);

  const remainingText = React.useMemo(() => {
    const { min, max } = getRange();
    const total = max - min + 1;
    let excludedInRange = 0;
    excludedRef.current.forEach((value) => {
      if (value >= min && value <= max) {
        excludedInRange += 1;
      }
    });
    const available = total - excludedInRange;
    return `Range: ${min.toLocaleString()} to ${max.toLocaleString()} | Available: ${Math.max(0, available).toLocaleString()} numbers`;
  }, [excludedCount, getRange]);

  const getAudioContext = React.useCallback((): AudioContext | null => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioContextRef.current = new AudioCtx();
    return audioContextRef.current;
  }, []);

  const playClick = React.useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 0.04,
      audioContext.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 8);
    }

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.18, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.04,
    );
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  }, [getAudioContext]);

  const playReelStop = React.useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(320, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      80,
      audioContext.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(0.22, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.14,
    );
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.14);
  }, [getAudioContext]);

  const playWinMusic = React.useCallback(() => {
    const winMusic = winMusicRef.current;
    if (!winMusic) {
      return;
    }
    winMusic.currentTime = 0;
    winMusic.volume = 1.0;
    winMusic.play().catch((error) => {
      // eslint-disable-next-line no-console
      console.log("Audio play error:", error);
    });
    setShowStopMusic(true);
  }, []);

  const stopWinMusic = React.useCallback(() => {
    const winMusic = winMusicRef.current;
    if (!winMusic) {
      return;
    }
    winMusic.pause();
    winMusic.currentTime = 0;
    setShowStopMusic(false);
  }, []);

  const handleMaxValueChange = React.useCallback((rawValue: string): void => {
    if (rawValue === "") {
      setMaxVal("");
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setStatus("⚠ Please enter a valid maximum number.");
      return;
    }

    const normalized = Math.max(0, Math.floor(parsed));
    if (normalized > MAX_DRAW_NUMBER) {
      setMaxVal(String(MAX_DRAW_NUMBER));
      setStatus("⚠ Maximum number is limited to 10 digits (9,999,999,999).");
      return;
    }

    setMaxVal(String(normalized));
  }, []);

  const handleWinnerFloatDurationChange = React.useCallback(
    (rawValue: string): void => {
      if (rawValue === "") {
        setWinnerFloatDurationMs("");
        return;
      }

      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        setStatus("⚠ Please enter a valid winner float duration.");
        return;
      }

      const normalized = Math.floor(parsed);
      const clamped = Math.min(12000, Math.max(1000, normalized));
      setWinnerFloatDurationMs(String(clamped));
    },
    [],
  );

  const pickWinner = React.useCallback((): number => {
    const { min, max } = getRange();
    const total = max - min + 1;
    if (total <= 0) {
      throw new Error(
        "Invalid range. Minimum should be less than or equal to maximum.",
      );
    }

    let excludedInRange = 0;
    excludedRef.current.forEach((value) => {
      if (value >= min && value <= max) {
        excludedInRange += 1;
      }
    });

    if (excludedInRange >= total) {
      throw new Error("All numbers in this range have been drawn!");
    }

    let value = min;
    let tries = 0;
    do {
      value = Math.floor(Math.random() * total) + min;
      tries += 1;
      if (tries > total * 3) {
        for (let n = min; n <= max; n += 1) {
          if (!excludedRef.current.has(n)) {
            value = n;
            break;
          }
        }
        break;
      }
    } while (excludedRef.current.has(value));

    excludedRef.current.add(value);
    setExcludedCount(excludedRef.current.size);
    return value;
  }, [getRange]);

  const celebrate = React.useCallback(() => {
    setCelebrating(true);
    setWinColor("#ffff00");

    const endCelebrationId = window.setTimeout(() => {
      setCelebrating(false);
      clearTrackedTimeout(endCelebrationId);
    }, 6000);
    addTimeout(endCelebrationId);

    let flashCounter = 0;
    const flashIntervalId = window.setInterval(() => {
      setWinColor(flashCounter % 2 === 0 ? "#ffff00" : "#ff6600");
      flashCounter += 1;
      if (flashCounter > 12) {
        clearTrackedInterval(flashIntervalId);
      }
    }, 250);
    addInterval(flashIntervalId);
  }, []);

  const spin = React.useCallback(async () => {
    if (isSpinning) {
      return;
    }

    const maxDigits = maxVal.replace(/\D/g, "");
    if (maxDigits.length > MAX_REEL_COUNT) {
      setStatus("⚠ Maximum number must be 10 digits or less.");
      return;
    }

    const audioContext = getAudioContext();
    if (audioContext?.state === "suspended") {
      await audioContext.resume();
    }

    stopWinMusic();

    let code = "";
    try {
      const winnerValue = pickWinner();
      code = String(winnerValue).padStart(reelCount, "0");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to draw winner.";
      setStatus(`⚠ ${message}`);
      return;
    }

    setIsSpinning(true);
    setStatus("🎰 Spinning reels...");

    try {
      const speed = Math.max(30, Number.parseInt(spinSpeed, 10) || 80);
      const activeReelCount = reelCount;
      const digits = code.split("");

      await new Promise<void>((resolve) => {
        let leadTicks = 8;
        const leadIntervalId = window.setInterval(
          () => {
            if (unmountedRef.current) {
              clearTrackedInterval(leadIntervalId);
              resolve();
              return;
            }

            setMidDigits(
              Array.from({ length: activeReelCount }, () =>
                String(Math.floor(Math.random() * 10)),
              ),
            );
            playClick();

            leadTicks -= 1;
            if (leadTicks <= 0) {
              clearTrackedInterval(leadIntervalId);
              resolve();
            }
          },
          Math.max(20, Math.floor(speed / 2)),
        );

        addInterval(leadIntervalId);
      });

      for (let i = 0; i < activeReelCount; i += 1) {
        let ticks = 18 + i * 4;

        await new Promise<void>((resolve) => {
          const intervalId = window.setInterval(() => {
            if (unmountedRef.current) {
              clearTrackedInterval(intervalId);
              resolve();
              return;
            }

            setMidDigits((prevDigits) => {
              const nextDigits = normalizeToDigits(
                prevDigits.join(""),
                activeReelCount,
              ).split("");
              nextDigits[i] = String(Math.floor(Math.random() * 10));
              return nextDigits;
            });
            playClick();

            ticks -= 1;
            if (ticks <= 0) {
              clearTrackedInterval(intervalId);
              setMidDigits((prevDigits) => {
                const nextDigits = normalizeToDigits(
                  prevDigits.join(""),
                  activeReelCount,
                ).split("");
                nextDigits[i] = digits[i];
                return nextDigits;
              });
              playReelStop();
              resolve();
            }
          }, speed);

          addInterval(intervalId);
        });
      }

      drawCountRef.current += 1;
      const now = new Date();
      const timeString = now.toLocaleString();
      const title = eventTitle.trim() || "Draw";

      setWinNumber(code);
      setWinMeta(`Draw #${drawCountRef.current}  |  ${timeString}`);
      setStatus(`✅ Winner: ${code} — Removed from all future draws`);
      setFloatingWinner(code);

      const hideFloatingWinnerId = window.setTimeout(() => {
        setFloatingWinner("");
        clearTrackedTimeout(hideFloatingWinnerId);
      }, winnerFloatDuration);
      addTimeout(hideFloatingWinnerId);

      setHistory((previousHistory) => {
        const nextHistory = [
          { code, title, time: timeString },
          ...previousHistory,
        ];
        return nextHistory.slice(0, 20);
      });

      celebrate();
      playWinMusic();
    } finally {
      if (!unmountedRef.current) {
        setIsSpinning(false);
      }
    }
  }, [
    celebrate,
    eventTitle,
    getAudioContext,
    isSpinning,
    pickWinner,
    playClick,
    playReelStop,
    playWinMusic,
    reelCount,
    spinSpeed,
    stopWinMusic,
    normalizeToDigits,
    maxVal,
    winnerFloatDuration,
  ]);

  const copyResult = React.useCallback(() => {
    if (!navigator.clipboard) {
      setStatus("Copy not available");
      return;
    }
    navigator.clipboard
      .writeText(winNumber)
      .then(() => {
        setStatus(`✅ Copied: ${winNumber}`);
      })
      .catch(() => {
        setStatus("Copy not available");
      });
  }, [winNumber]);

  const resetExclusions = React.useCallback(() => {
    excludedRef.current.clear();
    setExcludedCount(0);
    setStatus("🔄 Winner list cleared — all numbers available again");
  }, []);

  const displayWinNumber = isSpinning
    ? normalizeToDigits(midDigits.join(""))
    : normalizeToDigits(winNumber);

  const celebrationBursts = React.useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        left: (index * 37) % 100,
        delay: (index % 9) * 90,
        duration: 2200 + (index % 6) * 180,
        size: 8 + (index % 5) * 3,
        color:
          index % 3 === 0 ? "#ffcc00" : index % 3 === 1 ? "#ff6600" : "#ffff66",
      })),
    [],
  );

  return (
    <>
      {floatingWinner ? (
        <div
          className="winner-float-overlay"
          aria-live="polite"
          style={{ animationDuration: `${winnerFloatDuration}ms` }}
        >
          <div className="winner-float-label">WINNER</div>
          <div
            className="winner-float-number"
            style={{ animationDuration: `${winnerFloatDuration}ms` }}
          >
            {floatingWinner}
          </div>
        </div>
      ) : null}

      {celebrating ? (
        <div className="screen-celebration" aria-hidden="true">
          <div className="screen-celebration-glow" />
          <div className="screen-celebration-flash" />
          {celebrationBursts.map((burst, index) => (
            <span
              className="screen-confetti"
              key={`burst-${index}`}
              style={{
                left: `${burst.left}%`,
                animationDelay: `${burst.delay}ms`,
                animationDuration: `${burst.duration}ms`,
                width: `${burst.size}px`,
                height: `${burst.size * 1.8}px`,
                backgroundColor: burst.color,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="app">
        <div className="top-image-wrap">
          <img
            className="top-side-image"
            src={rumpumChickenSrc}
            alt="Rumpum Chicken"
          />
          <img
            className="top-image"
            src={rumpumRamailoSrc}
            alt="Rumpum Ramailo"
          />
          <img className="top-side-image" src={rumpumVegSrc} alt="Rumpum Veg" />
        </div>

        <div className="header">
          <h1>🎰 {eventTitle}🎰</h1>
          <p>Official Lucky Number Draw</p>
        </div>

        <div className={`machine ${celebrating ? "celebrating" : ""}`}>
          <div className="machine-lights">
            {Array.from({ length: BULB_COUNT }, (_, index) => (
              <div className="bulb" key={`top-${index}`} />
            ))}
          </div>

          <div
            className="reels"
            style={{
              gridTemplateColumns: `repeat(${reelCount}, minmax(0, 1fr))`,
            }}
          >
            {displayWinNumber.split("").map((digit, index) => {
              const value = Number(digit);
              return (
                <div className="reel" key={index}>
                  <div className="d side">{(value + 9) % 10}</div>
                  <div className="d mid">{value}</div>
                  <div className="d side">{(value + 1) % 10}</div>
                </div>
              );
            })}
          </div>

          <div className="machine-lights">
            {Array.from({ length: BULB_COUNT }, (_, index) => (
              <div className="bulb" key={`bottom-${index}`} />
            ))}
          </div>

          <div className="win-banner">
            <div className="win-label">Winning Number</div>
            <div
              className={`win-number ${celebrating ? "is-celebrating" : ""}`}
              style={{ color: winColor }}
            >
              {displayWinNumber}
            </div>
            <div className="win-meta">{winMeta}</div>
          </div>

          <div className="controls">
            <button
              className="btn btn-spin"
              type="button"
              onClick={() => void spin()}
              disabled={isSpinning}
            >
              🎲 SPIN DRAW
            </button>
            <button
              className={`btn btn-stop ${showStopMusic ? "show" : ""}`}
              type="button"
              onClick={stopWinMusic}
            >
              ⏹ Stop Music
            </button>
            <button className="btn btn-copy" type="button" onClick={copyResult}>
              📋 Copy
            </button>
            <button
              className="btn btn-reset"
              type="button"
              onClick={resetExclusions}
            >
              🔄 Reset Winners
            </button>
          </div>

          <div className="status">{status}</div>
        </div>

        <div className="settings">
          <h3>⚙ Draw Range Settings</h3>
          <div className="field-row">
            <div className="field">
              <label htmlFor="minVal">Minimum Number</label>
              <input
                id="minVal"
                type="number"
                value={minVal}
                min={0}
                max={MAX_DRAW_NUMBER}
                disabled={isSpinning}
                onChange={(event) => setMinVal(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="maxVal">Maximum Number (up to 10 digits)</label>
              <input
                id="maxVal"
                type="number"
                value={maxVal}
                min={0}
                max={MAX_DRAW_NUMBER}
                disabled={isSpinning}
                onChange={(event) => handleMaxValueChange(event.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="eventTitle">Event Title</label>
              <input
                id="eventTitle"
                type="text"
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="spinSpeed">Spin Speed (ms)</label>
              <input
                id="spinSpeed"
                type="number"
                value={spinSpeed}
                min={30}
                max={300}
                onChange={(event) => setSpinSpeed(event.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="winnerFloatDurationMs">
                Winner Float Duration (ms)
              </label>
              <input
                id="winnerFloatDurationMs"
                type="number"
                value={winnerFloatDurationMs}
                min={1000}
                max={12000}
                onChange={(event) =>
                  handleWinnerFloatDurationChange(event.target.value)
                }
                onBlur={() => {
                  if (winnerFloatDurationMs === "") {
                    setWinnerFloatDurationMs("3200");
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="winnerFloatDurationPreview">Preview</label>
              <input
                id="winnerFloatDurationPreview"
                type="text"
                value={`${(winnerFloatDuration / 1000).toFixed(1)} seconds`}
                readOnly
              />
            </div>
          </div>

          <div className="remaining">{remainingText}</div>
        </div>

        <div className="history-wrap">
          <h3>📋 Draw History</h3>
          <div className="history-list">
            {history.length === 0 ? (
              <div
                style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}
              >
                No draws yet. Press SPIN DRAW to begin.
              </div>
            ) : (
              history.map((item, index) => (
                <div
                  className="h-item"
                  key={`${item.code}-${item.time}-${index}`}
                >
                  <span>
                    {index + 1}. <span className="h-code">{item.code}</span>{" "}
                    <span className="h-title">{item.title}</span>
                  </span>
                  <span className="h-time">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <footer>
          RUMPUM LUCKY DRAW {new Date().getFullYear()} | Each winner is removed
          from future draws
        </footer>
      </div>

      <audio
        ref={winMusicRef}
        preload="auto"
        onEnded={() => setShowStopMusic(false)}
      >
        <source src={winMusicSrc} type="audio/mp4" />
      </audio>
    </>
  );
};

export default Main;
