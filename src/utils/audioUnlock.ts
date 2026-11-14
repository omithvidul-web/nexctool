let sharedAudioCtx: AudioContext | null = null;

/**
 * Creates/returns a shared AudioContext and unlocks it synchronously inside a
 * user click gesture so iOS Safari / WebKit does not suspend Web Audio playback
 * after async dynamic imports or video metadata loading.
 */
export function unlockSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    const silentBuf = sharedAudioCtx.createBuffer(1, 1, 22050);
    const src = sharedAudioCtx.createBufferSource();
    src.buffer = silentBuf;
    src.connect(sharedAudioCtx.destination);
    src.start(0);
    if (sharedAudioCtx.state !== 'running') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Connects a 0-gain silent oscillator to both audioCtx.destination and the
 * MediaStreamAudioDestinationNode so WebKit/Safari continuously clocks audio
 * frames during recording while keeping the user's device speakers silent.
 */
export function attachSilentAudioKeepAlive(
  audioCtx: AudioContext,
  audioDest: MediaStreamAudioDestinationNode
): { zeroGainToSpeakers: GainNode; cleanup: () => void } {
  const zeroGainToSpeakers = audioCtx.createGain();
  zeroGainToSpeakers.gain.value = 0;
  zeroGainToSpeakers.connect(audioCtx.destination);

  const zeroGainToStream = audioCtx.createGain();
  zeroGainToStream.gain.value = 0;
  zeroGainToStream.connect(audioDest);

  let osc: OscillatorNode | null = null;
  try {
    osc = audioCtx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(zeroGainToSpeakers);
    osc.connect(zeroGainToStream);
    osc.start(0);
  } catch {
    osc = null;
  }

  return {
    zeroGainToSpeakers,
    cleanup: () => {
      if (osc) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore already stopped oscillator
        }
      }
      try {
        zeroGainToStream.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      try {
        zeroGainToSpeakers.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    },
  };
}
