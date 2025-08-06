import { writable } from 'svelte/store';

interface AudioElementInfo {
  id: string;
  element: HTMLAudioElement;
  trackId: string;
}

class AudioManager {
  private audioElements = new Map<string, AudioElementInfo>();
  private store = writable<AudioElementInfo[]>([]);

  // Register an audio element
  register(id: string, element: HTMLAudioElement, trackId: string) {
    this.audioElements.set(id, { id, element, trackId });
    this.updateStore();
  }

  // Unregister an audio element
  unregister(id: string) {
    this.audioElements.delete(id);
    this.updateStore();
  }

  // Pause all audio elements
  pauseAll() {
    for (const [, info] of this.audioElements) {
      try {
        if (info.element && !info.element.paused) {
          info.element.pause();
        }
      } catch (error) {
        console.warn(`Failed to pause audio element ${info.id}:`, error);
      }
    }
  }

  // Get all registered audio elements
  getAll() {
    return Array.from(this.audioElements.values());
  }

  // Get audio element by track ID
  getByTrackId(trackId: string) {
    for (const [, info] of this.audioElements) {
      if (info.trackId === trackId) {
        return info;
      }
    }
    return null;
  }

  // Subscribe to store updates
  subscribe(callback: (value: AudioElementInfo[]) => void) {
    return this.store.subscribe(callback);
  }

  private updateStore() {
    this.store.set(this.getAll());
  }
}

// Export singleton instance
export const audioManager = new AudioManager();