<script lang="ts">
  import * as Alert from '$lib/components/ui/alert/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { auth } from '$lib/stores/auth.js';
  import { FetchError, ofetch } from 'ofetch';
  import type { Component } from 'svelte';
  import LucideCheck from '~icons/lucide/check';
  import LucideCircleAlert from '~icons/lucide/circle-alert';
  import LucidePlus from '~icons/lucide/plus';
  import LucideShield from '~icons/lucide/shield';
  import AudioAssetSelector from './AudioAssetSelector.svelte';
  import TagInput from './TagInput.svelte';

  interface Tag {
    id: string;
    name: string;
  }

  let { triggerClass = '' } = $props();

  let open = $state(false);
  let isSubmitting = $state(false);
  let showReauthDialog = $state(false);

  // Form data
  let formData = $state({
    audioId: '',
    audioName: '',
    audioCategory: '',
    isPrivate: false,
    tags: [] as Tag[]
  });

  // Form errors
  let errors = $state({
    audioId: '',
    audioName: '',
    audioCategory: ''
  });

  // Messages state (supports both errors and success messages)
  let messages: Array<{ type: Alert.AlertVariant; content: string, icon?: Component }> = $state([]);

  function validateForm() {
    errors.audioId = formData.audioId.trim() ? '' : 'Audio ID is required';
    errors.audioName = formData.audioName.trim() ? '' : 'Audio name is required';
    errors.audioCategory = formData.audioCategory.trim() ? '' : 'Audio category is required';

    return !errors.audioId && !errors.audioName && !errors.audioCategory;
  }

  function resetForm() {
    formData.audioId = '';
    formData.audioName = '';
    formData.audioCategory = '';
    formData.isPrivate = false;
    formData.tags = [];
    errors.audioId = '';
    errors.audioName = '';
    errors.audioCategory = '';
  }

  function resetMessages() {
    messages = [];
  }

  function handleScopeError() {
    showReauthDialog = true;
  }

  async function handleReauthorization() {
    try {
      const response = await ofetch('/api/oauth/roblox/reauthorize', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.success && response.data) {
        // Redirect to OAuth authorization URL with inventory scope
        window.location.href = response.data;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Re-authorization failed:', error);
      messages = [{
        type: 'error',
        content: 'Failed to initiate re-authorization. Please try again.',
        icon: LucideCircleAlert
      }];
    }
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    isSubmitting = true;
    resetMessages();

    try {
      // Prepare the request data with tags as string array
      const requestData = {
        ...formData,
        tags: formData.tags.map(tag => tag.name)
      };

      // Submit the whitelist request with tags included
      const response = await ofetch.raw('/api/whitelist/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        resetForm();
        messages = [{ type: 'success', content: 'Successfully submitted whitelist request', icon: LucideCheck }];
      } else {
        const errorData = response._data;
        messages = [
          { type: 'error', content: errorData.message || 'Failed to submit whitelist request', icon: LucideCircleAlert }
        ];
      }
    } catch (error) {
      if (!(error instanceof FetchError)) return;
      console.error('Error submitting whitelist request:', error);
      messages = [{ type: 'error', content: error.data.error ?? 'An error occurred while submitting the request', icon: LucideCircleAlert }];
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if $auth.authenticated}
  <Dialog.Root bind:open>
    <Dialog.Trigger>
      <Button variant="outline" class={triggerClass} size="sm">
        <LucidePlus class="size-4" />
        <span class="hidden sm:inline ml-2">Request Whitelist</span>
      </Button>
    </Dialog.Trigger>
    <Dialog.Content class="max-w-xl">
      <Dialog.Header>
        <Dialog.Title>Request Audio Whitelist</Dialog.Title>
        <Dialog.Description>
          Submits a request to whitelist an audio ID for use in Blockate
          <br />
          Need help? View the 
          <a
            href="/frequently-asked-questions/whitelist-request-guide"
            class="text-white hover:text-gray-300 underline text-sm"
            target="_blank"
          >
            Whitelist Request Guide
          </a>!
        </Dialog.Description>
      </Dialog.Header>

      {#each messages as message}
        <Alert.Root variant={message.type ?? 'default'}>
          {#if message.icon}
            <message.icon />
          {/if}
          <Alert.Description>
            {message.content}
          </Alert.Description>
        </Alert.Root>
      {/each}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        class="space-y-4"
      >
        <div class="space-y-2">
          <label for="audioId" class="text-sm font-medium">Audio ID <span class="text-red-500">*</span> </label>
          <div class="flex gap-2">
            <Input
              id="audioId"
              bind:value={formData.audioId}
              placeholder="Enter audio ID"
              type="text"
              class={`flex-1 ${errors.audioId ? 'border-red-500' : ''}`}
              disabled={isSubmitting}
            />
            <AudioAssetSelector
              bind:selectedAssetId={formData.audioId}
              bind:selectedAssetName={formData.audioName}
              onScopeError={handleScopeError}
              disabled={isSubmitting}
            />
          </div>
          <p class="text-muted-foreground text-xs">Enter an audio ID manually or select from your inventory</p>
          {#if errors.audioId}
            <p class="text-xs text-red-500">{errors.audioId}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <label for="audioName" class="text-sm font-medium">Audio Name <span class="text-red-500">*</span> </label>
          <Input
            id="audioName"
            bind:value={formData.audioName}
            placeholder="Enter audio name"
            type="text"
            class={errors.audioName ? 'border-red-500' : ''}
            disabled={isSubmitting}
          />
          <p class="text-muted-foreground text-xs">The display name for the audio file</p>
          {#if errors.audioName}
            <p class="text-xs text-red-500">{errors.audioName}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <label for="audioCategory" class="text-sm font-medium">Audio Category <span class="text-red-500">*</span> </label>
          <Input
            id="audioCategory"
            bind:value={formData.audioCategory}
            placeholder="Enter audio category (e.g., Music, Sound Effects, etc.)"
            type="text"
            class={errors.audioCategory ? 'border-red-500' : ''}
            disabled={isSubmitting}
          />
          <p class="text-muted-foreground text-xs">
            Choose any category that best describes this audio
          </p>
          {#if errors.audioCategory}
            <p class="text-xs text-red-500">{errors.audioCategory}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <Checkbox id="isPrivate" bind:checked={formData.isPrivate} disabled={isSubmitting} />
            <label for="isPrivate" class="text-sm font-normal">Is Private</label>
          </div>
          <div class="space-y-1">
            <p class="text-muted-foreground text-xs">
              If checked, this audio will not be searchable in the public database
            </p>
            {#if formData.isPrivate}
              <Alert.Root variant="warning">
                <Alert.Description>
                  This option is ignored if the audio is searchable on the internet (e.g., Google,
                  YouTube, etc.). Publicly available content cannot be made private.
                </Alert.Description>
              </Alert.Root>
            {/if}
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Tags</label>
          <TagInput
            bind:tags={formData.tags}
            placeholder="Add tags to describe this audio..."
            maxTags={16}
            readonly={isSubmitting}
          />
        </div>

        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<!-- Re-authorization Dialog -->
<Dialog.Root bind:open={showReauthDialog}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <LucideShield class="size-5" />
        Additional Permission Required
      </Dialog.Title>
      <Dialog.Description>
        To select audio assets from your inventory, you need to grant additional permissions.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <Alert.Root>
        <LucideCircleAlert />
        <Alert.Description>
          To use this feature, we need permission to view your Roblox inventory. You'll be redirected to Roblox to grant this access and then returned here.
        </Alert.Description>
      </Alert.Root>

      <div class="text-sm text-muted-foreground">
        <p><strong>What this allows:</strong></p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>View your audio assets from your Roblox inventory</li>
          <li>Auto-fill asset information when selecting from your inventory</li>
          <li>Streamline the whitelist request process</li>
        </ul>
      </div>
    </div>

    <Dialog.Footer>
      <Button
        type="button"
        variant="outline"
        onclick={() => (showReauthDialog = false)}
      >
        Cancel
      </Button>
      <Button
        type="button"
        onclick={handleReauthorization}
      >
        Grant Permission
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
