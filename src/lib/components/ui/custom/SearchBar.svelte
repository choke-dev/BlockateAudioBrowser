<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import LucideSearch from '~icons/lucide/search';
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
</script>

<div class="flex gap-x-2 w-full max-w-full">
  <form class="flex gap-x-2 w-full max-w-full" onsubmit={handleSubmit}>
    <Input
      bind:value
      {placeholder}
      class="w-full bg-background border-border text-foreground placeholder:text-muted-foreground px-4 py-2 rounded-md"
      onkeydown={handleKeydown}
    />
    <Button size="icon" type="submit">
      <LucideSearch class="size-5" />
    </Button>
  </form>
</div>