/**
 * AudioEngine - Dual-deck Web Audio API pipeline with real-time crossfade
 */
class AudioEngine {
  constructor(queueManager, storageManager) {
    this.queueManager = queueManager;
    this.storageManager = storageManager;

    this.audioCtx = null;
    this.inputGainNode = null;
    this.outputGainNode = null;
    this.masterGain = null; // Alias para outputGainNode por compatibilidade
    this.analyserNode = null;
    this.freqDataArray = null;

    this.deckA = null;
    this.deckB = null;

    this.activeDeckId = 'A'; // 'A' or 'B'
    this.isCrossfading = false;
    this.crossfadeSeconds = 3; // 0 to 12s
    this.volume = 0.8;
    this.isPlaying = false;
    this.sinkId = 'default';
    this.eqFilters = [];
    this.eqBypass = false;
    this.storedBands = new Array(10).fill(0);

    this.listeners = {
      timeupdate: [],
      trackChange: [],
      stateChange: [],
      trackPlayedHalf: [],
      crossfadeStatus: [],
      sinkChange: []
    };

    this._monitorInterval = null;

    if (storageManager) {
      const settings = storageManager.getSettings();
      if (typeof settings.crossfadeSeconds === 'number') {
        this.crossfadeSeconds = settings.crossfadeSeconds;
      }
      if (typeof settings.volume === 'number') {
        this.volume = settings.volume;
      }
      if (typeof settings.audioOutputSinkId === 'string' && settings.audioOutputSinkId.trim()) {
        this.sinkId = settings.audioOutputSinkId.trim();
      }
    }
  }

  on(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event].push(cb);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[AudioEngine] Listener error on ${event}:`, e);
        }
      });
    }
  }

  initContext() {
    if (this.audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[AudioEngine] Web Audio API not supported in this environment');
      return;
    }

    this.audioCtx = new AudioContextClass();

    this.inputGainNode = this.audioCtx.createGain();
    this.inputGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

    this.outputGainNode = this.audioCtx.createGain();
    this.outputGainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    this.masterGain = this.outputGainNode; // Alias por compatibilidade

    // AnalyserNode único calibrado (fftSize = 128 -> 64 bins, smoothing = 0.8)
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.freqDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    // Encadeamento de 10 BiquadFilterNode para equalizador acústico
    const EQ_CONFIGS = [
      { freq: 40, type: 'lowshelf' },
      { freq: 62, type: 'peaking', q: 1.4 },
      { freq: 125, type: 'peaking', q: 1.4 },
      { freq: 250, type: 'peaking', q: 1.4 },
      { freq: 500, type: 'peaking', q: 1.4 },
      { freq: 1000, type: 'peaking', q: 1.4 },
      { freq: 2000, type: 'peaking', q: 1.4 },
      { freq: 4000, type: 'peaking', q: 1.4 },
      { freq: 8000, type: 'peaking', q: 1.4 },
      { freq: 16000, type: 'highshelf' }
    ];

    this.eqFilters = EQ_CONFIGS.map((cfg, i) => {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = cfg.type;
      filter.frequency.setValueAtTime(cfg.freq, this.audioCtx.currentTime);
      if (cfg.q) filter.Q.setValueAtTime(cfg.q, this.audioCtx.currentTime);
      const initialGain = this.storedBands[i] || 0;
      filter.gain.setValueAtTime(initialGain, this.audioCtx.currentTime);
      return filter;
    });

    // Topologia em Série Estrita:
    // AudioSourceNode -> InputGainNode -> Biquad[0] -> ... -> Biquad[9] -> AnalyserNode -> OutputGainNode -> destination
    let prevNode = this.inputGainNode;
    for (const filter of this.eqFilters) {
      prevNode.connect(filter);
      prevNode = filter;
    }
    prevNode.connect(this.analyserNode);
    this.analyserNode.connect(this.outputGainNode);
    this.outputGainNode.connect(this.audioCtx.destination);

    if (this.sinkId && this.sinkId !== 'default' && typeof this.audioCtx.setSinkId === 'function') {
      this.audioCtx.setSinkId(this.sinkId).catch(() => {});
    }

    this.deckA = this._createDeck('A');
    this.deckB = this._createDeck('B');

    // Deck A starts with gain 1.0, Deck B with 0.0
    this.deckA.gainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    this.deckB.gainNode.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

    this._startProgressMonitor();
  }

  _createDeck(id) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    if (this.sinkId && this.sinkId !== 'default' && typeof audio.setSinkId === 'function') {
      audio.setSinkId(this.sinkId).catch(() => {});
    }

    const gainNode = this.audioCtx.createGain();
    gainNode.connect(this.inputGainNode);

    const sourceNode = this.audioCtx.createMediaElementSource(audio);
    sourceNode.connect(gainNode);

    const deck = {
      id,
      audio,
      gainNode,
      sourceNode,
      track: null,
      halfLogged: false
    };

    audio.addEventListener('ended', () => this._handleDeckEnded(id));
    audio.addEventListener('error', (e) => {
      console.error(`[AudioEngine] Deck ${id} error:`, e);
    });

    return deck;
  }

  /**
   * Sets the audio output sink device ID across AudioContext and HTMLAudioElement decks.
   * @param {string} sinkId Device identifier ('default' or specific device ID)
   * @returns {Promise<boolean>}
   */
  async setSinkId(sinkId) {
    this.sinkId = sinkId || 'default';
    let applied = false;

    try {
      if (this.audioCtx && typeof this.audioCtx.setSinkId === 'function') {
        await this.audioCtx.setSinkId(this.sinkId);
        applied = true;
      }
    } catch (err) {
      console.warn('[AudioEngine] audioCtx.setSinkId failed:', err);
    }

    try {
      if (this.deckA?.audio && typeof this.deckA.audio.setSinkId === 'function') {
        await this.deckA.audio.setSinkId(this.sinkId);
        applied = true;
      }
    } catch (err) {
      console.warn('[AudioEngine] deckA.audio.setSinkId failed:', err);
    }

    try {
      if (this.deckB?.audio && typeof this.deckB.audio.setSinkId === 'function') {
        await this.deckB.audio.setSinkId(this.sinkId);
        applied = true;
      }
    } catch (err) {
      console.warn('[AudioEngine] deckB.audio.setSinkId failed:', err);
    }

    if (this.storageManager?.updateSettings) {
      this.storageManager.updateSettings({ audioOutputSinkId: this.sinkId });
    }

    this.emit('sinkChange', { sinkId: this.sinkId });
    return applied;
  }

  /**
   * Configura ou inspeciona o pipeline da topologia de áudio.
   * @param {HTMLMediaElement} [audioElement]
   * @returns {{ context: AudioContext, analyser: AnalyserNode, bands: BiquadFilterNode[], outputGain: GainNode }}
   */
  setupAudioPipeline(audioElement) {
    this.initContext();
    if (audioElement && this.audioCtx && this.inputGainNode) {
      try {
        const srcNode = this.audioCtx.createMediaElementSource(audioElement);
        srcNode.connect(this.inputGainNode);
      } catch (e) {
        // Ignora caso o elemento já tenha um MediaElementSourceNode vinculado
      }
    }
    return {
      context: this.audioCtx,
      analyser: this.analyserNode,
      bands: this.eqFilters,
      outputGain: this.outputGainNode
    };
  }

  /**
   * Extração de Energia Rítmica (BPM e Graves) em tempo real:
   * Lê os primeiros bins correspondentes a sub-graves e graves (20 Hz a 160 Hz)
   * sem alocação dinâmica de memória no loop de animação.
   * @returns {number} Float normalizado de graves entre 0.0 e 1.0
   */
  getFrequencyEnergy() {
    if (!this.analyserNode || !this.isPlaying || !this.freqDataArray) return 0;
    this.analyserNode.getByteFrequencyData(this.freqDataArray);
    // Bins 0..3 cobrem a faixa de sub-graves e graves (~20Hz - ~160Hz) com fftSize 128
    let sum = 0;
    const count = Math.min(4, this.freqDataArray.length);
    for (let i = 0; i < count; i++) {
      sum += this.freqDataArray[i];
    }
    return Math.max(0, Math.min(1, sum / (count * 255)));
  }

  /**
   * Define o ganho de uma banda do equalizador em dB.
   * @param {number} bandIndex
   * @param {number} gainDb
   */
  setBandGain(bandIndex, gainDb) {
    this.updateEqualizerGain(bandIndex, gainDb);
  }

  /**
   * Updates gain of a specific equalizer frequency band using exponential time constant
   * to guarantee smooth, pop-free and click-free audio modulation.
   */
  updateEqualizerGain(bandIndex, gainDb) {
    if (!this.eqFilters || !this.eqFilters[bandIndex] || !this.audioCtx) return;
    const clamped = Math.max(-12, Math.min(12, gainDb));
    this.storedBands[bandIndex] = clamped;
    if (!this.eqBypass) {
      this.eqFilters[bandIndex].gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.02);
    }
  }

  /**
   * Chaveamento de Bypass Sem Ruídos:
   * Quando o equalizador estiver desativado (bypass = true), todos os nós biquad
   * têm seus ganhos zerados via rampa de tempo curta (0.015s), mantendo o fluxo
   * do sinal e o AnalyserNode perfeitamente ativos e sem cliques acústicos.
   * Ao reativar, restaura os ganhos em dB do preset ou configuração manual.
   * @param {boolean} bypass
   */
  setEqualizerBypass(bypass) {
    this.eqBypass = Boolean(bypass);
    if (!this.eqFilters || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    for (let i = 0; i < this.eqFilters.length; i++) {
      const targetGain = this.eqBypass ? 0 : (this.storedBands[i] || 0);
      this.eqFilters[i].gain.setTargetAtTime(targetGain, now, 0.015);
    }
  }

  /**
   * Applies an acoustic equalizer preset across all 10 frequency bands.
   */
  setEqualizerPreset(presetName) {
    const presets = {
      'Plano':            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      'Graves Fortes':    [8, 7, 5, 3, 1, 0, 0, 0, 0, 0],
      'Eletrônica / Pop': [6, 5, 2, -1, -2, -1, 2, 4, 6, 7],
      'Rock':             [4, 3, 4, 3, -1, 1, 3, 5, 4, 3],
      'Acústico / Voz':   [-3, -2, 0, 2, 4, 5, 4, 2, 1, 0]
    };
    const gains = presets[presetName] || presets['Plano'];
    gains.forEach((gain, i) => this.updateEqualizerGain(i, gain));
  }

  getActiveDeck() {
    return this.activeDeckId === 'A' ? this.deckA : this.deckB;
  }

  getStandbyDeck() {
    return this.activeDeckId === 'A' ? this.deckB : this.deckA;
  }

  async playTrack(track, offsetTime = 0) {
    this.initContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    if (!track) return;

    // If currently crossfading, cancel and clean up
    if (this.isCrossfading) {
      this._cancelCrossfade();
    }

    const active = this.getActiveDeck();
    const standby = this.getStandbyDeck();

    // Reset standby
    standby.audio.pause();
    standby.audio.currentTime = 0;
    standby.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    standby.gainNode.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
    standby.track = null;
    standby.halfLogged = false;

    // Setup active
    active.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    active.gainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    active.track = track;
    active.halfLogged = false;

    active.audio.src = track.filePath.startsWith('file://') ? track.filePath : `file://${track.filePath}`;
    active.audio.currentTime = offsetTime;

    try {
      await active.audio.play();
      this.isPlaying = true;
      this.emit('stateChange', { isPlaying: true, isCrossfading: false, volume: this.volume });
      this.emit('trackChange', { track, deck: active.id });
    } catch (err) {
      console.error('[AudioEngine] Play failed:', err);
    }
  }

  pause() {
    const active = this.getActiveDeck();
    const standby = this.getStandbyDeck();

    if (active && active.audio) active.audio.pause();
    if (this.isCrossfading && standby && standby.audio) {
      standby.audio.pause();
    }
    this.isPlaying = false;
    this.emit('stateChange', { isPlaying: false, isCrossfading: this.isCrossfading, volume: this.volume });
  }

  async resume() {
    this.initContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const active = this.getActiveDeck();
    const standby = this.getStandbyDeck();

    if (active && active.track) {
      try {
        await active.audio.play();
        if (this.isCrossfading && standby && standby.track) {
          await standby.audio.play();
        }
        this.isPlaying = true;
        this.emit('stateChange', { isPlaying: true, isCrossfading: this.isCrossfading, volume: this.volume });
      } catch (err) {
        console.error('[AudioEngine] Resume failed:', err);
      }
    } else {
      // If nothing loaded, try playing current from queue
      const current = this.queueManager?.getCurrentTrack();
      if (current) {
        await this.playTrack(current);
      }
    }
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  seek(seconds) {
    const active = this.getActiveDeck();
    if (!active || !active.audio || isNaN(active.audio.duration)) return;

    const clamped = Math.max(0, Math.min(seconds, active.audio.duration));
    active.audio.currentTime = clamped;

    // Check if seek exited or entered the crossfade window
    const remaining = active.audio.duration - clamped;
    if (this.isCrossfading && remaining > this.crossfadeSeconds) {
      this._cancelCrossfade();
    }
  }

  setMasterVolume(level) {
    this.setVolume(level);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(vol, 1));
    if (this.audioCtx && this.outputGainNode) {
      this.outputGainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.outputGainNode.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.005);
    }
    if (this.storageManager) {
      this.storageManager.updateSettings({ volume: this.volume });
    }
    this.emit('stateChange', { isPlaying: this.isPlaying, isCrossfading: this.isCrossfading, volume: this.volume });
  }

  setCrossfade(seconds) {
    this.crossfadeSeconds = Math.max(0, Math.min(seconds, 12));
    if (this.storageManager) {
      this.storageManager.updateSettings({ crossfadeSeconds: this.crossfadeSeconds });
    }
    this.emit('crossfadeStatus', { crossfadeSeconds: this.crossfadeSeconds });
  }

  async next() {
    if (!this.queueManager) return;
    const nextTrack = this.queueManager.advanceNext();
    if (nextTrack) {
      await this.playTrack(nextTrack);
    } else {
      this.pause();
    }
  }

  async previous() {
    const active = this.getActiveDeck();
    // If more than 3 seconds in, restart track
    if (active && active.audio && active.audio.currentTime > 3) {
      this.seek(0);
      return;
    }
    if (!this.queueManager) return;
    const prevTrack = this.queueManager.advancePrevious();
    if (prevTrack) {
      await this.playTrack(prevTrack);
    }
  }

  _startProgressMonitor() {
    if (this._monitorInterval) clearInterval(this._monitorInterval);

    this._monitorInterval = setInterval(() => {
      if (!this.isPlaying) return;

      const active = this.getActiveDeck();
      if (!active || !active.audio || !active.track) return;

      const curTime = active.audio.currentTime;
      const dur = active.audio.duration;

      if (!dur || isNaN(dur) || dur <= 0) return;

      // 1. Check 50% threshold for play_count metric
      if (!active.halfLogged && curTime >= dur * 0.5) {
        active.halfLogged = true;
        this.emit('trackPlayedHalf', { track: active.track });
        if (this.storageManager) {
          this.storageManager.incrementPlayCount(active.track.filePath);
        }
      }

      // 2. Emit progress
      this.emit('timeupdate', {
        currentTime: curTime,
        duration: dur,
        progress: curTime / dur,
        activeDeck: active.id
      });

      // 3. Crossfade check
      const remaining = dur - curTime;
      const effectiveCrossfade = Math.min(this.crossfadeSeconds, dur * 0.4);

      if (
        this.crossfadeSeconds > 0 &&
        !this.isCrossfading &&
        remaining <= effectiveCrossfade &&
        remaining > 0.1
      ) {
        this._startCrossfade(remaining);
      }
    }, 150);
  }

  async _startCrossfade(durationSeconds) {
    if (!this.queueManager || this.isCrossfading) return;
    const nextTrack = this.queueManager.peekNextTrack();
    if (!nextTrack) return;

    this.isCrossfading = true;
    const active = this.getActiveDeck();
    const standby = this.getStandbyDeck();
    const now = this.audioCtx.currentTime;
    const rampTime = Math.max(0.2, durationSeconds);

    // Prepare standby deck
    standby.track = nextTrack;
    standby.halfLogged = false;
    standby.audio.src = nextTrack.filePath.startsWith('file://') ? nextTrack.filePath : `file://${nextTrack.filePath}`;
    standby.audio.currentTime = 0;

    // Crossfade Gain Curves: Active 1.0 -> 0.0, Standby 0.0 -> 1.0
    standby.gainNode.gain.cancelScheduledValues(now);
    standby.gainNode.gain.setValueAtTime(0.001, now);
    standby.gainNode.gain.exponentialRampToValueAtTime(1.0, now + rampTime);

    active.gainNode.gain.cancelScheduledValues(now);
    active.gainNode.gain.setValueAtTime(1.0, now);
    active.gainNode.gain.exponentialRampToValueAtTime(0.001, now + rampTime);

    try {
      await standby.audio.play();
      this.emit('crossfadeStatus', { isCrossfading: true, nextTrack });

      // Advance the queue so the new track is current
      this.queueManager.advanceNext();
      this.emit('trackChange', { track: nextTrack, deck: standby.id });
    } catch (e) {
      console.warn('[AudioEngine] Error initiating crossfade next deck:', e);
      this._cancelCrossfade();
    }
  }

  _handleDeckEnded(endedDeckId) {
    if (this.isCrossfading) {
      // The old active deck finished its crossfade out
      if (endedDeckId === this.activeDeckId) {
        const oldActive = this.getActiveDeck();
        const now = this.audioCtx ? this.audioCtx.currentTime : 0;
        oldActive.audio.pause();
        oldActive.audio.currentTime = 0;
        oldActive.gainNode.gain.setValueAtTime(0.0, now);
        oldActive.track = null;
        oldActive.halfLogged = false;

        // Switch active deck role to the standby deck (which is now at gain 1.0)
        this.activeDeckId = this.activeDeckId === 'A' ? 'B' : 'A';
        this.isCrossfading = false;
        this.emit('crossfadeStatus', { isCrossfading: false });
        return;
      }
    }

    // Normal end without crossfade or single track ended
    const active = this.getActiveDeck();
    if (endedDeckId === active.id) {
      if (!active.halfLogged && active.track && this.storageManager) {
        active.halfLogged = true;
        this.storageManager.incrementPlayCount(active.track.filePath);
      }
      if (this.queueManager) {
        const next = this.queueManager.advanceNext();
        if (next) {
          this.playTrack(next);
        } else {
          this.isPlaying = false;
          this.emit('stateChange', { isPlaying: false, isCrossfading: false, volume: this.volume });
        }
      }
    }
  }

  _cancelCrossfade() {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const active = this.getActiveDeck();
    const standby = this.getStandbyDeck();

    active.gainNode.gain.cancelScheduledValues(now);
    active.gainNode.gain.setValueAtTime(1.0, now);

    standby.gainNode.gain.cancelScheduledValues(now);
    standby.gainNode.gain.setValueAtTime(0.0, now);
    standby.audio.pause();
    standby.audio.currentTime = 0;
    standby.track = null;
    standby.halfLogged = false;

    this.isCrossfading = false;
    this.emit('crossfadeStatus', { isCrossfading: false });
  }

  destroy() {
    if (this._monitorInterval) clearInterval(this._monitorInterval);
    if (this.deckA?.audio) this.deckA.audio.pause();
    if (this.deckB?.audio) this.deckB.audio.pause();
    if (this.audioCtx) this.audioCtx.close();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioEngine;
}
