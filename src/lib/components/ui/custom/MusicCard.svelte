<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import ProgressBar from './ProgressBar.svelte';
  import IcRoundPlayArrow from '~icons/ic/round-play-arrow';
  import IcRoundPause from '~icons/ic/round-pause';
  import IcRoundContentCopy from '~icons/ic/round-content-copy';
  import { slide } from 'svelte/transition';
  import { playingTrackId } from '$lib/stores/playingTrackStore';
  import { audioCache } from '$lib/stores/audioCacheStore';
  import { audioManager } from '$lib/stores/audioManager';
  import { FetchError } from 'ofetch';

  interface MusicTrack {
    id: string;
    name: string;
    creator: string;
    category: string;
    tags?: string[];
    length: string;
    duration?: number;
    audioUrl?: string;
    isPreviewable?: boolean;
  }

  let {
    track,
    isPlaying = false,
    isExpanded = false,
    currentTime = 0,
    onPlay,
    onPause,
    onSeek,
    onRowClick
  }: {
    track: MusicTrack;
    isPlaying?: boolean;
    isExpanded?: boolean;
    currentTime?: number;
    onPlay?: (track: MusicTrack) => void;
    onPause?: () => void;
    onSeek?: (time: number) => void;
    onRowClick?: (track: MusicTrack) => void;
  } = $props();

  // Audio preview state
  let audioElement: HTMLAudioElement | null = null;
  let audioError = $state<string | null>(null);
  let isLoadingPreview = $state(false);
  let isDownloading = $state(false);
  let localCurrentTime = $state(0);
  let audioDuration = $state<number | null>(null);
  let downloadProgress = $state(0);

  // Service worker progress tracking
  let currentDownloadUrl = $state<string | null>(null);

  // Effect to ensure isExpanded is false if not playing
  $effect(() => {
    if (!isPlaying && isExpanded) {
      isExpanded = false;
    }
  });

  // Listen for service worker progress messages
  function handleServiceWorkerMessage(event: MessageEvent) {
    if (event.data?.type === 'download-progress' && event.data.url === currentDownloadUrl) {
      downloadProgress = event.data.progress;
    }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
  }

  // Download audio with progress tracking via service worker
  async function downloadAudio(audioUrl: string, trackId?: string): Promise<string | null> {
    // Check if already cached
    if (trackId) {
      const cachedUrl = audioCache.getCachedAudio(trackId);
      if (cachedUrl) {
        console.log(`Using cached audio for track ${trackId}`);
        return cachedUrl;
      }
    }

    try {
      // Reset and start download
      isDownloading = true;
      downloadProgress = 0;
      currentDownloadUrl = audioUrl;

      // Let the service worker handle the download and progress tracking
      const response = await fetch(audioUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Convert response to blob
      const audioBlob = await response.blob();
      const blobUrl = URL.createObjectURL(audioBlob);

      // Cache if needed
      if (trackId) {
        try {
          await audioCache.cacheAudio(trackId, blobUrl);
        } catch (cacheError) {
          console.warn('Cache failed:', cacheError);
        }
      }

      downloadProgress = 100;
      return blobUrl;
    } catch (error) {
      console.error('Download failed:', error);
      return null;
    } finally {
      isDownloading = false;
      currentDownloadUrl = null;
    }
  }

  // Play audio from blob URL
  async function playAudioFromBlob(blobUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (audioElement) {
        audioElement.pause();
        audioManager.unregister(`musiccard-${track.id}`);
        audioElement = null;
      }

      audioElement = new Audio(blobUrl);
      audioElement.preload = 'metadata';
      
      // Register the audio element with the manager
      audioManager.register(`musiccard-${track.id}`, audioElement, track.id);

      const setupCleanup = () => {
        audioElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioElement?.removeEventListener('canplay', onCanPlay);
        audioElement?.removeEventListener('error', onError);
      };

      const onLoadedMetadata = () => {
        if (audioElement && audioElement.duration && !isNaN(audioElement.duration)) {
          audioDuration = audioElement.duration;
        }
      };

      const onCanPlay = async () => {
        // Set up persistent time tracking and ended event listeners
        audioElement?.addEventListener('timeupdate', onTimeUpdate);
        audioElement?.addEventListener('ended', onEnded);

        try {
          await audioElement?.play();
          
          // Set Media Session metadata when audio starts playing
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: track.name,
              artist: track.category,
              album: "Blockate Audio Browser"
            });
            navigator.mediaSession.playbackState = 'playing';
          }
          
          setupCleanup();
          resolve(true);
        } catch (error) {
          console.warn('Audio play failed:', error);
          setupCleanup();
          resolve(false);
        }
      };

      const onError = () => {
        console.error('Audio load failed for blob URL');
        setupCleanup();
        resolve(false);
      };

      const onTimeUpdate = () => {
        if (audioElement) {
          localCurrentTime = audioElement.currentTime;
        }
      };

      const onEnded = () => {
        // Audio finished playing
        isExpanded = false;
        onPause?.();
        playingTrackId.set(null);
        localCurrentTime = 0;
        
        // Clear Media Session metadata when audio ends
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null;
        }
      };

      audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
      audioElement.addEventListener('canplay', onCanPlay);
      audioElement.addEventListener('error', onError);

      // Set a timeout to avoid hanging
      setTimeout(() => {
        setupCleanup();
        resolve(false);
      }, 5000); // 5 second timeout for blob playback
    });
  }

  // Audio preview functionality (same as MusicRow)
  async function tryPlayAudio(audioUrl: string, trackId?: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (audioElement) {
        audioElement.pause();
        audioManager.unregister(`musiccard-${track.id}`);
        audioElement = null;
      }

      // Check if we have a cached blob for this track
      let finalAudioUrl = audioUrl;
      let cachePromise: Promise<string> | null = null;
      
      if (trackId) {
        const cachedUrl = audioCache.getCachedAudio(trackId);
        if (cachedUrl) {
          console.log(`Using cached audio for track ${trackId}`);
          finalAudioUrl = cachedUrl;
        } else {
          // Start caching in the background and keep the promise for fallback
          console.log(`Starting background cache for track ${trackId}`);
          cachePromise = audioCache.cacheAudio(trackId, audioUrl);
          // Use original URL for immediate streaming
          finalAudioUrl = audioUrl;
        }
      }

      audioElement = new Audio(finalAudioUrl);
      audioElement.preload = 'auto';
      
      // Register the audio element with the manager
      audioManager.register(`musiccard-${track.id}`, audioElement, track.id);
      
      const setupCleanup = () => {
        audioElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioElement?.removeEventListener('canplay', onCanPlay);
        audioElement?.removeEventListener('error', onError);
        audioElement?.removeEventListener('progress', onProgress);
      };

      const onLoadedMetadata = () => {
        if (audioElement && audioElement.duration && !isNaN(audioElement.duration)) {
          audioDuration = audioElement.duration;
        }
      };

      const onProgress = () => {
        if (audioElement && audioElement.buffered.length > 0) {
          const bufferedEnd = audioElement.buffered.end(audioElement.buffered.length - 1);
          const duration = audioElement.duration;
          if (duration > 0) {
            downloadProgress = (bufferedEnd / duration) * 100;
          }
        }
      };

      const onCanPlay = async () => {
        audioElement?.addEventListener('timeupdate', onTimeUpdate);
        audioElement?.addEventListener('ended', onEnded);
        audioElement?.addEventListener('progress', onProgress);
        
        try {
          await audioElement?.play();
          audioElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
          audioElement?.removeEventListener('canplay', onCanPlay);
          audioElement?.removeEventListener('error', onError);
          resolve(true);
        } catch (error) {
          console.warn('Audio play failed:', error);
          setupCleanup();
          resolve(false);
        }
      };

      const onError = async () => {
        console.warn('Audio load failed for URL:', finalAudioUrl);
        
        if (cachePromise && trackId && finalAudioUrl === audioUrl) {
          console.log(`Streaming failed for track ${trackId}, waiting for background cache...`);
          try {
            const cachedUrl = await cachePromise;
            if (cachedUrl !== audioUrl) {
              console.log(`Retrying with cached blob for track ${trackId}`);
              setupCleanup();
              
              audioElement = new Audio(cachedUrl);
              audioElement.preload = 'auto';
              
              audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
              audioElement.addEventListener('canplay', onCanPlay);
              audioElement.addEventListener('error', () => {
                setupCleanup();
                console.error('Cached audio also failed to load');
                resolve(false);
              });
              audioElement.addEventListener('progress', onProgress);
              return;
            }
          } catch (error) {
            console.warn('Background cache also failed:', error);
          }
        }
        
        setupCleanup();
        resolve(false);
      };

      const onTimeUpdate = () => {
        if (audioElement) {
          localCurrentTime = audioElement.currentTime;
        }
      };

      const onEnded = () => {
        isExpanded = false;
        onPause?.();
        playingTrackId.set(null);
        localCurrentTime = 0;
      };

      audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
      audioElement.addEventListener('canplay', onCanPlay);
      audioElement.addEventListener('error', onError);
      audioElement.addEventListener('progress', onProgress);
      
      setTimeout(() => {
        setupCleanup();
        resolve(false);
      }, 10000);
    });
  }

  async function fetchPreviewUrl(trackId: string): Promise<string | null> {
    try {
      const response = await fetch('/api/v1/audio/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([trackId])
      });

      if (!response.ok) {
        console.error('Preview API failed:', await response.text());
        return null;
      }

      const data = await response.json();
      return data[trackId] || null;
    } catch (error) {
      console.error('Error fetching preview URL:', error);
      return null;
    }
  }

  async function handlePlayPause(event: Event) {
    event.stopPropagation();

    if (isPlaying) {
      // Pause current audio
      if (audioElement) {
        audioElement.pause();
        audioManager.unregister(`musiccard-${track.id}`);
        audioElement = null;
      }
      isExpanded = false;
      onPause?.();
      playingTrackId.set(null);
      audioDuration = null;
      downloadProgress = 0;
      
      // Clear Media Session metadata when pausing
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
      return;
    }

    // Only proceed if track is previewable
    if (!isTrackPreviewable()) {
      audioError = 'Preview is not available for this track.';
      return;
    }

    isLoadingPreview = true;
    audioError = null;
    downloadProgress = 0;

    try {
      let audioUrl = track.audioUrl;
      let blobUrl: string | null = null;

      // Check if we have cached audio first
      const cachedUrl = audioCache.getCachedAudio(track.id);
      if (cachedUrl) {
        console.log(`Using cached audio for track ${track.id}`);
        audioUrl = cachedUrl;
      }
      // If no cached audio and no audioUrl, fetch from API
      else if (!audioUrl) {
        console.log('Fetching preview URL from API...');
        const fetchedUrl = await fetchPreviewUrl(track.id);
        if (!fetchedUrl) {
          audioError = 'No preview URL received, this audio may be moderated.';
          console.error('fetchPreviewUrl returned empty for track:', track.id);
          throw new Error(audioError);
        }
        audioUrl = fetchedUrl;
      }

      // If we have cached audio, play it directly; otherwise download first
      if (cachedUrl) {
        console.log('Playing cached audio...');
        const playSuccess = await playAudioFromBlob(cachedUrl);
        
        if (playSuccess) {
          isExpanded = true;
          onPlay?.(track);
          playingTrackId.set(track.id);
        } else {
          audioError = 'Cached audio playback failed.';
          console.error('Cached audio playback failed for track:', track.id);
        }
      } else {
        // Set downloading state and initial progress before starting download
        isDownloading = true;

        // Download the audio first
        console.log('Downloading audio before playback...');
        blobUrl = await downloadAudio(audioUrl, track.id);

        if (!blobUrl) {
          audioError = 'Failed to download audio file.';
          console.error('Download failed for track:', track.id);
          throw new Error(audioError);
        }

        // Now play the downloaded audio
        console.log('Playing downloaded audio...');
        const playSuccess = await playAudioFromBlob(blobUrl);

        if (playSuccess) {
          isExpanded = true;
          onPlay?.(track);
          playingTrackId.set(track.id);
        } else {
          audioError = 'Audio format not supported or playback failed.';
          console.error('Playback failed for track:', track.id);
        }
      }
    } catch (error) {
      if (!(error instanceof Error)) return;
      // If we already have a specific message, keep it; otherwise generic fallback
      if (!audioError) {
        audioError = `Unexpected error: ${error.message || error}`;
        console.error('Unexpected error in handlePlayPause:', error);
      }
    } finally {
      isLoadingPreview = false;
      isDownloading = false;
    }
  }

  function handleCardClick() {
    onRowClick?.(track);
  }

  function handleSeek(time: number) {
    if (audioElement) {
      audioElement.currentTime = time;
      localCurrentTime = time;
    }
    onSeek?.(time);
  }

  function parseDuration(lengthStr: string): number {
    const [minutes, seconds] = lengthStr.split(':').map(Number);
    return minutes * 60 + seconds;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }

  const duration = $derived(audioDuration || track.duration || parseDuration(track.length));

  // Check if track is previewable (either has isPreviewable flag or has cached audio)
  const isTrackPreviewable = $derived(() => {
    return track.isPreviewable || audioCache.getCachedAudio(track.id) !== null;
  });

  // Cleanup audio element when component is destroyed
  $effect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioManager.unregister(`musiccard-${track.id}`);
        audioElement = null;
      }
    };
  });

  // Stop audio when not playing
  $effect(() => {
    if (!isPlaying && audioElement) {
      audioElement.pause();
      audioManager.unregister(`musiccard-${track.id}`);
      audioElement = null;
    }
  });

  const isCached = $derived(audioCache.isCached(track.id));
</script>

<div class="bg-card rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
  <!-- Card Header -->
  <div class="flex items-start justify-between gap-3 mb-3">
    <div class="flex-1 min-w-0">
      <h3 class="font-medium text-foreground truncate text-base mb-1">{track.name}</h3>
      <div class="flex items-center gap-2">
        <p class="text-sm text-muted-foreground truncate">ID: {track.id}</p>
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0"
          onclick={(e) => {
            e.stopPropagation();
            copyToClipboard(track.id);
          }}
          title="Copy ID"
        >
          <IcRoundContentCopy class="h-3 w-3" />
        </Button>
      </div>
    </div>
    
    <!-- Play Button -->
    {#if isTrackPreviewable()}
      <div class="relative flex-shrink-0">
        <Button
          variant={isPlaying ? 'default' : 'outline'}
          size="icon"
          class="size-10 transition-colors rounded-full"
          onclick={handlePlayPause}
          disabled={isLoadingPreview}
        >
          {#if isLoadingPreview || isDownloading}
            <div class="size-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          {:else if isPlaying}
            <IcRoundPause class="size-5" />
          {:else}
            <IcRoundPlayArrow class="size-5" />
          {/if}
        </Button>
        
        <!-- Download progress ring -->
        {#if isDownloading}
          <svg
            class="pointer-events-none absolute inset-0 z-99 size-10 -rotate-90"
            viewBox="0 0 40 40"
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray="{Math.max(0, (downloadProgress / 100) * 113.1)} 113.1"
              class="text-primary z-99"
            />
          </svg>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Card Content -->
  <div class="space-y-2">
    <div class="text-sm">
      <span class="text-muted-foreground">Category: </span>
      <span class="text-foreground font-medium">{track.category}</span>
    </div>
    
    <!-- Tags Display -->
    {#if track.tags && track.tags.length > 0}
      <div class="text-sm">
        <span class="text-muted-foreground">Tags: </span>
        <div class="flex flex-wrap gap-1 mt-1">
          {#each track.tags as tag}
            <span class="inline-flex items-center px-2 py-1 bg-primary/10 text-primary rounded-md text-xs max-w-[120px] truncate" title={tag}>
              {tag}
            </span>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Expanded progress bar section -->
  {#if isExpanded}
    <div
      class="mt-4 pt-4 border-t border-border"
      transition:slide={{ duration: 300 }}
    >
      {#if audioError}
        <div class="text-sm text-red-500 py-2">
          {audioError}
        </div>
      {:else}
        <ProgressBar
          currentTime={localCurrentTime}
          {duration}
          onSeek={handleSeek}
        />
      {/if}
    </div>
  {/if}
</div>