<script lang="ts">
  import { notifications, notificationsAvailable, unreadCount } from '$lib/stores/notifications.js';
  import { auth } from '$lib/stores/auth.js';
  import { whitelistNotificationService } from '$lib/services/whitelistNotificationService.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import * as Alert from '$lib/components/ui/alert/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import LucideBell from '~icons/lucide/bell';
  import LucideBellOff from '~icons/lucide/bell-off';
  import LucideSettings from '~icons/lucide/settings';
  import LucideRefreshCw from '~icons/lucide/refresh-cw';
  import { onMount } from 'svelte';

  let { triggerClass = '' } = $props();

  let open = $state(false);
  let isLoading = $state(false);

  // Initialize notification system when component mounts
  onMount(async () => {
    await notifications.init();
    
    // Start listening for notifications if user is authenticated and notifications are enabled
    if ($auth.authenticated && $notifications.enabled) {
      whitelistNotificationService.startListening();
    }
  });

  // Reactive statement to handle auth state changes
  $effect(() => {
    if ($auth.authenticated && $notifications.enabled) {
      whitelistNotificationService.startListening();
    } else {
      whitelistNotificationService.stopListening();
    }
  });

  async function handleToggleNotifications() {
    isLoading = true;
    try {
      const newState = !$notifications.enabled;
      const success = await notifications.setEnabled(newState);
      
      if (success && newState) {
        // Start listening for notifications
        whitelistNotificationService.startListening();
      } else if (!newState) {
        // Stop listening for notifications
        whitelistNotificationService.stopListening();
      }
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleRequestPermission() {
    isLoading = true;
    try {
      const granted = await notifications.requestPermission();
      if (granted) {
        whitelistNotificationService.startListening();
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleClearNotifications() {
    notifications.clearAll();
  }

  function handleMarkAllRead() {
    notifications.markAllAsRead();
  }

  async function handleForceCheck() {
    isLoading = true;
    try {
      await whitelistNotificationService.forceCheck();
    } catch (error) {
      console.error('Failed to check for notifications:', error);
    } finally {
      isLoading = false;
    }
  }

  function getPermissionStatusText() {
    switch ($notifications.permission.status) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Denied';
      default:
        return 'Not requested';
    }
  }

  function getPermissionStatusColor() {
    switch ($notifications.permission.status) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getServiceStatus() {
    return whitelistNotificationService.getStatus();
  }
</script>

{#if $auth.authenticated}
  <Dialog.Root bind:open>
    <Dialog.Trigger>
      <Button variant="outline" size="icon" class={`relative ${triggerClass}`}>
        {#if $notifications.enabled}
          <LucideBell class="size-4" />
        {:else}
          <LucideBellOff class="size-4" />
        {/if}

        {#if $unreadCount > 0}
          <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {$unreadCount > 9 ? '9+' : $unreadCount}
          </span>
        {/if}
      </Button>
    </Dialog.Trigger>
    
    <Dialog.Content class="sm:max-w-[500px] max-h-[80vh] overflow-hidden">
      <Dialog.Header>
        <Dialog.Title>Notification Settings</Dialog.Title>
        <Dialog.Description>
          Manage your whitelist request notifications and view recent updates.
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-6">
        <!-- Notification Support Check -->
        {#if !$notificationsAvailable}
          <Alert.Root variant="warning">
            <Alert.Description>
              Browser notifications are not supported in your current browser or you are not authenticated.
            </Alert.Description>
          </Alert.Root>
        {:else}
          <!-- Permission Status -->
          <div class="space-y-3">
            <h3 class="text-sm font-medium">Permission Status</h3>
            <div class="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p class="text-sm font-medium">Browser Notifications</p>
                <p class="text-xs text-muted-foreground {getPermissionStatusColor()}">
                  {getPermissionStatusText()}
                </p>
              </div>
              {#if $notifications.permission.status === 'default'}
                <Button size="sm" onclick={handleRequestPermission} disabled={isLoading}>
                  Request Permission
                </Button>
              {:else if $notifications.permission.status === 'denied'}
                <Alert.Root variant="destructive" class="mt-2">
                  <Alert.Description class="text-xs">
                    Notifications are blocked. Please enable them in your browser settings.
                  </Alert.Description>
                </Alert.Root>
              {/if}
            </div>
          </div>

          <!-- Notification Toggle -->
          <div class="space-y-3">
            <h3 class="text-sm font-medium">Notification Settings</h3>
            <div class="flex items-center space-x-3 p-3 border rounded-lg">
              <Checkbox 
                id="enable-notifications" 
                checked={$notifications.enabled}
                onCheckedChange={handleToggleNotifications}
                disabled={isLoading || $notifications.permission.status !== 'granted'}
              />
              <div class="flex-1">
                <label for="enable-notifications" class="text-sm font-medium cursor-pointer">
                  Enable Whitelist Notifications
                </label>
                <p class="text-xs text-muted-foreground">
                  Get notified when your whitelist requests are approved or rejected
                </p>
              </div>
            </div>
          </div>

          <!-- Service Status (Debug Info) -->
          {#if $notifications.enabled}
            {@const status = getServiceStatus()}
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium">Service Status</h3>
                <Button size="sm" variant="outline" onclick={handleForceCheck} disabled={isLoading}>
                  <LucideRefreshCw class="size-3 mr-1" />
                  Check Now
                </Button>
              </div>
              <div class="p-3 border rounded-lg bg-muted/50">
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span class="text-muted-foreground">Status:</span>
                    <span class="ml-1 {status.isListening ? 'text-green-600' : 'text-red-600'}">
                      {status.isListening ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Poll Interval:</span>
                    <span class="ml-1">{Math.round(status.currentPollingInterval / 1000)}s</span>
                  </div>
                  {#if status.lastChecked}
                    <div class="col-span-2">
                      <span class="text-muted-foreground">Last Check:</span>
                      <span class="ml-1">{formatDate(status.lastChecked)}</span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}

          <!-- Recent Notifications -->
          {#if $notifications.notifications.length > 0}
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium">Recent Notifications ({$notifications.notifications.length})</h3>
                <div class="space-x-2">
                  {#if $unreadCount > 0}
                    <Button size="sm" variant="outline" onclick={handleMarkAllRead}>
                      Mark All Read
                    </Button>
                  {/if}
                  <Button size="sm" variant="outline" onclick={handleClearNotifications}>
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div class="max-h-48 overflow-y-auto space-y-2">
                {#each $notifications.notifications.slice(0, 10) as notification (notification.id)}
                  <div class="p-3 border rounded-lg {notification.read ? 'bg-muted/30' : 'bg-background'}">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center space-x-2">
                          <span class="text-sm font-medium">{notification.audioName}</span>
                          <span class="px-2 py-1 rounded-full text-xs font-medium {
                            notification.status === 'approved' 
                              ? 'text-green-600 bg-green-100' 
                              : 'text-red-600 bg-red-100'
                          }">
                            {notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}
                          </span>
                          {#if !notification.read}
                            <span class="w-2 h-2 bg-blue-500 rounded-full"></span>
                          {/if}
                        </div>
                        <p class="text-xs text-muted-foreground mt-1">
                          ID: {notification.audioId} • {formatDate(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="text-center py-6">
              <p class="text-sm text-muted-foreground">No notifications yet</p>
              <p class="text-xs text-muted-foreground mt-1">
                You'll see updates here when your whitelist requests are processed
              </p>
            </div>
          {/if}
        {/if}
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => open = false}>
          Close
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}