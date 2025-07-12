<script lang="ts">
  import { browser } from '$app/environment';
  import { updated } from '$app/state';
  import Header from '$lib/components/ui/custom/Header.svelte';
  import { audioCache } from '$lib/stores/audioCacheStore';
  import { auth } from '$lib/stores/auth.js';
  import { notifications } from '$lib/stores/notifications.js';
  import { onDestroy, onMount } from 'svelte';
  import '../app.css';

  let { children } = $props();

  // Setup page unload cleanup for audio cache
  if (browser) {
    const handleBeforeUnload = () => {
      // Clear the audio cache when the page is being unloaded
      audioCache.clearCache();
    };

    // Add event listener for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup the event listener when the layout is destroyed
    $effect(() => {
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    });

    let versionCheckInterval: NodeJS.Timeout;
    // Reload immediately if outdated on first load
    onMount(async () => {
      // Initialize auth system
      await auth.init();
      
      // Initialize notification system
      await notifications.init();
      
      if (await updated.check()) {
        location.reload();
      }

      // Then check every hour (60*60*1000 ms)
      versionCheckInterval = setInterval(async () => {
        if (await updated.check()) {
          location.reload();
        }
      }, 3600000);
    });

    onDestroy(() => clearInterval(versionCheckInterval));
  }
</script>

<div class="dark">
  <div class="fixed z-5 w-full backdrop-blur-xl">
    <Header />
  </div>
  <div class="pt-14">
    {@render children()}
  </div>
</div>
