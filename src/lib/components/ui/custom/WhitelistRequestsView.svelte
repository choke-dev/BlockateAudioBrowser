<script lang="ts">
  import { auth } from '$lib/stores/auth.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { onMount } from 'svelte';
  import LucideList from '~icons/lucide/list';

  let { triggerClass = '' } = $props();

  let open = $state(false);
  let isLoading = $state(false);
  let requests = $state<WhitelistRequest[]>([]);
  let pagination = $state({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  interface WhitelistRequest {
    id: string;
    audioId: string;
    audioName: string;
    audioCategory: string;
    isPrivate: boolean;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    updatedAt: string;
  }

  async function loadRequests(page = 1) {
    if (!$auth.authenticated) return;

    isLoading = true;
    try {
      const url = new URL('/api/whitelist/requests', window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', pagination.limit.toString());

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          requests = result.data || [];
          pagination = { ...result.pagination };
        } else {
          console.error('Failed to load requests:', result.message);
        }
      } else {
        console.error('Failed to load requests');
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      isLoading = false;
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= pagination.totalPages) {
      loadRequests(page);
    }
  }

  function nextPage() {
    if (pagination.hasNextPage) {
      goToPage(pagination.page + 1);
    }
  }

  function previousPage() {
    if (pagination.hasPreviousPage) {
      goToPage(pagination.page - 1);
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

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-975 dark:text-green-500 border-green-200 dark:border-green-900';
      case 'rejected':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-975 dark:text-rose-500 border-rose-200 dark:border-rose-900';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-975 dark:text-yellow-500 border-yellow-200 dark:border-yellow-900';
    }
  }

  function handleDialogOpen() {
    if ($auth.authenticated) {
      loadRequests();
    }
  }

  onMount(handleDialogOpen);
</script>

{#if $auth.authenticated}
  <Dialog.Root bind:open>
    <Dialog.Trigger>
      <Button variant="outline" class={triggerClass} size="sm">
        <LucideList class="size-4" />
        <span class="hidden sm:inline ml-2">My Requests</span>
      </Button>
    </Dialog.Trigger>
    <Dialog.Content class="sm:max-w-[600px] max-h-[80vh] overflow-hidden">
      <Dialog.Header>
        <Dialog.Title>My Whitelist Requests</Dialog.Title>
        <Dialog.Description>
          View the status of your audio whitelist requests.
        </Dialog.Description>
      </Dialog.Header>
      
      <div class="overflow-y-auto max-h-[60vh] space-y-4">
        {#if isLoading}
          <div class="flex items-center justify-center py-8">
            <div class="text-muted-foreground">Loading requests...</div>
          </div>
        {:else if requests.length === 0}
          <div class="flex items-center justify-center py-8">
            <div class="text-center">
              <p class="text-muted-foreground mb-2">No requests found</p>
              <p class="text-sm text-muted-foreground">You haven't submitted any whitelist requests yet.</p>
            </div>
          </div>
        {:else}
          {#each requests as request (request.id)}
            <div class="border rounded-lg p-4 space-y-3">
              <div class="flex items-start justify-between">
                <div class="space-y-1">
                  <h3 class="font-medium">{request.audioName}</h3>
                  <p class="text-sm text-muted-foreground">ID: {request.audioId}</p>
                </div>
                <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(request.status)}">
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
              </div>
              
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">Category:</span>
                  <span class="ml-1">{request.audioCategory}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Privacy:</span>
                  <span class="ml-1">{request.isPrivate ? 'Private' : 'Public'}</span>
                </div>
              </div>
              
              <div class="text-xs text-muted-foreground">
                <div>Submitted: {formatDate(request.createdAt)}</div>
                {#if request.updatedAt !== request.createdAt}
                  <div>Updated: {formatDate(request.updatedAt)}</div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Pagination Controls -->
      {#if pagination.totalPages > 1}
        <div class="flex items-center justify-between border-t pt-4">
          <div class="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} requests
          </div>
          <div class="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onclick={previousPage}
              disabled={!pagination.hasPreviousPage || isLoading}
            >
              Previous
            </Button>
            <span class="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onclick={nextPage}
              disabled={!pagination.hasNextPage || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => open = false}>
          Close
        </Button>
        <Button type="button" onclick={() => loadRequests()} disabled={isLoading}>
          Refresh
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}