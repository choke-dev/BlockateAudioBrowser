<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button/index';
  import * as Popover from '$lib/components/ui/popover/index';
  import { toast } from "svelte-sonner";
  import SimpleIconsRoblox from '~icons/simple-icons/roblox';
  import LucideLoaderCircle from '~icons/lucide/loader-circle';
  import { Alert, AlertDescription } from '$lib/components/ui/alert/index';

  let mobileProfileOpen = $state(false);

  let isLoggingIn = $state(false);
  let isLoggingOut = $state(false);

  onMount(() => {
    auth.init();
  });

  async function handleLogin() {
    if (isLoggingIn) return;

    isLoggingIn = true;
    try {
      await auth.login();
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    } finally {
      isLoggingIn = false;
    }
  }

  async function handleLogout() {
    if (isLoggingOut) return;

    isLoggingOut = true;
    try {
      await auth.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      isLoggingOut = false;
    }
  }

  async function handleRefreshTokens() {
    const success = await auth.refreshTokens();
    if (!success) {
      alert('Token refresh failed. Please log in again.');
    }
  }
</script>

<div class="auth-container">
  {#if $auth.loading}
    <div class="flex items-center gap-2">
      <LucideLoaderCircle class="animate-spin" />
      <span class="hidden text-sm md:inline">Checking authentication...</span>
    </div>
  {:else if $auth.authenticated && $auth.user}
    <!-- Desktop Layout (sm and larger) -->
    <div class="hidden items-center gap-2 sm:flex md:gap-4">
      <div class="flex items-center gap-2">
        {#if $auth.user.avatar}
          <img
            src={$auth.user.avatar}
            alt="{$auth.user.username}'s avatar"
            class="h-6 w-6 rounded-full md:h-8 md:w-8"
          />
        {:else}
          <div
            class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 md:h-8 md:w-8"
          >
            <span class="text-xs font-medium text-gray-600 md:text-sm">
              {$auth.user.username.charAt(0).toUpperCase()}
            </span>
          </div>
        {/if}
        <div class="flex flex-col">
          <span class="text-xs font-medium md:text-sm">{$auth.user.username}</span>
          <span class="hidden text-xs text-gray-500 md:inline">User ID: {$auth.user.robloxId}</span>
        </div>
      </div>

      <div class="flex gap-2">
        <Button
          onclick={handleLogout}
          disabled={isLoggingOut}
          variant="outline"
          size="sm"
          class="text-xs md:text-sm"
        >
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </Button>
      </div>
    </div>

    <!-- Mobile Layout (smaller than sm) -->
    <div class="sm:hidden">
      <Popover.Root bind:open={mobileProfileOpen}>
        <Popover.Trigger variant="ghost" size="sm" class="flex items-center justify-center p-0">
          {#if $auth.user.avatar}
            <img
              src={$auth.user.avatar}
              alt="{$auth.user.username}'s avatar"
              class="size-9 rounded-full"
            />
          {:else}
            <div class="flex h-full w-full items-center justify-center rounded-full bg-gray-300">
              <span class="text-sm font-medium text-gray-600">
                {$auth.user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          {/if}
        </Popover.Trigger>
        <Popover.Content class="w-56" align="end" side="bottom" alignOffset={-8} sideOffset={8}>
          <div class="flex flex-col gap-3 p-2">
            <div class="flex items-center gap-2 px-2 py-1">
              {#if $auth.user.avatar}
                <img
                  src={$auth.user.avatar}
                  alt="{$auth.user.username}'s avatar"
                  class="h-8 w-8 rounded-full"
                />
              {:else}
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300">
                  <span class="text-sm font-medium text-gray-600">
                    {$auth.user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              {/if}
              <div class="flex flex-col">
                <span class="text-sm font-medium">{$auth.user.username}</span>
                <span class="text-xs text-gray-500">User ID: {$auth.user.robloxId}</span>
              </div>
            </div>
            <hr />
            <Button
              onclick={handleLogout}
              disabled={isLoggingOut}
              variant="outline"
              size="sm"
              class="w-full"
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  {:else}
    <Button onclick={handleLogin} disabled={isLoggingIn} variant="outline">
      {#if !isLoggingIn}
        <SimpleIconsRoblox class="size-4" />
      {/if}
      {isLoggingIn ? 'Logging in...' : 'Login with Roblox'}
    </Button>
  {/if}
</div>

<style>
  .auth-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
