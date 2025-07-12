<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button/index';
  import SimpleIconsRoblox from '~icons/simple-icons/roblox';
  import LucideLoaderCircle from '~icons/lucide/loader-circle';
  import { Alert, AlertDescription } from '$lib/components/ui/alert/index';

  let isLoggingIn = false;
  let isLoggingOut = false;

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

  function dismissReauthNotification() {
    auth.clearReauthRequirement();
  }
</script>

<div class="auth-container">
  <!-- {#if $auth.requiresReauth}
    <Alert class="mb-4 border-orange-200 bg-orange-50">
      <AlertDescription class="flex items-center justify-between">
        <span class="text-orange-800">
          Your session has expired. Please log in again to continue.
        </span>
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onclick={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Logging in...' : 'Log in'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onclick={dismissReauthNotification}
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  {/if} -->

  {#if $auth.loading}
    <div class="flex items-center gap-2">
      <LucideLoaderCircle class="animate-spin" />
      <span class="text-sm">Checking authentication...</span>
    </div>
  {:else if $auth.authenticated && $auth.user}
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        {#if $auth.user.avatar}
          <img 
            src={$auth.user.avatar} 
            alt="{$auth.user.username}'s avatar"
            class="h-8 w-8 rounded-full"
          />
        {:else}
          <div class="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
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
      
      <div class="flex gap-2">
        <Button
        onclick={handleLogout}
        disabled={isLoggingOut}
        variant="outline"
        >
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </Button>
      </div>
    </div>
  {:else}
    <Button
      onclick={handleLogin}
      disabled={isLoggingIn}
      variant="outline"
    >
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