<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import LucideSearch from '~icons/lucide/search';
  import LucideX from '~icons/lucide/x';
  import Button from '../button/button.svelte';

  let {
    value = $bindable(''),
    placeholder = 'Search for audio...',
    onSearch
  }: {
    value?: string;
    placeholder?: string;
    onSearch?: (query: string) => void;
  } = $props();

  function handleSubmit(event: Event) {
    event.preventDefault();
    onSearch?.(value);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSearch?.(value);
    }
  }

  function handleClear() {
    value = '';
    onSearch?.('');
  }
</script>

<div class="flex gap-x-2 w-full max-w-full">
  <form class="flex gap-x-2 w-full max-w-full" onsubmit={handleSubmit}>
    <div class="relative w-full">
      <Input
        bind:value
        {placeholder}
        class="w-full bg-background border-border text-foreground placeholder:text-muted-foreground px-4 pr-10 py-2 rounded-md"
        onkeydown={handleKeydown}
      />
      {#if value}
        <Button
          size="icon"
          variant="ghost"
          onclick={handleClear}
          class="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <LucideX class="size-4" />
        </Button>
      {/if}
    </div>
    <Button size="icon" type="submit">
      <LucideSearch class="size-5" />
    </Button>
  </form>
</div>