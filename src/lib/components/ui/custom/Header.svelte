<script lang="ts">
  import SimpleIconsRoblox from '~icons/simple-icons/roblox';
  import Button from '$lib/components/ui/button/button.svelte';
</script>

<header class="flex items-center justify-between border-b px-8 py-2">
  <div>
    <img src="./audiodb.png" class="size-10" alt="Blockate Audio Browser Logo" />
  </div>
  <div>
    <Button variant="outline">
      <SimpleIconsRoblox class="size-4" />
      Login with Roblox
    </Button>
  </div>
</header>
