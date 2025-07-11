<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import ProgressBar from './ProgressBar.svelte';
  import IcRoundPlayArrow from '~icons/ic/round-play-arrow';
  import IcRoundPause from '~icons/ic/round-pause';
  import { slide } from 'svelte/transition';
  import { playingTrackId } from '$lib/stores/playingTrackStore';
  import { audioCache } from '$lib/stores/audioCacheStore';

  interface MusicTrack {
    id: string;
    name: string;
    creator: string;
    tags: string;
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
  let localCurrentTime = $state(0);
  let audioDuration = $state<number | null>(null);
  let downloadProgress = $state(0);

  // Effect to ensure isExpanded is false if not playing
  $effect(() => {
    if (!isPlaying && isExpanded) {
      isExpanded = false;
    }
  });

  // Audio preview functionality (same as MusicRow)
  async function tryPlayAudio(audioUrl: string, trackId?: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (audioElement) {
        audioElement.pause();
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
      const response = await fetch('/api/audio/preview', {
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
      if (audioElement) {
        audioElement.pause();
        audioElement = null;
      }
      isExpanded = false;
      onPause?.();
      playingTrackId.set(null);
      audioDuration = null;
      downloadProgress = 0;
      return;
    }

    if (!track.isPreviewable) {
      return;
    }

    isLoadingPreview = true;
    audioError = null;
    downloadProgress = 0;
    
    try {
      let audioUrl = track.audioUrl;
      let playSuccess = false;

      if (audioUrl) {
        playSuccess = await tryPlayAudio(audioUrl, track.id);
      }

      if (!playSuccess) {
        console.log('Fetching new preview URL from API...');
        const newAudioUrl = await fetchPreviewUrl(track.id);
        
        if (newAudioUrl) {
          audioUrl = newAudioUrl;
          playSuccess = await tryPlayAudio(audioUrl, track.id);
        }
      }

      if (playSuccess) {
        isExpanded = true;
        onPlay?.(track);
        playingTrackId.set(track.id);
      } else {
        audioError = 'Audio cannot be played';
        console.error('Failed to play audio for track:', track.id);
      }
    } catch (error) {
      audioError = 'Audio cannot be played';
      console.error('Error in handlePlayPause:', error);
    } finally {
      isLoadingPreview = false;
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

  const duration = $derived(audioDuration || track.duration || parseDuration(track.length));

  // Cleanup audio element when component is destroyed
  $effect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement = null;
      }
    };
  });

  // Stop audio when not playing
  $effect(() => {
    if (!isPlaying && audioElement) {
      audioElement.pause();
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
      <p class="text-sm text-muted-foreground truncate">ID: {track.id}</p>
    </div>
    
    <!-- Play Button -->
    {#if track.isPreviewable}
      <div class="relative flex-shrink-0">
        <Button
          variant={isPlaying ? 'default' : 'outline'}
          size="icon"
          class="size-10 transition-colors rounded-full"
          onclick={handlePlayPause}
          disabled={isLoadingPreview}
        >
          {#if isLoadingPreview}
            <div class="size-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          {:else if isPlaying}
            <IcRoundPause class="size-5" />
          {:else}
            <IcRoundPlayArrow class="size-5" />
          {/if}
        </Button>
        
        <!-- Download progress ring -->
        {#if downloadProgress > 0 && downloadProgress < 100}
          <svg
            class="absolute inset-0 size-10 -rotate-90 pointer-events-none"
            viewBox="0 0 40 40"
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray="{(downloadProgress / 100) * 113.1} 113.1"
              class="text-primary"
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
      <span class="text-foreground font-medium">{track.tags}</span>
    </div>
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