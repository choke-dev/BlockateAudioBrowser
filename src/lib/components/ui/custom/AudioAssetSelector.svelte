<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Alert from '$lib/components/ui/alert/index.js';
  import LucideSearch from '~icons/lucide/search';
  import LucideRefreshCw from '~icons/lucide/refresh-cw';
  import LucideCircleAlert from '~icons/lucide/circle-alert';
  import LucideInfo from '~icons/lucide/info';
  import LucideX from '~icons/lucide/x';
  import { ofetch } from 'ofetch';
  import { auth } from '$lib/stores/auth.js';

  interface AudioAsset {
    id: string;
    name: string;
    created: string;
  }

  interface ErrorResponse {
    success: boolean;
    error?: string;
    requiresInventoryReadScope?: boolean;
    requiresReauth?: boolean;
    currentScope?: string;
    requiresAuth?: boolean;
    retryable?: boolean;
    details?: string;
  }

  let {
    selectedAssetId = $bindable(''),
    selectedAssetName = $bindable(''),
    onScopeError = () => {},
    disabled = false
  } = $props();

  // State management
  let assets: AudioAsset[] = $state([]);
  let loading = $state(false);
  let error = $state('');
  let searchTerm = $state('');
  let selectorOpen = $state(false);
  let searchInputRef: any;
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Computed states
  let filteredAssets = $derived.by(() => {
    if (!searchTerm.trim()) return assets;
    
    const term = searchTerm.toLowerCase();
    return assets.filter(asset =>
      asset.name.toLowerCase().includes(term) ||
      asset.id.toLowerCase().includes(term)
    );
  });

  let hasAssets = $derived(assets.length > 0);
  let hasFilteredResults = $derived(filteredAssets.length > 0);
  let showEmptyState = $derived(!loading && !error && !hasFilteredResults);
  let displayPlaceholder = $derived(
    selectedAssetId
      ? `Selected: ${selectedAssetName || selectedAssetId}`
      : "Select an audio asset from your inventory"
  );

  // Check if user has inventory read scope
  let hasInventoryScope = $derived.by(() => {
    if (!$auth.scopes) return false;
    return $auth.scopes.includes('user.inventory-item:read');
  });

  // Debounced search function
  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      searchTerm = target.value;
    }, 300);
  }

  // Optimized asset loading with better error handling
  async function loadUserAssets() {
    if (loading) return; // Prevent concurrent requests
    
    loading = true;
    error = '';
    
    try {
      const response = await ofetch<AudioAsset[] | ErrorResponse>('/api/user/assets', {
        credentials: 'include',
        timeout: 10000, // 10 second timeout
        retry: 1
      });

      // Check if response is an array (success case) or error object
      if (Array.isArray(response)) {
        assets = response;
        error = '';
      } else {
        // Handle error response
        handleApiError(response);
      }
    } catch (fetchError) {
      console.error('Failed to load user assets:', fetchError);
      
      // Try to parse error response from fetch error
      if (fetchError && typeof fetchError === 'object' && 'data' in fetchError) {
        const errorData = (fetchError as any).data as ErrorResponse;
        if (errorData && typeof errorData === 'object') {
          handleApiError(errorData);
          return;
        }
      }
      
      error = fetchError instanceof Error && fetchError.message.includes('timeout')
        ? 'Request timed out. Please try again.'
        : 'Failed to load your audio assets. Please check your connection and try again.';
    } finally {
      loading = false;
    }
  }

  function handleApiError(response: ErrorResponse) {
    if (response.requiresInventoryReadScope) {
      error = 'Missing inventory access permission. Please reauthorize with inventory access.';
      // Close the selector dialog and show reauth dialog
      selectorOpen = false;
      onScopeError();
    } else if (response.requiresReauth || response.requiresAuth) {
      error = 'Authentication expired. Please log in again.';
    } else {
      error = response.error || 'Failed to load assets. Please try again.';
    }
  }

  function selectAsset(asset: AudioAsset) {
    selectedAssetId = asset.id;
    selectedAssetName = asset.name;
    selectorOpen = false;
    searchTerm = ''; // Clear search when selecting
  }

  function clearSelection() {
    selectedAssetId = '';
    selectedAssetName = '';
  }

  async function openSelector() {
    if (disabled) return;
    
    // Check if user has inventory scope before opening
    if (!hasInventoryScope) {
      // Show reauth dialog instead of opening selector
      onScopeError();
      return;
    }
    
    selectorOpen = true;
    
    // Load assets when selector is actually opened
    if (assets.length === 0 && !loading) {
      await loadUserAssets();
    }
    
    // Focus search input after dialog opens
    await tick();
    if (searchInputRef) {
      const inputElement = searchInputRef.querySelector('input') || searchInputRef;
      inputElement?.focus();
    }
  }

  function closeSelector() {
    selectorOpen = false;
    searchTerm = ''; // Clear search when closing
  }

  // Keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeSelector();
    }
  }

  // Cleanup on unmount
  function cleanup() {
    clearTimeout(debounceTimer);
  }

  onMount(() => {
    // Don't automatically load assets on mount
    // Only load when user actually opens the selector
    return cleanup;
  });
</script>

<!-- Main selector interface -->
<Button
  type="button"
  variant="outline"
  size="sm"
  onclick={openSelector}
  {disabled}
  aria-label="Browse audio assets from your inventory"
>
  <LucideSearch class="size-4" />
</Button>

<!-- Asset selection dialog -->
<Dialog.Root bind:open={selectorOpen} onOpenChange={closeSelector}>
  <Dialog.Content
    class="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
    onkeydown={handleKeydown}
  >
    <Dialog.Header class="flex-shrink-0">
      <Dialog.Title>Select Audio Asset</Dialog.Title>
    </Dialog.Header>

    <div class="flex-1 flex flex-col space-y-4 min-h-0">
      <!-- Search and Refresh Controls -->
      <div class="flex gap-2 flex-shrink-0">
        <div class="flex-1 relative">
          <LucideSearch class="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            bind:this={searchInputRef}
            oninput={handleSearchInput}
            placeholder="Search by name or ID..."
            class="pl-10"
            aria-label="Search audio assets"
            autocomplete="off"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onclick={loadUserAssets}
          disabled={loading}
          aria-label={loading ? 'Refreshing assets...' : 'Refresh assets'}
        >
          <LucideRefreshCw class={`size-4 ${loading ? 'animate-spin' : ''}`} />
          <span class="sr-only">{loading ? 'Refreshing' : 'Refresh'}</span>
        </Button>
      </div>

      <!-- Error Display -->
      {#if error}
        <Alert.Root variant="error" class="flex-shrink-0">
          <LucideCircleAlert class="size-4" />
          <Alert.Description>
            {error}
          </Alert.Description>
        </Alert.Root>
      {/if}

      <!-- Content Area -->
      <div class="flex-1 min-h-0">
        {#if loading}
          <!-- Loading State -->
          <div class="flex items-center justify-center py-12" role="status" aria-live="polite">
            <LucideRefreshCw class="size-6 animate-spin mr-3" />
            <span>Loading your audios...</span>
          </div>
        {:else if showEmptyState}
          <!-- Empty State -->
          <div class="text-center py-12 text-muted-foreground" role="status">
            <div class="space-y-2">
              <p class="text-lg font-medium">
                {searchTerm ? 'No matching assets found' : 'No audio assets found'}
              </p>
              <p class="text-sm">
                {searchTerm
                  ? 'Try adjusting your search terms or clear the search to see all assets.'
                  : 'No audio assets were found in your Roblox inventory.'}
              </p>
              {#if searchTerm}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onclick={() => {
                    searchTerm = '';
                    if (searchInputRef) {
                      const inputElement = searchInputRef.querySelector('input') || searchInputRef;
                      inputElement?.focus();
                    }
                  }}
                  class="mt-2"
                >
                  Clear search
                </Button>
              {/if}
            </div>
          </div>
        {:else if hasFilteredResults}
          <!-- Assets List -->
          <div class="space-y-1">
            <div class="text-sm text-muted-foreground mb-2 flex-shrink-0">
              Showing {filteredAssets.length} of {assets.length} assets
              {#if searchTerm}
                matching "{searchTerm}"
              {/if}
            </div>
            <div
              class="max-h-80 overflow-y-auto space-y-2 pr-2"
              role="listbox"
              aria-label="Audio assets"
            >
              {#each filteredAssets as asset, index (asset.id)}
                <div
                  class="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors focus-within:ring-2 focus-within:ring-primary"
                  role="option"
                  aria-selected="false"
                  tabindex="-1"
                >
                  <div class="flex-1 min-w-0 mr-3">
                    <div class="font-medium truncate" title={asset.name}>
                      {asset.name}
                    </div>
                    <div class="text-sm text-muted-foreground">
                      ID: {asset.id}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      Created: {new Date(asset.created).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onclick={() => selectAsset(asset)}
                    aria-label={`Select ${asset.name}`}
                    class="flex-shrink-0"
                  >
                    Select
                  </Button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Info about manual entry -->
      {#if !loading}
        <Alert.Root class="flex-shrink-0">
          <LucideInfo class="size-4" />
          <Alert.Description>
            You can also manually enter an Audio ID in the input field above if you know the specific ID you want to use.
          </Alert.Description>
        </Alert.Root>
      {/if}
    </div>

    <Dialog.Footer class="flex-shrink-0">
      <Button
        type="button"
        variant="outline"
        onclick={closeSelector}
        aria-label="Close dialog"
      >
        Cancel
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>