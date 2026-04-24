import * as React from "react";

import "./Main.css";
import heroImageSrc from "./hero.jpeg";
import rumpumChickenSrc from "./Rumpum Chicken.png";
import rumpumRamailoSrc from "./rumpum_ramailo.png";
import rumpumVegSrc from "./rumpum veg.png";

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
const MAX_DRAW_NUMBER = 1190000;
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
  const [maxVal, setMaxVal] = React.useState<string>("1190000");
  const [eventTitle, setEventTitle] = React.useState<string>(
    "RUMPUM LUCKY DRAW 2083",
  );
  const [spinSpeed, setSpinSpeed] = React.useState<string>("80");
  const [winnerFloatDurationMs, setWinnerFloatDurationMs] =
    React.useState<string>("3200");

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const celebrationSourcesRef = React.useRef<AudioScheduledSourceNode[]>([]);
  const celebrationNodesRef = React.useRef<AudioNode[]>([]);
  const celebrationHideStopTimeoutRef = React.useRef<number | null>(null);
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

      if (celebrationHideStopTimeoutRef.current !== null) {
        window.clearTimeout(celebrationHideStopTimeoutRef.current);
        celebrationHideStopTimeoutRef.current = null;
      }
      celebrationSourcesRef.current.forEach((source) => {
        try {
          source.stop();
        } catch {
          return;
        } finally {
          source.disconnect();
        }
      });
      celebrationSourcesRef.current = [];
      celebrationNodesRef.current.forEach((node) => {
        node.disconnect();
      });
      celebrationNodesRef.current = [];

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

    const now = audioContext.currentTime;

    const oscillator = audioContext.createOscillator();
    const toneGain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(1450, now);
    oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.03);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.1, now + 0.005);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    oscillator.connect(toneGain);
    toneGain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.04);

    const noiseBuffer = audioContext.createBuffer(
      1,
      Math.floor(audioContext.sampleRate * 0.022),
      audioContext.sampleRate,
    );
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i += 1) {
      channelData[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - i / channelData.length, 2.2);
    }

    const noise = audioContext.createBufferSource();
    const bandPass = audioContext.createBiquadFilter();
    const noiseGain = audioContext.createGain();

    noise.buffer = noiseBuffer;
    bandPass.type = "bandpass";
    bandPass.frequency.setValueAtTime(1650, now);
    bandPass.Q.value = 0.95;

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.07, now + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

    noise.connect(bandPass);
    bandPass.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    noise.start(now);
    noise.stop(now + 0.024);
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

  const stopWinMusic = React.useCallback(() => {
    if (celebrationHideStopTimeoutRef.current !== null) {
      clearTrackedTimeout(celebrationHideStopTimeoutRef.current);
      celebrationHideStopTimeoutRef.current = null;
    }

    celebrationSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        return;
      } finally {
        source.disconnect();
      }
    });
    celebrationSourcesRef.current = [];

    celebrationNodesRef.current.forEach((node) => {
      node.disconnect();
    });
    celebrationNodesRef.current = [];

    setShowStopMusic(false);
  }, []);

  const playWinMusic = React.useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    stopWinMusic();

    const baseTime = audioContext.currentTime + 0.03;
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(
      0.86,
      audioContext.currentTime + 0.06,
    );
    masterGain.gain.exponentialRampToValueAtTime(0.0001, baseTime + 2.35);
    masterGain.connect(audioContext.destination);

    celebrationNodesRef.current = [masterGain];

    const tonePattern = [
      {
        frequency: 523.25,
        offset: 0.0,
        duration: 0.22,
        type: "sawtooth" as OscillatorType,
        gain: 0.34,
      },
      {
        frequency: 659.25,
        offset: 0.13,
        duration: 0.24,
        type: "triangle" as OscillatorType,
        gain: 0.3,
      },
      {
        frequency: 783.99,
        offset: 0.28,
        duration: 0.26,
        type: "triangle" as OscillatorType,
        gain: 0.29,
      },
      {
        frequency: 1046.5,
        offset: 0.45,
        duration: 0.4,
        type: "sine" as OscillatorType,
        gain: 0.26,
      },
      {
        frequency: 783.99,
        offset: 0.88,
        duration: 0.2,
        type: "triangle" as OscillatorType,
        gain: 0.2,
      },
      {
        frequency: 1174.66,
        offset: 1.03,
        duration: 0.28,
        type: "sine" as OscillatorType,
        gain: 0.19,
      },
    ];

    tonePattern.forEach((tone) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(
        tone.frequency,
        baseTime + tone.offset,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        tone.frequency * 1.03,
        baseTime + tone.offset + tone.duration,
      );

      gain.gain.setValueAtTime(0.0001, baseTime + tone.offset);
      gain.gain.exponentialRampToValueAtTime(
        tone.gain,
        baseTime + tone.offset + 0.03,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        baseTime + tone.offset + tone.duration,
      );

      oscillator.connect(gain);
      gain.connect(masterGain);

      celebrationNodesRef.current.push(gain);
      celebrationSourcesRef.current.push(oscillator);

      oscillator.start(baseTime + tone.offset);
      oscillator.stop(baseTime + tone.offset + tone.duration);
    });

    const sparkleBurstOffsets = [0.55, 0.85, 1.15, 1.42];
    sparkleBurstOffsets.forEach((offset, index) => {
      const buffer = audioContext.createBuffer(
        1,
        Math.floor(audioContext.sampleRate * 0.2),
        audioContext.sampleRate,
      );
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i += 1) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / channelData.length, 2.4);
      }

      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;

      const bandPass = audioContext.createBiquadFilter();
      bandPass.type = "bandpass";
      bandPass.frequency.setValueAtTime(1600 + index * 420, baseTime + offset);
      bandPass.Q.value = 1.4;

      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, baseTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, baseTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + offset + 0.2);

      noise.connect(bandPass);
      bandPass.connect(gain);
      gain.connect(masterGain);

      celebrationNodesRef.current.push(bandPass, gain);
      celebrationSourcesRef.current.push(noise);

      noise.start(baseTime + offset);
      noise.stop(baseTime + offset + 0.2);
    });

    setShowStopMusic(true);

    const hideStopMusicId = window.setTimeout(() => {
      setShowStopMusic(false);
      celebrationHideStopTimeoutRef.current = null;
      clearTrackedTimeout(hideStopMusicId);
    }, 2600);
    celebrationHideStopTimeoutRef.current = hideStopMusicId;
    addTimeout(hideStopMusicId);
  }, [getAudioContext, stopWinMusic]);

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
        <header className="hero">
          <img
            className="hero-side-image hero-side-image-left"
            src={rumpumChickenSrc}
            alt="Rumpum Chicken"
          />
          <img
            className="hero-side-image hero-side-image-right"
            src={rumpumVegSrc}
            alt="Rumpum Veg"
          />

          <div className="top-image-wrap">
            <img className="top-image" src={heroImageSrc} alt="Rumpum Hero" />
          </div>

          <div className="hero-sub-image-wrap">
            <img
              className="hero-sub-image"
              src={rumpumRamailoSrc}
              alt="Rumpum Ramailo"
            />
          </div>

          <p className="hero-kicker">Nepal&apos;s Most Loved Instant Noodles</p>
          <h1>{eventTitle}</h1>
          <p className="hero-copy">
            Built for unforgettable campaigns, this premium lucky draw
            experience brings the same energy, trust, and joy that Rumpum
            delivers in every pack across Nepal.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-spin hero-cta"
              type="button"
              onClick={() => {
                document.getElementById("draw-machine")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              Launch Lucky Draw
            </button>
          </div>
          <div className="hero-stats" aria-label="Rumpum strengths">
            <div className="hero-stat">
              <span>Nationwide Trust</span>
              <strong>Families Across Nepal</strong>
            </div>
            <div className="hero-stat">
              <span>Flavor Leadership</span>
              <strong>Chicken and Veg Favorites</strong>
            </div>
            <div className="hero-stat">
              <span>Campaign Reliability</span>
              <strong>Transparent Winner Selection</strong>
            </div>
          </div>
        </header>

        <section className="pillars" aria-label="Brand highlights">
          <article className="pillar-card">
            <h3>Authentic Taste</h3>
            <p>
              Crafted for Nepalese taste buds with bold seasoning and satisfying
              texture in every bite.
            </p>
          </article>
          <article className="pillar-card">
            <h3>Trusted Quality</h3>
            <p>
              Designed with consistent quality standards so every campaign and
              every product moment feels premium.
            </p>
          </article>
          <article className="pillar-card">
            <h3>Community First</h3>
            <p>
              Promotions that are fair, exciting, and easy to run, helping you
              engage loyal customers with confidence.
            </p>
          </article>
        </section>

        <section
          id="draw-machine"
          className={`machine campaign-machine ${celebrating ? "celebrating" : ""}`}
        >
          <div className="section-heading">
            <h2>Lucky Draw Control Center</h2>
            <p>
              Run transparent, high-energy winner announcements for your brand
              campaign.
            </p>
          </div>

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
        </section>

        <div className="panel-grid">
          <section className="settings">
            <h3>Draw Settings</h3>
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
          </section>

          <section className="history-wrap">
            <h3>Recent Winners</h3>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="history-empty">
                  No draws yet. Press SPIN DRAW to start the first winner.
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
          </section>
        </div>

        <footer className="site-footer">
          RUMPUM LUCKY DRAW {new Date().getFullYear()} | Winners are
          automatically removed from future draws for complete fairness.
        </footer>
      </div>
    </>
  );
};

export default Main;
