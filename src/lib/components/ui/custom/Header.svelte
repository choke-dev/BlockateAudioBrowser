<script lang="ts">
  import SimpleIconsRoblox from '~icons/simple-icons/roblox';
  import AuthButton from './AuthButton.svelte';
</script>

<header class="flex items-center justify-between border-b px-8 py-2">
  <div>
    <a href="/">
      <img src="./audiodb.png" class="size-10" alt="Blockate Audio Browser Logo" />
    </a>
  </div>
  <div>
    <AuthButton />
  </div>
</header>
