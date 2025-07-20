<script lang="ts">
  import { onMount } from 'svelte';
  import { offlineStore, type AudioMetadata, type CacheSettings } from '$lib/stores/offlineStore';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import MusicGrid from './MusicGrid.svelte';
  import LucideSearch from '~icons/lucide/search';
  import LucideWifi from '~icons/lucide/wifi';
  import LucideWifiOff from '~icons/lucide/wifi-off';
  import LucideDatabase from '~icons/lucide/database';
  import LucideAlertTriangle from '~icons/lucide/alert-triangle';
  import LucideChevronDown from '~icons/lucide/chevron-down';
  import LucideSettings from '~icons/lucide/settings';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';

  interface MusicTrack {
    id: string;
    name: string;
    creator: string;
    category: string;
    tags?: string[];
    length: string;
    duration?: number;
    audioUrl?: string;
    isPreviewable?: boolean;
  }

  // State
  let cachedAudios = $state<AudioMetadata[]>([]);
  let filteredTracks = $state<MusicTrack[]>([]);
  let searchQuery = $state('');
  let selectedCategory = $state('all');
  let isLoading = $state(false);
  let storageStats = $state({ searchResults: 0, audioMetadata: 0, userPreferences: 0 });

  // Audio player state
  let currentTrack = $state<MusicTrack | null>(null);
  let isPlaying = $state(false);
  let currentTime = $state(0);

  // Dialog state
  let showClearCacheDialog = $state(false);
  let showFreeUpSpaceDialog = $state(false);
  let showPerformanceWarningDialog = $state(false);
  let showCacheSettingsDialog = $state(false);

  // Pagination state
  let currentPage = $state(1);
  let pageSize = $state(25);
  let hasShownPerformanceWarning = $state(false);
  let tempPageSize = $state(25);

  // Cache settings state
  let cacheSettings = $state<CacheSettings>({
    enableSearchResultsCaching: true,
    enableAudioMetadataCaching: true,
    enableUserPreferencesCaching: true,
    searchResultsTTL: 1,
    autoCleanupEnabled: true,
    maxStorageUsagePercent: 85
  });

  // Get unique categories from cached audios
  let categories = $derived.by(() => {
    const cats = new Set(cachedAudios.map((audio) => audio.category));
    return ['all', ...Array.from(cats).sort()];
  });

  // Pagination calculations
  let totalPages = $derived(Math.ceil(filteredTracks.length / pageSize));
  let paginatedTracks = $derived.by(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTracks.slice(startIndex, endIndex);
  });

  // Reset to first page when filters change
  $effect(() => {
    currentPage = 1;
  });

  // Convert AudioMetadata to MusicTrack format
  function convertToMusicTrack(audio: AudioMetadata): MusicTrack {
    return {
      id: audio.id,
      name: audio.name,
      creator: 'Unknown', // Whitelister field is not needed
      category: audio.category || 'Uncategorized',
      tags: audio.tags || [],
      length: '0:00', // Will be updated from audio metadata
      audioUrl: audio.audio_url || undefined,
      isPreviewable: audio.is_previewable
    };
  }

  // Filter tracks based on search and category
  function filterTracks() {
    let filtered = cachedAudios;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((audio) => audio.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (audio) =>
          audio.name.toLowerCase().includes(query) ||
          audio.category.toLowerCase().includes(query) ||
          audio.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    filteredTracks = filtered.map(convertToMusicTrack);
  }

  // Load cached audios
  async function loadCachedAudios() {
    isLoading = true;
    try {
      cachedAudios = await offlineStore.getAllAudioMetadata();
      storageStats = await offlineStore.getStorageStats();
      await offlineStore.updateStorageQuota();
      filterTracks();
    } catch (error) {
      console.error('Failed to load cached audios:', error);
    } finally {
      isLoading = false;
    }
  }

  // Clear all cached data
  async function clearCache() {
    showClearCacheDialog = true;
  }

  async function confirmClearCache() {
    try {
      await offlineStore.clearAllData();
      await loadCachedAudios();
      showClearCacheDialog = false;
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  async function confirmFreeUpSpace() {
    try {
      await offlineStore.cleanupOldestData(0.1);
      await loadCachedAudios();
      showFreeUpSpaceDialog = false;
    } catch (error) {
      console.error('Failed to free up space:', error);
    }
  }

  // Pagination functions
  function handlePageSizeChange() {
    if (tempPageSize > 100 && (!hasShownPerformanceWarning || pageSize <= 100)) {
      showPerformanceWarningDialog = true;
    } else {
      pageSize = tempPageSize;
      currentPage = 1;
    }
  }

  function confirmPageSizeChange() {
    pageSize = tempPageSize;
    currentPage = 1;
    hasShownPerformanceWarning = true;
    showPerformanceWarningDialog = false;
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }

  // Cache settings functions
  async function loadCacheSettings() {
    try {
      cacheSettings = await offlineStore.getCacheSettings();
    } catch (error) {
      console.error('Failed to load cache settings:', error);
    }
  }

  async function saveCacheSettings() {
    try {
      await offlineStore.updateCacheSettings(cacheSettings);
      showCacheSettingsDialog = false;
    } catch (error) {
      console.error('Failed to save cache settings:', error);
    }
  }

  // Audio player handlers
  function handlePlay(track: MusicTrack) {
    currentTrack = track;
    isPlaying = true;
    currentTime = 0;
    console.log('Playing offline:', track.name);
  }

  function handlePause() {
    isPlaying = false;
    console.log('Paused offline playback');
  }

  function handleSeek(time: number) {
    currentTime = time;
    console.log('Seeking offline to:', time);
  }

  // Reactive effects
  $effect(() => {
    filterTracks();
  });

  onMount(() => {
    loadCachedAudios();
    loadCacheSettings();
  });
</script>

<div class="bg-background text-foreground min-h-screen w-full">
  <div class="w-full px-2 py-4 sm:px-4 md:px-8 md:py-8">
    <!-- Header -->
    <div class="mb-6 md:mb-8">
      <div class="mb-4 flex items-center gap-3">
        <LucideDatabase class="text-primary size-6" />
        <h1 class="text-2xl font-bold">Offline Browser</h1>
        <div class="ml-auto flex items-center gap-2">
          {#if $offlineStore.isOnline}
            <div
              class="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-200"
            >
              <LucideWifi class="size-3" />
              Online
            </div>
          {:else}
            <div
              class="flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-200"
            >
              <LucideWifiOff class="size-3" />
              Offline
            </div>
          {/if}
        </div>
      </div>

      <p class="text-muted-foreground mb-6">
        Browse and play audio tracks that have been cached for offline use.
      </p>

      <!-- Storage Stats -->
      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div class="bg-card rounded-lg border p-4">
          <div class="text-muted-foreground text-sm">Cached Audio Tracks</div>
          <div class="text-primary text-2xl font-bold">{storageStats.audioMetadata}</div>
        </div>
        <div class="bg-card rounded-lg border p-4">
          <div class="text-muted-foreground text-sm">Cached Search Results</div>
          <div class="text-primary text-2xl font-bold">{storageStats.searchResults}</div>
        </div>
        <div class="bg-card rounded-lg border p-4">
          <div class="text-muted-foreground text-sm">User Preferences</div>
          <div class="text-primary text-2xl font-bold">{storageStats.userPreferences}</div>
        </div>
        <div class="bg-card rounded-lg border p-4">
          <div class="text-muted-foreground text-sm">Storage Usage</div>
          {#if $offlineStore.storageQuota}
            <div class="text-primary text-2xl font-bold">
              {$offlineStore.storageQuota.usagePercentage.toFixed(1)}%
            </div>
            <div class="text-muted-foreground mt-1 text-xs">
              {($offlineStore.storageQuota.usage / 1024 / 1024).toFixed(1)}MB /
              {($offlineStore.storageQuota.quota / 1024 / 1024).toFixed(1)}MB
            </div>
            <div class="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-2 rounded-full transition-all duration-300 {$offlineStore.storageQuota
                  .usagePercentage >= 95
                  ? 'bg-red-500'
                  : $offlineStore.storageQuota.usagePercentage >= 85
                    ? 'bg-yellow-500'
                    : 'bg-green-500'}"
                style="width: {Math.min($offlineStore.storageQuota.usagePercentage, 100)}%"
              ></div>
            </div>
          {:else}
            <div class="text-muted-foreground text-2xl font-bold">N/A</div>
            <div class="text-muted-foreground mt-1 text-xs">Quota API not supported</div>
          {/if}
        </div>
      </div>

      <!-- Storage Quota Warning -->
      {#if $offlineStore.storageQuota && $offlineStore.storageQuota.usagePercentage >= 85}
        <div
          class="mb-6 rounded-lg border p-4 {$offlineStore.storageQuota.usagePercentage >= 95
            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'}"
        >
          <div class="mb-2 flex items-center gap-2">
            <span class="text-lg">
              {$offlineStore.storageQuota.usagePercentage >= 95 ? '🚨' : '⚠️'}
            </span>
            <h3
              class="font-semibold {$offlineStore.storageQuota.usagePercentage >= 95
                ? 'text-red-800 dark:text-red-200'
                : 'text-yellow-800 dark:text-yellow-200'}"
            >
              {$offlineStore.storageQuota.usagePercentage >= 95
                ? 'Storage Critical'
                : 'Storage Warning'}
            </h3>
          </div>
          <p
            class="text-sm {$offlineStore.storageQuota.usagePercentage >= 95
              ? 'text-red-700 dark:text-red-300'
              : 'text-yellow-700 dark:text-yellow-300'} mb-3"
          >
            {$offlineStore.storageQuota.usagePercentage >= 95
              ? 'Your storage is almost full. Some features may not work properly.'
              : 'Your storage usage is high. Consider clearing some cached data.'}
          </p>
          <div class="flex gap-2">
            <Button
              variant="outline"
              onclick={async () => {
                await offlineStore.cleanupExpiredData();
                await loadCachedAudios();
              }}
            >
              Clean Expired Data
            </Button>
            <Button variant="outline" onclick={() => (showFreeUpSpaceDialog = true)}>
              Free Up Space
            </Button>
          </div>
        </div>
      {/if}

      <!-- Search and Filter Controls -->
      <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div class="flex-1">
          <div class="relative">
            <Input
              bind:value={searchQuery}
              placeholder="Search cached audio..."
              class="bg-background border-border text-foreground placeholder:text-muted-foreground w-full rounded-md px-4 py-2 pr-10"
            />
            <LucideSearch
              class="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row md:gap-4">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button
                variant="outline"
                class="w-full min-w-0 flex-shrink-0 justify-between sm:w-auto"
              >
                {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                <LucideChevronDown class="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              class="data-[side=bottom]:slide-in-from-top-0 data-[side=top]:slide-in-from-bottom-0 data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0 max-h-60 w-56 overflow-y-auto"
              sideOffset={8}
            >
              {#each categories as category}
                <DropdownMenu.Item
                  onclick={() => (selectedCategory = category)}
                  class={selectedCategory === category ? 'bg-accent' : ''}
                >
                  {category === 'all' ? 'All Categories' : category}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          <div class="flex items-center gap-2">
            <label for="pageSize" class="text-muted-foreground text-sm whitespace-nowrap">
              Per page:
            </label>
            <Input
              id="pageSize"
              type="number"
              bind:value={tempPageSize}
              onchange={handlePageSizeChange}
              min="1"
              max="1000"
              class="w-20 text-center"
            />
          </div>

          <div class="flex flex-shrink-0 gap-2">
            <Button variant="outline" onclick={() => showCacheSettingsDialog = true} class="text-xs sm:text-sm">
              <LucideSettings class="w-4 h-4 mr-1" />
              Settings
            </Button>
            
            <Button variant="outline" onclick={clearCache} class="text-xs sm:text-sm">
              Clear Cache
            </Button>

            <Button onclick={loadCachedAudios} class="text-xs sm:text-sm">Refresh</Button>
          </div>
        </div>
      </div>

      <!-- Results Info -->
      <div class="mb-4">
        <div class="text-muted-foreground text-sm">
          {#if isLoading}
            Loading cached content...
          {:else}
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span>
                Showing {Math.min(
                  (currentPage - 1) * pageSize + 1,
                  filteredTracks.length
                )}-{Math.min(currentPage * pageSize, filteredTracks.length)} of {filteredTracks.length}
                {filteredTracks.length !== cachedAudios.length
                  ? `(filtered from ${cachedAudios.length})`
                  : ''} cached tracks
              </span>
              <span
                class="inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
              >
                💾 Offline Content
              </span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Pagination Controls -->
      {#if !isLoading && filteredTracks.length > 0 && totalPages > 1}
        <div class="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onclick={() => goToPage(currentPage - 1)}
              class="text-xs md:text-sm"
            >
              <span class="hidden sm:inline">Previous</span>
              <span class="sm:hidden">Prev</span>
            </Button>

            <div class="flex items-center gap-1">
              {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, currentPage - 2);
                const end = Math.min(totalPages, start + 4);
                return start + i;
              }).filter((page) => page <= totalPages) as page}
                <Button
                  variant={page === currentPage ? 'default' : 'outline'}
                  onclick={() => goToPage(page)}
                  class="min-w-8 text-xs md:min-w-10 md:text-sm"
                >
                  {page}
                </Button>
              {/each}

              {#if totalPages > 5 && currentPage < totalPages - 2}
                <span class="px-1 text-xs md:px-2 md:text-sm">...</span>
                <Button
                  variant="outline"
                  onclick={() => goToPage(totalPages)}
                  class="min-w-8 text-xs md:min-w-10 md:text-sm"
                >
                  {totalPages}
                </Button>
              {/if}
            </div>

            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onclick={() => goToPage(currentPage + 1)}
              class="text-xs md:text-sm"
            >
              <span class="hidden sm:inline">Next</span>
              <span class="sm:hidden">Next</span>
            </Button>
          </div>

          <div class="text-muted-foreground text-xs md:text-sm">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      {/if}
    </div>

    <!-- Content -->
    {#if isLoading}
      <div class="py-12 text-center">
        <div class="text-muted-foreground">Loading cached content...</div>
      </div>
    {:else if cachedAudios.length === 0}
      <div class="py-12 text-center">
        <LucideDatabase class="text-muted-foreground mx-auto mb-4 size-12" />
        <h3 class="mb-2 text-lg font-semibold">No Cached Content</h3>
        <p class="text-muted-foreground mb-4">
          No audio tracks have been cached yet. Search and browse audio while online to cache them.
        </p>
        {#if $offlineStore.isOnline}
          <Button onclick={() => (window.location.href = '/')}>Go to Search</Button>
        {/if}
      </div>
    {:else if filteredTracks.length === 0}
      <div class="py-12 text-center">
        <LucideSearch class="text-muted-foreground mx-auto mb-4 size-12" />
        <h3 class="mb-2 text-lg font-semibold">No Results Found</h3>
        <p class="text-muted-foreground">
          No cached tracks match your search criteria. Try adjusting your search or category filter.
        </p>
      </div>
    {:else}
      <!-- Music Grid -->
      <MusicGrid
        tracks={paginatedTracks}
        bind:currentTrack
        bind:isPlaying
        bind:currentTime
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
      />
    {/if}
  </div>

  <!-- Clear Cache Confirmation Dialog -->
  <Dialog.Root bind:open={showClearCacheDialog}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Clear Cache</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to clear all cached data? This will remove all offline content and
          you'll need to browse online again to rebuild your offline library.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => (showClearCacheDialog = false)}>Cancel</Button>
        <Button variant="destructive" onclick={confirmClearCache}>Clear Cache</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  <!-- Free Up Space Confirmation Dialog -->
  <Dialog.Root bind:open={showFreeUpSpaceDialog}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Free Up Space</Dialog.Title>
        <Dialog.Description>
          This will remove 10% of your oldest cached data to free up storage space. This action
          cannot be undone.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => (showFreeUpSpaceDialog = false)}>Cancel</Button>
        <Button variant="destructive" onclick={confirmFreeUpSpace}>Free Up Space</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  <!-- Performance Warning Dialog -->
  <Dialog.Root bind:open={showPerformanceWarningDialog}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title class="flex">
          <LucideAlertTriangle class="mr-2 size-5" /> Performance Warning
        </Dialog.Title>
        <Dialog.Description>
          Displaying more than 100 items per page may cause performance issues, especially on slower
          devices. Large page sizes can make the interface less responsive and consume more memory.
          <br /><br />
          Are you sure you want to set the page size to {tempPageSize}?
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button
          variant="outline"
          onclick={() => {
            showPerformanceWarningDialog = false;
            tempPageSize = pageSize; // Reset to current value
          }}
        >
          Cancel
        </Button>
        <Button onclick={confirmPageSizeChange}>Continue Anyway</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  <!-- Cache Settings Dialog -->
  <Dialog.Root bind:open={showCacheSettingsDialog}>
    <Dialog.Content class="max-w-md">
      <Dialog.Header>
        <Dialog.Title>Cache Settings</Dialog.Title>
        <Dialog.Description>
          Configure what data should be cached for offline use.
        </Dialog.Description>
      </Dialog.Header>
      
      <div class="space-y-6">
        <!-- Search Results Caching -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2">
            <Checkbox
              id="enableSearchResults"
              bind:checked={cacheSettings.enableSearchResultsCaching}
            />
            <Label for="enableSearchResults" class="text-sm font-medium">
              Cache Search Results
            </Label>
          </div>
          <p class="text-xs text-muted-foreground ml-6">
            Store search results for offline browsing
          </p>
          
          {#if cacheSettings.enableSearchResultsCaching}
            <div class="ml-6 flex items-center space-x-2">
              <Label for="searchTTL" class="text-xs">Cache duration (hours):</Label>
              <Input
                id="searchTTL"
                type="number"
                bind:value={cacheSettings.searchResultsTTL}
                min="1"
                max="168"
                class="w-20 h-8 text-xs"
              />
            </div>
          {/if}
        </div>

        <!-- Audio Metadata Caching -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2">
            <Checkbox
              id="enableAudioMetadata"
              bind:checked={cacheSettings.enableAudioMetadataCaching}
            />
            <Label for="enableAudioMetadata" class="text-sm font-medium">
              Cache Audio Metadata
            </Label>
          </div>
          <p class="text-xs text-muted-foreground ml-6">
            Store audio track information for offline access
          </p>
        </div>

        <!-- User Preferences Caching -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2">
            <Checkbox
              id="enableUserPreferences"
              bind:checked={cacheSettings.enableUserPreferencesCaching}
            />
            <Label for="enableUserPreferences" class="text-sm font-medium">
              Cache User Preferences
            </Label>
          </div>
          <p class="text-xs text-muted-foreground ml-6">
            Store your settings and preferences locally
          </p>
        </div>

        <!-- Auto Cleanup -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2">
            <Checkbox
              id="autoCleanup"
              bind:checked={cacheSettings.autoCleanupEnabled}
            />
            <Label for="autoCleanup" class="text-sm font-medium">
              Auto Cleanup
            </Label>
          </div>
          <p class="text-xs text-muted-foreground ml-6">
            Automatically clean up expired data when storage is full
          </p>
        </div>

        <!-- Storage Usage Limit -->
        <div class="space-y-3">
          <Label for="storageLimit" class="text-sm font-medium">
            Storage Usage Warning (%)
          </Label>
          <div class="flex items-center space-x-2">
            <Input
              id="storageLimit"
              type="number"
              bind:value={cacheSettings.maxStorageUsagePercent}
              min="50"
              max="95"
              class="w-20 h-8 text-xs"
            />
            <span class="text-xs text-muted-foreground">%</span>
          </div>
          <p class="text-xs text-muted-foreground">
            Show warning when storage usage exceeds this percentage
          </p>
        </div>
      </div>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => showCacheSettingsDialog = false}>
          Cancel
        </Button>
        <Button onclick={saveCacheSettings}>
          Save Settings
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>
