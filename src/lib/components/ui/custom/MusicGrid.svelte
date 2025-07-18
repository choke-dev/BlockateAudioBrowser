<script lang="ts">
  import MusicTable from './MusicTable.svelte';
  import MusicCard from './MusicCard.svelte';
  import { onMount } from 'svelte';

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
    tracks = [],
    currentTrack = $bindable(null),
    isPlaying = $bindable(false),
    currentTime = $bindable(0),
    onPlay,
    onPause,
    onSeek
  }: {
    tracks?: MusicTrack[];
    currentTrack?: MusicTrack | null;
    isPlaying?: boolean;
    currentTime?: number;
    onPlay?: (track: MusicTrack) => void;
    onPause?: () => void;
    onSeek?: (time: number) => void;
  } = $props();

  let expandedTrackId = $state<string | null>(null);
  let isMobile = $state(false);

  // Check screen size on mount and resize
  function checkScreenSize() {
    isMobile = window.innerWidth < 768; // md breakpoint
  }

  onMount(() => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  });

  function handlePlay(track: MusicTrack) {
    currentTrack = track;
    isPlaying = true;
    onPlay?.(track);
  }

  function handlePause() {
    isPlaying = false;
    onPause?.();
  }

  function handleSeek(time: number) {
    currentTime = time;
    onSeek?.(time);
  }

  function handleRowClick(track: MusicTrack) {
    // If clicking on the already expanded row, collapse it and stop playing
    if (expandedTrackId === track.id) {
      expandedTrackId = null;
      if (currentTrack?.id === track.id) {
        isPlaying = false;
        currentTrack = null;
        currentTime = 0;
        onPause?.();
      }
    } else {
      // Expand the new row and stop any currently playing track
      if (currentTrack && currentTrack.id !== track.id) {
        isPlaying = false;
        currentTime = 0;
        onPause?.();
      }
      expandedTrackId = track.id;
    }
  }
</script>

{#if isMobile}
  <!-- Mobile Card Layout -->
  <div class="grid gap-4 sm:grid-cols-1">
    {#each tracks as track (track.id)}
      <MusicCard
        {track}
        isExpanded={expandedTrackId === track.id}
        isPlaying={isPlaying && currentTrack?.id === track.id}
        {currentTime}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
        onRowClick={handleRowClick}
      />
    {/each}
  </div>
{:else}
  <!-- Desktop Table Layout -->
  <MusicTable
    {tracks}
    bind:currentTrack
    bind:isPlaying
    bind:currentTime
    {onPlay}
    {onPause}
    {onSeek}
  />
{/if}