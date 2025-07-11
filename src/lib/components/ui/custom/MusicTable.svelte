<script lang="ts">
  import MusicRow from './MusicRow.svelte';

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

<div class="w-full bg-card rounded-lg">
  <!-- Table Header -->
  <div class="grid grid-cols-[48px_120px_1fr_1fr] gap-4 items-center p-4 border-b border-border bg-background text-sm font-medium text-muted-foreground uppercase tracking-wide rounded-t-lg">
    <div></div>
    <div>ID</div>
    <div>NAME</div>
    <div>CATEGORY</div>
  </div>

  <!-- Music Rows -->
  <div class="divide-y divide-border/50">
    {#each tracks as track (track.id)}
      <MusicRow
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
</div>