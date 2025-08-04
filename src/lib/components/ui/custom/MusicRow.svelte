<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import ProgressBar from './ProgressBar.svelte';
  import IcRoundPlayArrow from '~icons/ic/round-play-arrow';
  import IcRoundPause from '~icons/ic/round-pause';
  import IcRoundContentCopy from '~icons/ic/round-content-copy';
  import IconTablerChevronDown from '~icons/tabler/chevron-down';
  import IconTablerMusic from '~icons/tabler/music';
  import { toast } from 'svelte-sonner';
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
        audioElement = null;
      }

      audioElement = new Audio(blobUrl);
      audioElement.preload = 'metadata';

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

  async function fetchPreviewUrl(trackId: string): Promise<string | null> {
    try {
      const response = await fetch('/api/v1/audio/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      let blobUrl: string | null = null;

      // First, try to get audio URL if we don't have one
      if (!audioUrl) {
        console.log('Fetching preview URL from API...');
        try {
          const fetchedUrl = await fetchPreviewUrl(track.id);
          if (!fetchedUrl) {
            audioError = 'No preview URL received, this audio may be moderated.';
            console.error('fetchPreviewUrl returned empty for track:', track.id);
            throw new Error(audioError);
          }
          audioUrl = fetchedUrl;
        } catch (fetchErr) {
          if (!(fetchErr instanceof FetchError)) return;
          audioError = `Could not fetch preview URL: ${fetchErr.message || fetchErr}`;
          console.error('Error fetching preview URL:', fetchErr);
          throw fetchErr;
        }
      }

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
      if (audioError) {
        toast.error(audioError, {
          duration: 5000
        });
      }
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
    return (e: T) => {
      e.stopPropagation();
      handler(e);
    };
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
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }
  });

  // Stop audio when not playing
  $effect(() => {
    if (!isPlaying && audioElement) {
      audioElement.pause();
      audioElement = null;
    }
  });
</script>

<div
  class="group hover:bg-muted/50 transition-colors"
  onkeydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-label="Expand track details for {track.name} by {track.creator}"
>
  <!-- Regular track row -->
  <div class="grid grid-cols-[48px_132px_1fr_1fr_200px] items-center gap-4 px-4 py-1">
    {#if track.isPreviewable}
      <div class="relative ml-2">
        <Button
          variant={isPlaying ? 'default' : 'outline'}
          size="icon"
          class="size-8 rounded-full transition-colors"
          onclick={handlePlayPause}
          disabled={isLoadingPreview}
        >
          {#if isLoadingPreview || isDownloading}
            <div
              class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            ></div>
          {:else if isPlaying}
            <IcRoundPause class="size-6" />
          {:else}
            <IcRoundPlayArrow class="size-6" />
          {/if}
        </Button>

        <!-- Download progress ring -->
        {#if isDownloading}
          <svg
            class="pointer-events-none absolute inset-0 z-99 size-8 -rotate-90"
            viewBox="0 0 32 32"
          >
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-dasharray="{Math.max(0, (downloadProgress / 100) * 87.96)} 87.96"
              class="text-primary z-99"
            />
          </svg>
        {/if}
      </div>
    {:else}
      <div class="ml-2 size-8"></div>
    {/if}

    <div class="text-muted-foreground truncate font-mono text-sm">
      {track.id}
    </div>

    <div class="flex min-w-0 items-center gap-3">
      <span class="text-foreground truncate font-medium">{track.name}</span>
    </div>

    <div class="text-muted-foreground truncate text-sm">
      {track.category}
    </div>

    <!-- Tags Column -->
    <div class="flex min-w-0 items-center gap-1 overflow-hidden">
      {#if track.tags && track.tags.length > 0}
        {@const maxTagLength = 12}
        {@const visibleTags = track.tags.filter(
          (tag, index) => tag.length <= maxTagLength && index < 3
        )}
        {@const hiddenTags = track.tags.filter(
          (tag, index) => tag.length > maxTagLength || index >= 3
        )}

        <!-- Show visible tags -->
        {#each visibleTags as tag}
          <span
            class="bg-primary/10 text-primary inline-flex items-center rounded px-2 py-1 text-xs whitespace-nowrap"
          >
            {tag}
          </span>
        {/each}

        <!-- Show more button if there are hidden tags -->
        {#if hiddenTags.length > 0}
          <Popover.Root>
            <Popover.Trigger onclick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                class="text-muted-foreground hover:text-foreground h-6 px-2 text-xs"
              >
                +{hiddenTags.length} more
              </Button>
            </Popover.Trigger>
            <Popover.Content class="w-80 p-3">
              <div class="space-y-2">
                <h4 class="text-sm font-medium">All Tags</h4>
                <div class="flex flex-wrap gap-1">
                  {#each track.tags as tag}
                    <span
                      class="bg-primary/10 text-primary inline-flex items-center rounded px-2 py-1 text-xs"
                    >
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
    <div class="mt-2 px-4 pb-4" transition:slide={{ duration: 300 }}>
      <div class="flex items-center gap-4">
        {#if audioError}
          <div class="py-2 text-sm text-red-500">
            {audioError}
          </div>
        {:else}
          <ProgressBar currentTime={localCurrentTime} {duration} onSeek={handleSeek} />
        {/if}
      </div>
    </div>
  {/if}
</div>
