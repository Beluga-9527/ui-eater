let context: AudioContext | null = null;
export function playSound(kind: 'click' | 'eat' | 'win', enabled: boolean) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const notes = kind === 'win' ? [392, 494, 587, 784] : kind === 'eat' ? [160, 100] : [360];
    notes.forEach((frequency, i) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = kind === 'eat' ? 'sawtooth' : 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.025, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.12);
      oscillator.connect(gain); gain.connect(context!.destination);
      oscillator.start(now + i * 0.09); oscillator.stop(now + i * 0.09 + 0.13);
    });
  } catch { /* Sound is optional when the browser blocks audio. */ }
}
