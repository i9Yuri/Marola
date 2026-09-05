/**
 * QueueManager handles the playback queue, current index,
 * and playback modes (sequential, repeat-all, repeat-one, shuffle without immediate repeats).
 */
class QueueManager {
  constructor() {
    this.queue = []; // Array of track objects
    this.currentIndex = -1;
    this.repeatMode = 'repeat-all'; // 'sequential' | 'repeat-all' | 'repeat-one'
    this.shuffle = false;
    this.shuffleHistory = []; // Tracks played in current shuffle cycle
    this.shuffleRemaining = []; // Tracks yet to play in current shuffle cycle
    this.listeners = {
      queueChanged: [],
      currentTrackChanged: [],
      modeChanged: []
    };
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
          console.error(`[QueueManager] Error in listener for ${event}:`, e);
        }
      });
    }
  }

  setQueue(tracks, startIndex = 0) {
    this.queue = Array.isArray(tracks) ? [...tracks] : [];
    this.currentIndex = (startIndex >= 0 && startIndex < this.queue.length) ? startIndex : (this.queue.length > 0 ? 0 : -1);
    this._resetShuffle();
    this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
    this.emit('currentTrackChanged', this.getCurrentTrack());
  }

  addTrack(track) {
    if (!track) return;
    this.queue.push(track);
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
      this.emit('currentTrackChanged', this.getCurrentTrack());
    }
    this._updateShufflePool();
    this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
  }

  addTracks(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    this.queue.push(...tracks);
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
      this.emit('currentTrackChanged', this.getCurrentTrack());
    }
    this._updateShufflePool();
    this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
  }

  removeTrack(index) {
    if (index < 0 || index >= this.queue.length) return null;
    const removed = this.queue.splice(index, 1)[0];

    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
      if (this.currentIndex >= this.queue.length) {
        this.currentIndex = this.queue.length - 1;
      }
      this.emit('currentTrackChanged', this.getCurrentTrack());
    }

    this._resetShuffle();
    this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
    return removed;
  }

  moveTrack(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.queue.length) return;
    if (toIndex < 0 || toIndex >= this.queue.length) return;
    if (fromIndex === toIndex) return;

    const currentTrack = this.getCurrentTrack();
    const item = this.queue.splice(fromIndex, 1)[0];
    this.queue.splice(toIndex, 0, item);

    // Keep current index tracking the same current track if possible
    if (currentTrack) {
      this.currentIndex = this.queue.findIndex(t => t.filePath === currentTrack.filePath);
    }

    this._resetShuffle();
    this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
  }

  clear() {
    this.queue = [];
    this.currentIndex = -1;
    this._resetShuffle();
    this.emit('queueChanged', { queue: this.queue, currentIndex: -1 });
    this.emit('currentTrackChanged', null);
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  jumpTo(index) {
    if (index >= 0 && index < this.queue.length) {
      this.currentIndex = index;
      if (this.shuffle) {
        // Record in history
        const tr = this.getCurrentTrack();
        if (tr) {
          this.shuffleHistory.push(tr.filePath);
          this.shuffleRemaining = this.shuffleRemaining.filter(p => p !== tr.filePath);
        }
      }
      this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
      this.emit('currentTrackChanged', this.getCurrentTrack());
      return this.getCurrentTrack();
    }
    return null;
  }

  setRepeatMode(mode) {
    if (['sequential', 'repeat-all', 'repeat-one'].includes(mode)) {
      this.repeatMode = mode;
      this.emit('modeChanged', { repeatMode: this.repeatMode, shuffle: this.shuffle });
    }
  }

  toggleRepeatMode() {
    const cycle = {
      'repeat-all': 'repeat-one',
      'repeat-one': 'sequential',
      'sequential': 'repeat-all'
    };
    this.setRepeatMode(cycle[this.repeatMode] || 'repeat-all');
    return this.repeatMode;
  }

  setShuffle(enabled) {
    this.shuffle = !!enabled;
    this._resetShuffle();
    this.emit('modeChanged', { repeatMode: this.repeatMode, shuffle: this.shuffle });
    return this.shuffle;
  }

  toggleShuffle() {
    return this.setShuffle(!this.shuffle);
  }

  /**
   * Calculates the next track without advancing the queue (used by crossfade lookahead)
   */
  peekNextTrack() {
    if (this.queue.length === 0) return null;

    if (this.repeatMode === 'repeat-one') {
      return this.getCurrentTrack();
    }

    if (this.shuffle) {
      if (this.queue.length === 1) return this.queue[0];
      // Pick next candidate from shuffleRemaining that is not current track
      const currentPath = this.getCurrentTrack()?.filePath;
      let pool = this.shuffleRemaining.filter(p => p !== currentPath);
      if (pool.length === 0) {
        // Recycle pool avoiding immediate repeat
        pool = this.queue.map(t => t.filePath).filter(p => p !== currentPath);
      }
      if (pool.length > 0) {
        const nextPath = pool[0];
        return this.queue.find(t => t.filePath === nextPath) || null;
      }
      return null;
    }

    // Normal sequential or repeat-all
    const nextIdx = this.currentIndex + 1;
    if (nextIdx < this.queue.length) {
      return this.queue[nextIdx];
    } else if (this.repeatMode === 'repeat-all') {
      return this.queue[0];
    }
    return null;
  }

  /**
   * Advances to next track based on current modes.
   * Returns next track or null if end of sequential queue.
   */
  advanceNext() {
    if (this.queue.length === 0) return null;

    if (this.repeatMode === 'repeat-one') {
      this.emit('currentTrackChanged', this.getCurrentTrack());
      return this.getCurrentTrack();
    }

    if (this.shuffle) {
      if (this.queue.length === 1) {
        return this.getCurrentTrack();
      }
      const currentPath = this.getCurrentTrack()?.filePath;
      let pool = this.shuffleRemaining.filter(p => p !== currentPath);
      if (pool.length === 0) {
        this._resetShuffle();
        pool = this.shuffleRemaining.filter(p => p !== currentPath);
      }
      if (pool.length > 0) {
        // Pick random from remaining
        const randIdx = Math.floor(Math.random() * pool.length);
        const selectedPath = pool[randIdx];
        this.shuffleRemaining = this.shuffleRemaining.filter(p => p !== selectedPath);
        this.shuffleHistory.push(selectedPath);

        this.currentIndex = this.queue.findIndex(t => t.filePath === selectedPath);
        this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
        this.emit('currentTrackChanged', this.getCurrentTrack());
        return this.getCurrentTrack();
      }
    }

    // Sequential / Repeat-all
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
    } else if (this.repeatMode === 'repeat-all') {
      this.currentIndex = 0;
    } else {
      // Sequential end reached
      return null;
    }

    this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
    this.emit('currentTrackChanged', this.getCurrentTrack());
    return this.getCurrentTrack();
  }

  /**
   * Goes back to previous track.
   */
  advancePrevious() {
    if (this.queue.length === 0) return null;

    if (this.repeatMode === 'repeat-one') {
      this.emit('currentTrackChanged', this.getCurrentTrack());
      return this.getCurrentTrack();
    }

    if (this.shuffle && this.shuffleHistory.length > 1) {
      // Pop current, go back to previous played in history
      this.shuffleHistory.pop();
      const prevPath = this.shuffleHistory[this.shuffleHistory.length - 1];
      const prevIdx = this.queue.findIndex(t => t.filePath === prevPath);
      if (prevIdx !== -1) {
        this.currentIndex = prevIdx;
        this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
        this.emit('currentTrackChanged', this.getCurrentTrack());
        return this.getCurrentTrack();
      }
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else if (this.repeatMode === 'repeat-all') {
      this.currentIndex = this.queue.length - 1;
    } else {
      this.currentIndex = 0;
    }

    this.emit('queueChanged', { queue: this.queue, currentIndex: this.currentIndex });
    this.emit('currentTrackChanged', this.getCurrentTrack());
    return this.getCurrentTrack();
  }

  _resetShuffle() {
    const currentPath = this.getCurrentTrack()?.filePath;
    this.shuffleRemaining = this.queue
      .map(t => t.filePath)
      .filter(p => p !== currentPath);
    this.shuffleHistory = currentPath ? [currentPath] : [];
  }

  _updateShufflePool() {
    const currentTrackIds = new Set(this.queue.map(t => t.filePath));
    const played = new Set(this.shuffleHistory);
    this.shuffleRemaining = Array.from(currentTrackIds).filter(id => !played.has(id));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QueueManager;
}
