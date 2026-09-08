/**
 * AudioEngine - Dual-deck Web Audio API pipeline with real-time crossfade
 */
class AudioEngine {
  constructor(queueManager, storageManager) {
    this.queueManager = queueManager;
    this.storageManager = storageManager;

    this.audioCtx = null;
    this.masterGain = null;

    this.deckA = null;
    this.deckB = null;

    this.activeDeckId = 'A'; // 'A' or 'B'
    this.isCrossfading = false;
    this.crossfadeSeconds = 3; // 0 to 12s
    this.volume = 0.8;
    this.isPlaying = false;
    this.sinkId = 'default';

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
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    this.masterGain.connect(this.audioCtx.destination);

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
    gainNode.connect(this.masterGain);

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

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(vol, 1));
    if (this.audioCtx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
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
