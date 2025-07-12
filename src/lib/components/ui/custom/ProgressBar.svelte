<script lang="ts">
  let {
    currentTime = 0,
    duration = 0,
    onSeek
  }: {
    currentTime?: number;
    duration?: number;
    onSeek?: (time: number) => void;
  } = $props();

  let isDragging = $state(false);
  let isHovering = $state(false);
  let progressBarRef: HTMLElement | undefined;

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getTimeFromPosition(clientX: number): number {
    if (!progressBarRef || duration === 0) return 0;
    
    const rect = progressBarRef.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    return percentage * duration;
  }

  function handleMouseDown(event: MouseEvent) {
    if (!onSeek || duration === 0) return;
    
    isDragging = true;
    const newTime = getTimeFromPosition(event.clientX);
    onSeek(newTime);

    function handleMouseMove(e: MouseEvent) {
      if (!isDragging || !onSeek) return;
      const newTime = getTimeFromPosition(e.clientX);
      onSeek(newTime);
    }

    function handleMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function handleClick(event: MouseEvent) {
    if (!onSeek || duration === 0 || isDragging) return;
    
    const newTime = getTimeFromPosition(event.clientX);
    onSeek(newTime);
  }

  // Touch event handlers for mobile support
  function handleTouchStart(event: TouchEvent) {
    if (!onSeek || duration === 0) return;
    
    // Prevent default to avoid scrolling and other touch behaviors
    event.preventDefault();
    
    isDragging = true;
    const touch = event.touches[0];
    const newTime = getTimeFromPosition(touch.clientX);
    onSeek(newTime);

    function handleTouchMove(e: TouchEvent) {
      if (!isDragging || !onSeek) return;
      e.preventDefault(); // Prevent scrolling while dragging
      const touch = e.touches[0];
      const newTime = getTimeFromPosition(touch.clientX);
      onSeek(newTime);
    }

    function handleTouchEnd() {
      isDragging = false;
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }

  const progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
</script>

<div class="flex items-center gap-3 w-full">
  <span class="text-sm text-muted-foreground min-w-[40px]">
    {formatTime(currentTime)}
  </span>
  
  <button
  bind:this={progressBarRef}
  class="flex-1 h-1 bg-muted rounded-full cursor-pointer relative group"
  onclick={handleClick}
  onmousedown={handleMouseDown}
  onmouseenter={() => isHovering = true}
  onmouseleave={() => isHovering = false}
  ontouchstart={handleTouchStart}
  role="slider"
  tabindex="0"
  aria-valuemin="0"
  aria-valuemax={duration}
  aria-valuenow={currentTime}
>
  <!-- Progress fill -->
  <div
    class="h-full bg-primary rounded-full"
    style="width: {progress}%"
  ></div>
    
    <!-- Draggable circle - visible on hover or when dragging -->
    <div
      class="absolute top-1/2 w-3 h-3 bg-primary rounded-full transition-opacity duration-150 pointer-events-none"
      class:opacity-100={isHovering || isDragging}
      class:opacity-0={!isHovering && !isDragging}
      style="left: {progress}%; transform: translateX(-50%) translateY(-50%)"
    ></div>
    
    <!-- Larger hit area for easier dragging -->
    <div
      class="absolute inset-0 -top-2 -bottom-2 cursor-pointer"
    ></div>
  </button>
  
  <span class="text-sm text-muted-foreground min-w-[40px]">
    {formatTime(duration)}
  </span>
</div>