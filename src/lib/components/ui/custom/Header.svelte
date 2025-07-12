<script lang="ts">
  import SimpleIconsRoblox from '~icons/simple-icons/roblox';
  import AuthButton from './AuthButton.svelte';
  import WhitelistRequestForm from './WhitelistRequestForm.svelte';
  import WhitelistRequestsView from './WhitelistRequestsView.svelte';
  import NotificationSettings from './NotificationSettings.svelte';
  import { auth } from '$lib/stores/auth.js';
</script>

<header class="flex items-center justify-between border-b px-8 py-2">
  <div>
    <a href="/">
      <img src="/audiodb.png" class="size-10" alt="Blockate Audio Browser Logo" />
    </a>
  </div>
  <div class="flex items-center gap-2 divide-x-2">
    {#if $auth.authenticated}
      <div class="flex items-center">
        <WhitelistRequestForm triggerClass="mr-2" />
        <WhitelistRequestsView triggerClass="mr-2" />
        <NotificationSettings triggerClass="mr-2" />
      </div>
    {/if}
    <AuthButton />
  </div>
</header>
