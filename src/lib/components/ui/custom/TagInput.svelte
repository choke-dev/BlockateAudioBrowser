<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import LucideX from '~icons/lucide/x';
  import LucidePlus from '~icons/lucide/plus';

  interface Tag {
    id: string;
    name: string;
  }

  let {
    tags = $bindable([]),
    placeholder = 'Add a tag...',
    maxTags = 10,
    readonly = false,
    onTagAdd,
    onTagRemove
  }: {
    tags?: Tag[];
    placeholder?: string;
    maxTags?: number;
    readonly?: boolean;
    onTagAdd?: (tag: Tag) => void;
    onTagRemove?: (tag: Tag) => void;
  } = $props();

  let inputValue = $state('');
  let inputElement = $state<any>();

  function addTag() {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;
    
    // Check if tag already exists
    if (tags.some(tag => tag.name.toLowerCase() === trimmedValue.toLowerCase())) {
      inputValue = '';
      return;
    }

    // Check max tags limit
    if (tags.length >= maxTags) {
      return;
    }

    const newTag: Tag = {
      id: crypto.randomUUID(),
      name: trimmedValue
    };

    tags = [...tags, newTag];
    onTagAdd?.(newTag);
    inputValue = '';
  }

  function removeTag(tagToRemove: Tag) {
    if (readonly) return;
    
    tags = tags.filter(tag => tag.id !== tagToRemove.id);
    onTagRemove?.(tagToRemove);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    } else if (event.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      const lastTag = tags[tags.length - 1];
      removeTag(lastTag);
    }
  }

  function handleInputClick() {
    inputElement?.focus();
  }

  function handleContainerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleInputClick();
    }
  }

  function addSuggestedTag(tagName: string) {
    inputValue = tagName;
    addTag();
  }
</script>

<div class="space-y-2">
  <!-- Tags Display -->
  <div
    class="min-h-[2.5rem] p-2 border border-border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
    role="button"
    tabindex="0"
    onclick={handleInputClick}
    onkeydown={handleContainerKeydown}
    aria-label="Click to focus tag input"
  >
    <div class="flex flex-wrap gap-1 items-center">
      <!-- Existing Tags -->
      {#each tags as tag (tag.id)}
        <div class="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
          <span>{tag.name}</span>
          {#if !readonly}
            <Button
              variant="ghost"
              size="icon"
              class="h-4 w-4 p-0 hover:bg-primary/20"
              onclick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
            >
              <LucideX class="h-3 w-3" />
            </Button>
          {/if}
        </div>
      {/each}

      <!-- Input Field -->
      {#if !readonly && tags.length < maxTags}
        <div class="flex-1 min-w-[120px]">
          <Input
            bind:this={inputElement}
            bind:value={inputValue}
            {placeholder}
            class="border-0 p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            onkeydown={handleKeydown}
          />
        </div>
        
        {#if inputValue.trim()}
          <Button
            variant="ghost"
            size="icon"
            class="h-6 w-6 p-0"
            onclick={addTag}
          >
            <LucidePlus class="h-4 w-4" />
          </Button>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Tag Count -->
  {#if maxTags > 0}
    <div class="text-xs text-muted-foreground">
      {tags.length}/{maxTags} tags
    </div>
  {/if}
</div>