<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index';
	import * as Select from '$lib/components/ui/select/index';
	import { Separator } from '$lib/components/ui/separator/index';
	import Button from '../button/button.svelte';

	import LucideArrowUpDown from '~icons/lucide/arrow-up-down';

	const sortOptions = [
		{ label: 'ID', value: 'id' },
		{ label: 'Name', value: 'name' },
		{ label: 'Category', value: 'category' },
		{ label: 'Date Added', value: 'created_at' }
	];

	const sortDirections = [
		{ label: 'Ascending', value: 'asc' },
		{ label: 'Descending', value: 'desc' }
	];

	const sortDirectionsCreatedAt = [
		{ label: 'Oldest first', value: 'asc' },
		{ label: 'Newest first', value: 'desc' }
	];

	// State for the sort
	let sortField = $state<string>('name');
	let sortOrder = $state<'asc' | 'desc'>('asc');
	let appliedSort = $state<{ field: string; order: 'asc' | 'desc' } | null>(null);
	let { updateSort } = $props();

	// Apply sort (expose values)
	const applySort = () => {
		appliedSort = { field: sortField, order: sortOrder };
		updateSort(appliedSort);
	};

	// Reset sort
	const resetSort = () => {
		sortField = 'name';
		sortOrder = 'asc';
		appliedSort = null;
		updateSort(null);
	};
</script>

<div>
	<Popover.Root>
		<Popover.Trigger class="flex items-center text-nowrap rounded-lg border p-2 px-4">
			{#snippet child({ props })}
				<Button
					{...props}
					variant={appliedSort === null ? 'outline' : 'default'}
					class="flex items-center"
				>
					<LucideArrowUpDown class="mr-2" />
					{appliedSort === null
						? 'Sort'
						: `Sorted by ${sortOptions.find((opt) => opt.value === appliedSort?.field)?.label} (${appliedSort?.field === 'created_at' ? (sortOrder === 'asc' ? 'Oldest first' : 'Newest first') : sortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-[32rem] rounded-lg p-4 shadow-lg">
			<div class="mb-4 flex items-center space-x-2">
				<span class="text-sm">Sort by:</span>
				<Select.Root type="single" name="sort-field" bind:value={sortField}>
					<Select.Trigger class="w-[180px]">
						{sortOptions.find((opt) => opt.value === sortField)?.label || 'Select field...'}
					</Select.Trigger>
					<Select.Content>
						{#each sortOptions as option}
							<Select.Item value={option.value} label={option.label}>
								{option.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				<span class="text-sm">Order:</span>
				<Select.Root type="single" name="sort-order" bind:value={sortOrder}>
					<Select.Trigger class="w-[180px]">
						{sortField === 'created_at'
							? sortDirectionsCreatedAt.find((dir) => dir.value === sortOrder)?.label
							: sortDirections.find((dir) => dir.value === sortOrder)?.label}
					</Select.Trigger>
					<Select.Content>
						{#each sortField === 'created_at' ? sortDirectionsCreatedAt : sortDirections as direction}
							<Select.Item value={direction.value} label={direction.label}>
								{direction.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<Separator class="my-4" />

			<!-- Apply and reset buttons -->
			<div class="mt-4 flex items-center justify-between">
				<Button variant="ghost" class="flex items-center" onclick={resetSort}>Reset</Button>
				<Button class="px-4 py-2" onclick={applySort}>Apply sort</Button>
			</div>
		</Popover.Content>
	</Popover.Root>
</div>
