<script lang="ts">
  import SimpleIconsRoblox from '~icons/simple-icons/roblox';
  import LucideDatabase from '~icons/lucide/database';
  import LucideInfo from '~icons/lucide/info';
  import AuthButton from './AuthButton.svelte';
  import WhitelistRequestForm from './WhitelistRequestForm.svelte';
  import WhitelistRequestsView from './WhitelistRequestsView.svelte';
  import NotificationSettings from './NotificationSettings.svelte';
  import { auth } from '$lib/stores/auth.js';
  import { offlineStore } from '$lib/stores/offlineStore';
  import { Button } from '$lib/components/ui/button';
    import Separator from '../separator/separator.svelte';
</script>

<header class="flex items-center justify-between border-b px-4 py-2 md:px-8">
  <div>
    <a href="/">
      <img src="/audiodb.png" class="size-8 md:size-10" alt="Blockate Audio Browser Logo" />
    </a>
  </div>
  <div class="flex items-center gap-1 md:gap-2">
    <!-- Offline Browser Button -->
    <Button variant="outline" size="sm" href="/offline" class="text-xs md:text-sm relative">
      <LucideDatabase class="size-4" />
      <span class="hidden lg:inline ml-1">Manage offline data</span>
      {#if $offlineStore.hasOfflineData}
        <span class="absolute -top-1 -right-1 size-2 bg-primary rounded-full"></span>
      {/if}
    </Button>

    {#if $auth.authenticated}
      <div class="flex items-center gap-1 md:gap-2">
        <WhitelistRequestForm triggerClass="text-xs md:text-sm" />
        <WhitelistRequestsView triggerClass="text-xs md:text-sm" />
        <NotificationSettings triggerClass="" />
      </div>
    {/if}
    <div class="pl-1 md:pl-2 flex items-center">
      <AuthButton />
    </div>
  </div>
</header>