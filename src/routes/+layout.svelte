<script lang="ts">
    import Header from '$lib/components/ui/custom/Header.svelte';
    import { audioCache } from '$lib/stores/audioCacheStore';
    import { browser } from '$app/environment';
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
	}
</script>

<div class="dark">
	<div class="fixed w-full backdrop-blur-xl z-5">
		<Header />
	</div>
	<div class="pt-14">
		{@render children()}
	</div>
</div>
