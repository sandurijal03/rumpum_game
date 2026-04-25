import * as React from "react";
import { CSVLink } from "react-csv";

import "./Main.css";
import rumpumChickenSrc from "./Rumpum Chicken.png";
import rumpumRamailoSrc from "./rumpum_ramailo.png";
import rumpumVegSrc from "./rumpum veg.png";
import winningAudioSrc from "./winning_audio.mpeg";
import af from "./af_logo.png";

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
  const winningAudioRef = React.useRef<HTMLAudioElement | null>(null);
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

      if (winningAudioRef.current) {
        winningAudioRef.current.pause();
        winningAudioRef.current.currentTime = 0;
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

    const now = audioContext.currentTime;
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.05;

    const glide = audioContext.createOscillator();
    const glideGain = audioContext.createGain();
    glide.type = "triangle";
    glide.frequency.setValueAtTime(1040 * pitchJitter, now);
    glide.frequency.exponentialRampToValueAtTime(
      560 * pitchJitter,
      now + 0.038,
    );
    glideGain.gain.setValueAtTime(0.0001, now);
    glideGain.gain.exponentialRampToValueAtTime(0.06, now + 0.004);
    glideGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);

    const snap = audioContext.createOscillator();
    const snapGain = audioContext.createGain();
    snap.type = "square";
    snap.frequency.setValueAtTime(1800 * pitchJitter, now);
    snap.frequency.exponentialRampToValueAtTime(
      1200 * pitchJitter,
      now + 0.012,
    );
    snapGain.gain.setValueAtTime(0.0001, now);
    snapGain.gain.exponentialRampToValueAtTime(0.03, now + 0.001);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

    const noiseBuffer = audioContext.createBuffer(
      1,
      Math.floor(audioContext.sampleRate * 0.018),
      audioContext.sampleRate,
    );
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i += 1) {
      channelData[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - i / channelData.length, 2.4);
    }

    const noise = audioContext.createBufferSource();
    const bandPass = audioContext.createBiquadFilter();
    const noiseGain = audioContext.createGain();

    noise.buffer = noiseBuffer;
    bandPass.type = "bandpass";
    bandPass.frequency.setValueAtTime(1700, now);
    bandPass.Q.value = 1.1;

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.022, now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    glide.connect(glideGain);
    glideGain.connect(audioContext.destination);

    snap.connect(snapGain);
    snapGain.connect(audioContext.destination);

    noise.connect(bandPass);
    bandPass.connect(noiseGain);
    noiseGain.connect(audioContext.destination);

    glide.start(now);
    glide.stop(now + 0.045);
    snap.start(now);
    snap.stop(now + 0.018);
    noise.start(now);
    noise.stop(now + 0.02);
  }, [getAudioContext]);

  const playReelStop = React.useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }
    const now = audioContext.currentTime;

    const drum = audioContext.createOscillator();
    const drumGain = audioContext.createGain();
    drum.type = "triangle";
    drum.frequency.setValueAtTime(240, now);
    drum.frequency.exponentialRampToValueAtTime(95, now + 0.16);
    drumGain.gain.setValueAtTime(0.19, now);
    drumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    drum.connect(drumGain);
    drumGain.connect(audioContext.destination);

    const click = audioContext.createOscillator();
    const clickGain = audioContext.createGain();
    click.type = "sine";
    click.frequency.setValueAtTime(1200, now);
    click.frequency.exponentialRampToValueAtTime(840, now + 0.05);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.06, now + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    click.connect(clickGain);
    clickGain.connect(audioContext.destination);

    drum.start(now);
    drum.stop(now + 0.2);
    click.start(now);
    click.stop(now + 0.09);
  }, [getAudioContext]);

  const playSelectionHit = React.useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    const baseTime = audioContext.currentTime;
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, baseTime);
    masterGain.gain.exponentialRampToValueAtTime(0.34, baseTime + 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, baseTime + 0.9);
    masterGain.connect(audioContext.destination);

    const notePattern = [
      { freq: 783.99, offset: 0.0, type: "triangle" as OscillatorType },
      { freq: 1174.66, offset: 0.09, type: "triangle" as OscillatorType },
      { freq: 1567.98, offset: 0.18, type: "sine" as OscillatorType },
      { freq: 2093.0, offset: 0.28, type: "sine" as OscillatorType },
    ];

    notePattern.forEach((note) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const noteStart = baseTime + note.offset;

      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, noteStart);
      osc.frequency.exponentialRampToValueAtTime(
        note.freq * 0.992,
        noteStart + 0.22,
      );

      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.2, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.24);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(noteStart);
      osc.stop(noteStart + 0.25);
    });
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

    if (winningAudioRef.current) {
      winningAudioRef.current.pause();
      winningAudioRef.current.currentTime = 0;
    }

    setShowStopMusic(false);
  }, []);

  const playWinMusic = React.useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    stopWinMusic();

    const winningAudio = winningAudioRef.current;
    if (winningAudio) {
      winningAudio.currentTime = 0;
      winningAudio.volume = 0.9;
      winningAudio.play().catch(() => {
        return;
      });
    }

    const baseTime = audioContext.currentTime + 0.03;
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(
      0.74,
      audioContext.currentTime + 0.06,
    );
    masterGain.gain.exponentialRampToValueAtTime(0.0001, baseTime + 2.9);
    masterGain.connect(audioContext.destination);

    const shimmerDelay = audioContext.createDelay();
    shimmerDelay.delayTime.setValueAtTime(0.16, baseTime);
    const shimmerFeedback = audioContext.createGain();
    shimmerFeedback.gain.setValueAtTime(0.2, baseTime);
    const shimmerFilter = audioContext.createBiquadFilter();
    shimmerFilter.type = "lowpass";
    shimmerFilter.frequency.setValueAtTime(3200, baseTime);

    masterGain.connect(shimmerDelay);
    shimmerDelay.connect(shimmerFilter);
    shimmerFilter.connect(audioContext.destination);
    shimmerDelay.connect(shimmerFeedback);
    shimmerFeedback.connect(shimmerDelay);

    celebrationNodesRef.current = [
      masterGain,
      shimmerDelay,
      shimmerFeedback,
      shimmerFilter,
    ];

    const fanfarePattern = [
      {
        frequency: 659.25,
        offset: 0.0,
        duration: 0.16,
        gain: 0.22,
        type: "triangle" as OscillatorType,
      },
      {
        frequency: 783.99,
        offset: 0.11,
        duration: 0.16,
        gain: 0.22,
        type: "triangle" as OscillatorType,
      },
      {
        frequency: 987.77,
        offset: 0.24,
        duration: 0.18,
        gain: 0.24,
        type: "triangle" as OscillatorType,
      },
      {
        frequency: 1174.66,
        offset: 0.39,
        duration: 0.2,
        gain: 0.25,
        type: "sawtooth" as OscillatorType,
      },
      {
        frequency: 1318.51,
        offset: 0.58,
        duration: 0.23,
        gain: 0.24,
        type: "sine" as OscillatorType,
      },
      {
        frequency: 1567.98,
        offset: 0.8,
        duration: 0.24,
        gain: 0.23,
        type: "sine" as OscillatorType,
      },
      {
        frequency: 1318.51,
        offset: 1.05,
        duration: 0.18,
        gain: 0.2,
        type: "triangle" as OscillatorType,
      },
      {
        frequency: 1760.0,
        offset: 1.22,
        duration: 0.26,
        gain: 0.22,
        type: "sine" as OscillatorType,
      },
    ];

    fanfarePattern.forEach((tone, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(
        tone.frequency * (1 + (Math.random() - 0.5) * 0.01),
        baseTime + tone.offset,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        tone.frequency * (index % 2 === 0 ? 1.02 : 0.99),
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

      const harmonyOsc = audioContext.createOscillator();
      const harmonyGain = audioContext.createGain();
      harmonyOsc.type = "sine";
      harmonyOsc.frequency.setValueAtTime(
        tone.frequency / 2,
        baseTime + tone.offset,
      );
      harmonyGain.gain.setValueAtTime(0.0001, baseTime + tone.offset);
      harmonyGain.gain.exponentialRampToValueAtTime(
        tone.gain * 0.28,
        baseTime + tone.offset + 0.04,
      );
      harmonyGain.gain.exponentialRampToValueAtTime(
        0.0001,
        baseTime + tone.offset + tone.duration,
      );

      harmonyOsc.connect(harmonyGain);
      harmonyGain.connect(masterGain);

      celebrationNodesRef.current.push(harmonyGain);
      celebrationSourcesRef.current.push(harmonyOsc);

      harmonyOsc.start(baseTime + tone.offset);
      harmonyOsc.stop(baseTime + tone.offset + tone.duration);
    });

    const bellNotes = [1567.98, 1975.53, 2349.32];
    bellNotes.forEach((frequency, index) => {
      const bellOffset = 0.5 + index * 0.36;
      const bell = audioContext.createOscillator();
      const bellGain = audioContext.createGain();
      bell.type = "sine";
      bell.frequency.setValueAtTime(frequency, baseTime + bellOffset);
      bell.frequency.exponentialRampToValueAtTime(
        frequency * 0.985,
        baseTime + bellOffset + 0.5,
      );
      bellGain.gain.setValueAtTime(0.0001, baseTime + bellOffset);
      bellGain.gain.exponentialRampToValueAtTime(
        0.19,
        baseTime + bellOffset + 0.03,
      );
      bellGain.gain.exponentialRampToValueAtTime(
        0.0001,
        baseTime + bellOffset + 0.48,
      );

      bell.connect(bellGain);
      bellGain.connect(masterGain);

      celebrationNodesRef.current.push(bellGain);
      celebrationSourcesRef.current.push(bell);

      bell.start(baseTime + bellOffset);
      bell.stop(baseTime + bellOffset + 0.5);
    });

    const fireworkBurstOffsets = [0.52, 0.96, 1.38, 1.8, 2.2];
    fireworkBurstOffsets.forEach((offset, index) => {
      const whistle = audioContext.createOscillator();
      const whistleGain = audioContext.createGain();
      whistle.type = "triangle";
      whistle.frequency.setValueAtTime(
        420 + index * 60,
        baseTime + offset - 0.09,
      );
      whistle.frequency.exponentialRampToValueAtTime(
        1400 + index * 120,
        baseTime + offset,
      );
      whistleGain.gain.setValueAtTime(0.0001, baseTime + offset - 0.09);
      whistleGain.gain.exponentialRampToValueAtTime(
        0.085,
        baseTime + offset - 0.03,
      );
      whistleGain.gain.exponentialRampToValueAtTime(0.0001, baseTime + offset);

      whistle.connect(whistleGain);
      whistleGain.connect(masterGain);

      celebrationNodesRef.current.push(whistleGain);
      celebrationSourcesRef.current.push(whistle);

      whistle.start(baseTime + offset - 0.09);
      whistle.stop(baseTime + offset + 0.01);

      const buffer = audioContext.createBuffer(
        1,
        Math.floor(audioContext.sampleRate * 0.3),
        audioContext.sampleRate,
      );
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i += 1) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / channelData.length, 2.1);
      }

      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;

      const highPass = audioContext.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.setValueAtTime(700, baseTime + offset);

      const bandPass = audioContext.createBiquadFilter();
      bandPass.type = "bandpass";
      bandPass.frequency.setValueAtTime(1750 + index * 460, baseTime + offset);
      bandPass.Q.value = 1.25;

      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, baseTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.19, baseTime + offset + 0.016);
      gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + offset + 0.3);

      noise.connect(highPass);
      highPass.connect(bandPass);
      bandPass.connect(gain);
      gain.connect(masterGain);

      celebrationNodesRef.current.push(highPass, bandPass, gain);
      celebrationSourcesRef.current.push(noise);

      noise.start(baseTime + offset);
      noise.stop(baseTime + offset + 0.3);
    });

    setShowStopMusic(true);

    const hideStopMusicId = window.setTimeout(() => {
      setShowStopMusic(false);
      celebrationHideStopTimeoutRef.current = null;
      clearTrackedTimeout(hideStopMusicId);
    }, 3200);
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
              if (i === activeReelCount - 1) {
                playSelectionHit();
              } else {
                playReelStop();
              }
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
    playSelectionHit,
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

  const csvHeaders = React.useMemo(
    () => [
      { label: "Rank", key: "rank" },
      { label: "Winner Code", key: "winnerCode" },
      { label: "Draw Title", key: "drawTitle" },
      { label: "Draw Time", key: "drawTime" },
    ],
    [],
  );

  const csvData = React.useMemo(
    () =>
      history.map((item, index) => ({
        rank: index + 1,
        winnerCode: item.code,
        drawTitle: item.title,
        drawTime: item.time,
      })),
    [history],
  );

  const csvFileName = React.useMemo(() => {
    const safeTitle =
      (eventTitle.trim() || "rumpum-lucky-draw")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "rumpum-lucky-draw";
    const dateStamp = new Date().toISOString().slice(0, 10);
    return `${safeTitle}-winners-${dateStamp}.csv`;
  }, [eventTitle]);

  const handleExportCsvClick = React.useCallback(() => {
    if (history.length === 0) {
      setStatus("⚠ No winners to export yet.");
      return false;
    }

    setStatus(`✅ Exported ${history.length} winner(s) to ${csvFileName}`);
    return true;
  }, [csvFileName, history.length]);

  const resetExclusions = React.useCallback(() => {
    excludedRef.current.clear();
    setExcludedCount(0);
    setStatus("🔄 Winner list cleared — all numbers available again");
  }, []);

  const displayWinNumber = isSpinning
    ? normalizeToDigits(midDigits.join(""))
    : normalizeToDigits(winNumber);

  const visibleHistory = React.useMemo(() => history.slice(0, 6), [history]);

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

  const isShowcaseMode = React.useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    const showcase = (params.get("showcase") || "").toLowerCase();
    const mode = (params.get("mode") || "").toLowerCase();

    return (
      showcase === "1" ||
      showcase === "true" ||
      showcase === "yes" ||
      mode === "showcase" ||
      mode === "stage"
    );
  }, []);

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

      <div className={`app ${isShowcaseMode ? "showcase-mode" : ""}`}>
        <div className="single-screen-main">
          <section
            id="draw-machine"
            className={`machine campaign-machine ${celebrating ? "celebrating" : ""}`}
          >
            {/* <img
              className="section-brand-image"
              src={rumpumRamailoSrc}
              alt="Rumpum Ramailo"
              width={"120px"}
            /> */}
            <div className="section-heading">
              <div className="section-heading-main">
                <div className="heading-brand-group left" aria-hidden="true">
                  <img
                    className="section-brand-image af"
                    src={af}
                    alt="Asian Foods"
                  />
                  <img
                    className="section-brand-image ramailo"
                    src={rumpumRamailoSrc}
                    alt="Rumpum Ramailo"
                  />
                </div>

                <div className="heading-title-wrap">
                  <span className="heading-title-kicker">Lucky Draw Event</span>
                  <h2>{eventTitle}</h2>
                </div>

                <div className="heading-brand-group right" aria-hidden="true">
                  <img
                    className="section-brand-image product"
                    src={rumpumChickenSrc}
                    alt="Rumpum Chicken Noodle"
                  />
                  <img
                    className="section-brand-image product"
                    src={rumpumVegSrc}
                    alt="Rumpum Veg Noodle"
                  />
                </div>
              </div>
            </div>

            <div className="machine-lights">
              {Array.from({ length: BULB_COUNT }, (_, index) => (
                <div className="bulb" key={`top-${index}`} />
              ))}
            </div>

            <div className="reels-stage">
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
              {/* <button
                className="btn btn-copy"
                type="button"
                onClick={copyResult}
              >
                📋 Copy
              </button> */}
              <CSVLink
                className="btn btn-copy"
                data={csvData}
                headers={csvHeaders}
                filename={csvFileName}
                onClick={handleExportCsvClick}
                style={{ textDecoration: "none" }}
              >
                ⬇ Export CSV
              </CSVLink>
              {/* <button
                className="btn btn-reset"
                type="button"
                onClick={resetExclusions}
              >
                🔄 Reset Winners
              </button> */}
            </div>

            {/* <div className="status">{status}</div> */}

            {isShowcaseMode ? null : (
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
                        disabled={true}
                        onChange={(event) => setMinVal(event.target.value)}
                        style={{ fontSize: "2rem" }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="maxVal">
                        Maximum Number (up to 10 digits)
                      </label>
                      <input
                        id="maxVal"
                        type="number"
                        value={maxVal}
                        min={0}
                        max={MAX_DRAW_NUMBER}
                        disabled={true}
                        onChange={(event) =>
                          handleMaxValueChange(event.target.value)
                        }
                        style={{ fontSize: "2rem" }}
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
                        type="text"
                        value={winnerFloatDurationMs}
                        onChange={(event) =>
                          handleWinnerFloatDurationChange(event.target.value)
                        }
                        // onBlur={() => {
                        //   if (winnerFloatDurationMs === "") {
                        //     setWinnerFloatDurationMs("3200");
                        //   }
                        // }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="winnerFloatDurationPreview">
                        Preview
                      </label>
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
                      visibleHistory.map((item, index) => (
                        <div
                          className="h-item"
                          key={`${item.code}-${item.time}-${index}`}
                        >
                          <span>
                            {index + 1}.{" "}
                            <span className="h-code">{item.code}</span>{" "}
                            <span className="h-title">{item.title}</span>
                          </span>
                          <span className="h-time">{item.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>

        {isShowcaseMode ? null : (
          <footer className="site-footer">
            RUMPUM LUCKY DRAW {new Date().getFullYear()} | Winners are
            automatically removed from future draws for complete fairness.
          </footer>
        )}
      </div>

      <audio ref={winningAudioRef} preload="auto">
        <source src={winningAudioSrc} type="audio/mpeg" />
      </audio>
    </>
  );
};

export default Main;
