<script lang="ts">
  import { z } from 'zod';

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  import { playingTrackId } from '$lib/stores/playingTrackStore';
  import { readSearchParams, updateSearchParams, type FilterData, type SortData } from '$lib/utils/urlParams';
  
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import MusicGrid from '$lib/components/ui/custom/MusicGrid.svelte';
  import SearchBar from '$lib/components/ui/custom/SearchBar.svelte';
  import SortButton from '$lib/components/ui/custom/SortButton.svelte';
  import FilterButton from '$lib/components/ui/custom/FilterButton.svelte';

  // API Response types
  interface AudioTrack {
    id: string;
    name: string;
    category: string;
    is_previewable: boolean;
    whitelister: string;
    audio_url: string | null;
    created_at: string;
  }

  interface SearchResponse {
    items: AudioTrack[];
    total: number;
  }

  interface ErrorResponse {
    errors: { message: string }[];
  }

  // UI Track interface for compatibility with existing components
  interface MusicTrack {
    id: string;
    name: string;
    creator: string;
    tags: string;
    length: string;
    duration?: number;
    audioUrl?: string;
    isPreviewable?: boolean;
  }

  // Validation schemas
  const SearchQuerySchema = z.string().max(100, "Search query too long");
  const PageSchema = z.number().int().min(1).max(1000);

  // State management
  let searchQuery = $state('');
  let appliedFilters = $state<FilterData | null>(null);
  let appliedSort = $state<SortData | null>(null);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let totalResults = $state(0);
  let jumpToPage = $state('');
  let initialStateLoaded = $state(false);
  
  // Track state
  let tracks = $state<MusicTrack[]>([]);
  let currentTrack = $state<MusicTrack | null>(null);
  let isPlaying = $state(false);
  let currentTime = $state(0);

  // Loading and error states
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let hasPerformedInitialSearch = $state(false);
  
  // URL parameter synchronization flag
  let skipUrlUpdate = $state(false);

  // Constants
  const RESULTS_PER_PAGE = 25;

  // Convert API response to UI format
  function convertToMusicTrack(apiTrack: AudioTrack): MusicTrack {
    return {
      id: apiTrack.id,
      name: apiTrack.name,
      creator: apiTrack.whitelister || 'Unknown',
      tags: apiTrack.category || 'Uncategorized',
      length: '0:00', // Will be updated from audio metadata
      audioUrl: apiTrack.audio_url || undefined,
      isPreviewable: apiTrack.is_previewable
    };
  }

  // Perform search API call
  async function performSearch() {
    try {
      // Validate inputs
      const validatedQuery = SearchQuerySchema.parse(searchQuery);
      const validatedPage = PageSchema.parse(currentPage);
      
      isPlaying = false;
      isLoading = true;
      error = null;
      playingTrackId.set(null);

      // Build request body
      const requestBody = {
        filters: appliedFilters,
        sort: appliedSort
      };

      // Build URL with query parameters
      const url = new URL('/api/audio/search', window.location.origin);
      if (validatedQuery.trim()) {
        url.searchParams.set('keyword', encodeURIComponent(validatedQuery));
      }
      url.searchParams.set('page', validatedPage.toString());

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.errors?.[0]?.message || 'Search failed');
      }

      const data: SearchResponse = await response.json();
      
      // Convert tracks (durations will be obtained from audio metadata)
      tracks = data.items.map(track => convertToMusicTrack(track));
      totalResults = data.total;
      totalPages = Math.ceil(data.total / RESULTS_PER_PAGE);
      
    } catch (err) {
      console.error('Search error:', err);
      if (err instanceof z.ZodError) {
        error = err.issues[0].message;
      } else if (err instanceof Error) {
        error = err.message;
      } else {
        error = 'An unexpected error occurred';
      }
      tracks = [];
      totalResults = 0;
      totalPages = 1;
    } finally {
      isLoading = false;
    }
  }

  // Manual search handler
  function handleSearch(query: string) {
    searchQuery = query;
    currentPage = 1; // Reset to first page on new search
    performSearch();
  }

  // Update URL parameters when state changes
  function updateUrlParams() {
    if (!browser || skipUrlUpdate || !initialStateLoaded) return;
    
    updateSearchParams({
      query: searchQuery,
      page: currentPage,
      filters: appliedFilters,
      sort: appliedSort
    });
  }

  // Load initial state from URL parameters
  function loadInitialState() {
    if (!browser) return;
    
    skipUrlUpdate = true;
    const params = readSearchParams();
    
    if (params.query) {
      searchQuery = params.query;
    }
    
    if (params.page) {
      currentPage = params.page;
    }
    
    if (params.filters) {
      appliedFilters = params.filters;
    }
    
    if (params.sort) {
      appliedSort = params.sort;
    }
    
    initialStateLoaded = true;
    skipUrlUpdate = false;
  }

  // Event handlers
  function handlePlay(track: MusicTrack) {
    currentTrack = track;
    isPlaying = true;
    currentTime = 0;
    console.log('Playing:', track.name);
  }

  function handlePause() {
    isPlaying = false;
    console.log('Paused');
  }

  function handleSeek(time: number) {
    currentTime = time;
    console.log('Seeking to:', time);
  }

  function handleFiltersUpdate(filterData: FilterData) {
    appliedFilters = filterData;
    currentPage = 1; // Reset to first page when filters change
    performSearch();
  }

  function handleSortUpdate(sortData: SortData | null) {
    appliedSort = sortData;
    currentPage = 1; // Reset to first page when sort changes
    performSearch();
  }

  function handlePageChange(page: number) {
    currentPage = page;
    performSearch();
  }

  function handleJumpToPage() {
    const pageNum = parseInt(jumpToPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      currentPage = pageNum;
      jumpToPage = '';
      performSearch();
    }
  }

  // Initialize on mount
  onMount(() => {
    if (browser) {
      loadInitialState();
      hasPerformedInitialSearch = true;
      performSearch();
    }
  });


  // Watch for state changes to update URL (but not during pagination)
  $effect(() => {
    if (initialStateLoaded) {
      updateUrlParams();
    }
  });
</script>

<div class="min-h-screen bg-background w-full text-foreground">
  <div class="w-full py-4 px-4 md:py-8 md:px-8">
    <!-- Page Header -->
    <div class="mb-6 md:mb-8">
      <!-- Search and Filter Controls -->
      <div class="flex flex-col gap-4 mb-6 md:flex-row md:items-center">
        <div class="flex-1">
          <SearchBar bind:value={searchQuery} onSearch={handleSearch} />
        </div>
        <div class="flex gap-2 md:gap-4">
          <FilterButton updateFilters={handleFiltersUpdate} initialFilters={appliedFilters} />
          <SortButton updateSort={handleSortUpdate} initialSort={appliedSort} />
        </div>
      </div>

      <!-- Results Info -->
      <div class="mb-4">
        <div class="text-sm text-muted-foreground">
          {#if isLoading}
            Loading...
          {:else if error}
            <span class="text-red-500">Error: {error}</span>
          {:else}
            Showing {tracks.length} of {totalResults} results
          {/if}
        </div>
      </div>
    </div>

    <!-- Music Grid -->
    {#if isLoading}
      <div class="text-center">
        Loading...
      </div>
    {:else}
      <MusicGrid
      tracks={tracks}
      bind:currentTrack
      bind:isPlaying
      bind:currentTime
      onPlay={handlePlay}
      onPause={handlePause}
      onSeek={handleSeek}
    />
    {/if}

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="mt-6 md:mt-8 flex flex-col items-center gap-4">
        <!-- Main pagination controls -->
        <div class="flex justify-center items-center gap-1 md:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onclick={() => handlePageChange(currentPage - 1)}
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
            }).filter(page => page <= totalPages) as page}
              <Button
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onclick={() => handlePageChange(page)}
                class="text-xs md:text-sm min-w-8 md:min-w-10"
              >
                {page}
              </Button>
            {/each}
            
            {#if totalPages > 5 && currentPage < totalPages - 2}
              <span class="px-1 md:px-2 text-xs md:text-sm">...</span>
              <Button
                variant="outline"
                size="sm"
                onclick={() => handlePageChange(totalPages)}
                class="text-xs md:text-sm min-w-8 md:min-w-10"
              >
                {totalPages}
              </Button>
            {/if}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onclick={() => handlePageChange(currentPage + 1)}
            class="text-xs md:text-sm"
          >
            <span class="hidden sm:inline">Next</span>
            <span class="sm:hidden">Next</span>
          </Button>
        </div>
        
        <!-- Page info and jump to page -->
        <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs md:text-sm text-muted-foreground">
          <div class="flex items-center gap-2">
            <span class="whitespace-nowrap">Go to page:</span>
            <Input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              min="1"
              max={totalPages}
              bind:value={jumpToPage}
              class="w-12 md:w-16 h-7 md:h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder={currentPage.toString()}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  handleJumpToPage();
                } else if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              oninput={(e) => {
                // Remove any non-numeric characters
                const target = e.target as HTMLInputElement;
                target.value = target.value.replace(/[^0-9]/g, '');
                jumpToPage = target.value;
              }}
            />
            <Button size="sm" variant="ghost" onclick={handleJumpToPage} class="text-xs md:text-sm">Go</Button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
