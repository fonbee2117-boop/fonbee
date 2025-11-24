
// Simple synthetic audio manager to avoid needing external assets
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private masterGain: GainNode | null = null;

  constructor() {
    try {
      // @ts-ignore
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx!.createGain();
      this.masterGain.connect(this.ctx!.destination);
      this.masterGain.gain.value = 0.3; // Low volume default
    } catch (e) {
      console.warn("AudioContext not supported");
    }
  }

  toggleSound(on: boolean) {
    this.enabled = on;
    if (this.masterGain) {
      this.masterGain.gain.value = on ? 0.3 : 0;
    }
    if (this.ctx?.state === 'suspended' && on) {
      this.ctx.resume();
    }
  }

  private createNoiseBuffer(duration: number): AudioBuffer | null {
      if (!this.ctx) return null;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  }

  playShoot(type: 'small' | 'cannon' | 'rocket') {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.masterGain!);

    if (type === 'small') {
      // Machine Gun: Sharp, metallic snap
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.08);
    } else if (type === 'cannon') {
      // Cannon: Deep thud + burst
      const osc = this.ctx.createOscillator();
      osc.type = 'square'; // More grit
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(0.4);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(100, t + 0.3);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      osc.connect(gain);
      if(noise.buffer) {
          noise.connect(filter);
          filter.connect(gain);
          noise.start(t);
      }
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (type === 'rocket') {
       // Rocket: Hissing launch
       const noise = this.ctx.createBufferSource();
       noise.buffer = this.createNoiseBuffer(0.5);
       const filter = this.ctx.createBiquadFilter();
       filter.type = 'bandpass';
       filter.frequency.setValueAtTime(1000, t);
       filter.frequency.linearRampToValueAtTime(200, t + 0.5);

       gain.gain.setValueAtTime(0.1, t);
       gain.gain.linearRampToValueAtTime(0, t + 0.5);

       if(noise.buffer) {
           noise.connect(filter);
           filter.connect(gain);
           noise.start(t);
       }
    }
  }

  playBombDrop() {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.connect(this.masterGain!);

      // Classic whistle sound
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 1.0);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.8);
      gain.gain.linearRampToValueAtTime(0, t + 1.0);

      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 1.0);
  }

  playExplosion(size: 'small' | 'large' | 'extra_large') {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = size === 'extra_large' ? 1.8 : size === 'large' ? 1.2 : 0.6;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(dur);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(size === 'extra_large' ? 600 : size === 'large' ? 800 : 1200, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(size === 'extra_large' ? 0.8 : size === 'large' ? 0.6 : 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    if (noise.buffer) {
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        noise.start(t);
    }
  }

  playSplash(size: 'small' | 'large') {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const dur = size === 'large' ? 0.8 : 0.4;
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(dur);
      
      // Water splash is heavily low-passed
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.linearRampToValueAtTime(100, t + dur);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(size === 'large' ? 0.3 : 0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

      if (noise.buffer) {
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain!);
          noise.start(t);
      }
  }

  playHit(target: 'enemy' | 'player') {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.masterGain!);

    if (target === 'enemy') {
       // Metallic ping for bullet hitting plane
       const osc = this.ctx.createOscillator();
       osc.type = 'triangle';
       osc.frequency.setValueAtTime(800, t);
       osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);
       
       gain.gain.setValueAtTime(0.05, t);
       gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
       
       osc.connect(gain);
       osc.start(t);
       osc.stop(t + 0.05);
    } else {
       // Heavy impact on ship
       const osc = this.ctx.createOscillator();
       osc.type = 'square';
       osc.frequency.setValueAtTime(100, t);
       osc.frequency.exponentialRampToValueAtTime(20, t + 0.2);
       
       gain.gain.setValueAtTime(0.2, t);
       gain.gain.linearRampToValueAtTime(0, t + 0.2);
       
       osc.connect(gain);
       osc.start(t);
       osc.stop(t + 0.2);
    }
  }
}

export const soundManager = new SoundManager();
