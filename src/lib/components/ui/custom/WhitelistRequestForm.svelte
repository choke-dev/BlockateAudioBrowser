<script lang="ts">
  import { auth } from '$lib/stores/auth.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Form from '$lib/components/ui/form/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Alert from '$lib/components/ui/alert/index.js';
  import LucidePlus from '~icons/lucide/plus';
  import { FetchError, ofetch } from 'ofetch';

  let { triggerClass = '' } = $props();

  let open = $state(false);
  let isSubmitting = $state(false);

  // Form data
  let formData = $state({
    audioId: '',
    audioName: '',
    audioCategory: '',
    isPrivate: false
  });

  // Form errors
  let errors = $state({
    audioId: '',
    audioName: '',
    audioCategory: ''
  });

  // Messages state (supports both errors and success messages)
  let messages: Array<{ type: 'error' | 'success'; content: string }> = $state([]);

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
    errors.audioId = '';
    errors.audioName = '';
    errors.audioCategory = '';
    messages = [];
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    isSubmitting = true;
    messages = []; // Clear any previous messages

    try {
      const response = await ofetch.raw('/api/whitelist/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        resetForm();
        messages = [{ type: 'success', content: 'Whitelist request submitted successfully!' }];
      } else {
        const errorData = response._data;
        messages = [
          { type: 'error', content: errorData.message || 'Failed to submit whitelist request' }
        ];
      }
    } catch (error) {
      if (!(error instanceof FetchError)) return;
      console.error('Error submitting whitelist request:', error);
      messages = [
        {
          type: 'error',
          content: error.data.error ?? 'An error occurred while submitting the request'
        }
      ];
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if $auth.authenticated}
  <Dialog.Root bind:open>
    <Dialog.Trigger>
      <Button variant="outline" class={triggerClass}>
        <LucidePlus class="size-4" />
        Request Whitelist
      </Button>
    </Dialog.Trigger>
    <Dialog.Content class="max-w-xl">
      <Dialog.Header>
        <Dialog.Title>Request Audio Whitelist</Dialog.Title>
        <Dialog.Description>
          Submits a request to whitelist an audio ID for use in Blockate
        </Dialog.Description>
      </Dialog.Header>

      {#each messages as message}
        <Alert.Root variant={message.type ?? 'default'}>
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
          <label for="audioId" class="text-sm font-medium">Audio ID</label>
          <Input
            id="audioId"
            bind:value={formData.audioId}
            placeholder="Enter audio ID"
            type="text"
            class={errors.audioId ? 'border-red-500' : ''}
          />
          <p class="text-muted-foreground text-xs">The unique identifier for the audio file</p>
          {#if errors.audioId}
            <p class="text-xs text-red-500">{errors.audioId}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <label for="audioName" class="text-sm font-medium">Audio Name</label>
          <Input
            id="audioName"
            bind:value={formData.audioName}
            placeholder="Enter audio name"
            type="text"
            class={errors.audioName ? 'border-red-500' : ''}
          />
          <p class="text-muted-foreground text-xs">The display name for the audio file</p>
          {#if errors.audioName}
            <p class="text-xs text-red-500">{errors.audioName}</p>
          {/if}
        </div>

        <div class="space-y-2">
          <label for="audioCategory" class="text-sm font-medium">Audio Category</label>
          <Input
            id="audioCategory"
            bind:value={formData.audioCategory}
            placeholder="Enter audio category (e.g., Music, Sound Effects, etc.)"
            type="text"
            class={errors.audioCategory ? 'border-red-500' : ''}
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
            <Checkbox id="isPrivate" bind:checked={formData.isPrivate} />
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
