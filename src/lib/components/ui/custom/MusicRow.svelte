<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import ProgressBar from './ProgressBar.svelte';
  import IcRoundPlayArrow from '~icons/ic/round-play-arrow';
  import IcRoundPause from '~icons/ic/round-pause';
  import IcRoundContentCopy from '~icons/ic/round-content-copy';
  import IconTablerChevronDown from '~icons/tabler/chevron-down';
  import IconTablerMusic from '~icons/tabler/music';
  import { toast } from "svelte-sonner";
  import { slide } from 'svelte/transition';
import { playingTrackId } from '$lib/stores/playingTrackStore';
import { audioCache } from '$lib/stores/audioCacheStore';
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
  let localCurrentTime = $state(0);
  let audioDuration = $state<number | null>(null);
  let downloadProgress = $state(0);

  // Effect to ensure isExpanded is false if not playing
  $effect(() => {
    if (!isPlaying && isExpanded) {
      isExpanded = false;
    }
  });

  // Audio preview functionality
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
      audioElement.preload = 'auto'; // Changed from 'metadata' to 'auto' to enable progress tracking
      
      const setupCleanup = () => {
        audioElement?.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioElement?.removeEventListener('canplay', onCanPlay);
        audioElement?.removeEventListener('error', onError);
        audioElement?.removeEventListener('progress', onProgress);
      };

      const onLoadedMetadata = () => {
        // Get duration as soon as metadata is loaded
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
        // Set up persistent time tracking and ended event listeners
        audioElement?.addEventListener('timeupdate', onTimeUpdate);
        audioElement?.addEventListener('ended', onEnded);
        // Keep progress listener active during playback
        audioElement?.addEventListener('progress', onProgress);
        
        try {
          await audioElement?.play();
          // Don't clean up progress listener immediately
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
        
        // If we have a cache promise and this was a streaming failure, wait for cache
        if (cachePromise && trackId && finalAudioUrl === audioUrl) {
          console.log(`Streaming failed for track ${trackId}, waiting for background cache...`);
          try {
            const cachedUrl = await cachePromise;
            if (cachedUrl !== audioUrl) { // Only retry if we got a different (blob) URL
              console.log(`Retrying with cached blob for track ${trackId}`);
              setupCleanup();
              
              // Retry with the cached blob URL
              audioElement = new Audio(cachedUrl);
              audioElement.preload = 'auto';
              
              // Set up the same event listeners but without the fallback logic
              audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
              audioElement.addEventListener('canplay', onCanPlay);
              audioElement.addEventListener('error', () => {
                setupCleanup();
                console.error('Cached audio also failed to load');
                resolve(false);
              });
              audioElement.addEventListener('progress', onProgress);
              return; // Don't resolve false yet, let the retry attempt complete
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
        // Audio finished playing
        isExpanded = false;
        onPause?.();
        playingTrackId.set(null);
        localCurrentTime = 0;
      };

      // Load metadata first to get duration and track progress
      audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
      audioElement.addEventListener('canplay', onCanPlay);
      audioElement.addEventListener('error', onError);
      audioElement.addEventListener('progress', onProgress);
      
      // Set a timeout to avoid hanging
      setTimeout(() => {
        setupCleanup();
        resolve(false);
      }, 10000); // 10 second timeout
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
    // Pause current audio
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

  // Only proceed if track is previewable
  if (!track.isPreviewable) {
    audioError = 'Preview is not available for this track.';
    toast.error(audioError);
    return;
  }

  isLoadingPreview = true;
  audioError = null;
  downloadProgress = 0;

  try {
    let audioUrl = track.audioUrl;
    let playSuccess = false;

    // Try to play existing audio URL first
    if (audioUrl) {
      playSuccess = await tryPlayAudio(audioUrl, track.id);
      if (!playSuccess) {
        console.warn(`Playback failed for cached URL: ${audioUrl}`);
      }
    }

    // If that failed or no URL exists, try to get one from the API
    if (!playSuccess) {
      console.log('Fetching new preview URL from API...');
      let newAudioUrl;
      try {
        newAudioUrl = await fetchPreviewUrl(track.id);
      } catch (fetchErr) {
        if (!(fetchErr instanceof FetchError)) return;
        audioError = `Could not fetch preview URL: ${fetchErr.message || fetchErr}`;
        console.error('Error fetching preview URL:', fetchErr);
        throw fetchErr; // jump to outer catch
      }

      if (!newAudioUrl) {
        audioError = 'No preview URL received, this audio may be moderated.';
        console.error('fetchPreviewUrl returned empty for track:', track.id);
        throw new Error(audioError);
      }

      audioUrl = newAudioUrl;
      playSuccess = await tryPlayAudio(audioUrl, track.id);
      if (!playSuccess) {
        console.error(`Playback failed for fetched URL: ${audioUrl}`);
      }
    }

    if (playSuccess) {
      isExpanded = true;
      onPlay?.(track);
      playingTrackId.set(track.id);
    } else {
      audioError = 'Audio format not supported or playback failed.';
      console.error('Final play attempt failed for track:', track.id);
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
    if (audioError) toast.error(audioError, {
      duration: 5000
    });
  }
}


  function handleRowClick() {
    onRowClick?.(track);
  }

  function handleSeek(time: number) {
    if (audioElement) {
      audioElement.currentTime = time;
      localCurrentTime = time;
    }
    onSeek?.(time);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowClick();
    }
  }

  function parseDuration(lengthStr: string): number {
    const [minutes, seconds] = lengthStr.split(':').map(Number);
    return minutes * 60 + seconds;
  }

  function stopPropagation<T extends Event>(handler: (event: T) => void) {
    return (e: T) => { e.stopPropagation(); handler(e); };
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
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

  // Add cache status indicator
  const isCached = $derived(audioCache.isCached(track.id));
</script>

<div
  class="group hover:bg-muted/50 transition-colors"
  onkeydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-label="Expand track details for {track.name} by {track.creator}"
>
  <!-- Regular track row -->
  <div class="grid grid-cols-[48px_132px_1fr_1fr_200px] gap-4 items-center px-4 py-1">
    {#if track.isPreviewable}
      <div class="relative ml-2">
        <Button
          variant={isPlaying ? 'default' : 'outline'}
          size="icon"
          class="size-8 transition-colors rounded-full"
          onclick={handlePlayPause}
          disabled={isLoadingPreview}
        >
          {#if isLoadingPreview}
            <div class="size-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          {:else if isPlaying}
            <IcRoundPause class="size-6" />
          {:else}
            <IcRoundPlayArrow class="size-6" />
          {/if}
        </Button>
        
        <!-- Download progress ring -->
        {#if downloadProgress > 0 && downloadProgress < 100}
          <svg
            class="absolute inset-0 size-8 -rotate-90 pointer-events-none z-99"
            viewBox="0 0 32 32"
          >
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray="{(downloadProgress / 100) * 87.96} 87.96"
              class="text-primary z-99"
            />
          </svg>
        {/if}
      </div>
    {:else}
      <div class="ml-2 size-8"></div>
    {/if}
    
    <div class="text-sm text-muted-foreground font-mono truncate">
      {track.id}
    </div>
    
    <div class="flex items-center gap-3 min-w-0">
      <span class="font-medium text-foreground truncate">{track.name}</span>
    </div>
    
    <div class="text-sm text-muted-foreground truncate">
      {track.category}
    </div>
    
    <!-- Tags Column -->
    <div class="flex items-center gap-1 min-w-0">
      {#if track.tags && track.tags.length > 0}
        <!-- Show first 3 tags -->
        {#each track.tags.slice(0, 3) as tag}
          <span class="inline-flex items-center px-2 py-1 bg-primary/10 text-primary rounded text-xs whitespace-nowrap">
            {tag}
          </span>
        {/each}
        
        <!-- Show more button if there are more than 3 tags -->
        {#if track.tags.length > 3}
          <Popover.Root>
            <Popover.Trigger>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                +{track.tags.length - 3} more
              </Button>
            </Popover.Trigger>
            <Popover.Content class="w-80 p-3">
              <div class="space-y-2">
                <h4 class="font-medium text-sm">All Tags</h4>
                <div class="flex flex-wrap gap-1">
                  {#each track.tags as tag}
                    <span class="inline-flex items-center px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      {tag}
                    </span>
                  {/each}
                </div>
              </div>
            </Popover.Content>
          </Popover.Root>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Expanded progress bar section -->
  {#if isExpanded}
    <div
      class="mt-2 px-4 pb-4"
      transition:slide={{ duration: 300 }}
    >
      <div class="flex items-center gap-4">
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
    </div>
  {/if}
</div>