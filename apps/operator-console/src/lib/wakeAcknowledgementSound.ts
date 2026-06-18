type BrowserWindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const WAKE_ACKNOWLEDGEMENT_PEAK_GAIN = 0.28;

export async function playWakeAcknowledgementSound(): Promise<void> {
  const browserWindow = window as BrowserWindowWithAudio;
  const AudioContextConstructor = window.AudioContext || browserWindow.webkitAudioContext;
  if (!AudioContextConstructor) return;

  const context = new AudioContextConstructor();

  try {
    if (context.state === 'suspended') await context.resume();

    const start = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(WAKE_ACKNOWLEDGEMENT_PEAK_GAIN, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
    gain.connect(context.destination);

    const firstTone = context.createOscillator();
    firstTone.type = 'sine';
    firstTone.frequency.setValueAtTime(660, start);
    firstTone.connect(gain);
    firstTone.start(start);
    firstTone.stop(start + 0.09);

    const secondTone = context.createOscillator();
    secondTone.type = 'sine';
    secondTone.frequency.setValueAtTime(880, start + 0.075);
    secondTone.connect(gain);
    secondTone.start(start + 0.075);
    secondTone.stop(start + 0.19);

    window.setTimeout(() => void context.close(), 260);
  } catch {
    await context.close().catch(() => undefined);
  }
}
