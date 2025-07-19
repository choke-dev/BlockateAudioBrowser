<script lang="ts">
    import * as Popover from "$lib/components/ui/popover/index";
    import * as Select from "$lib/components/ui/select/index";
    import { Separator } from "$lib/components/ui/separator/index";
    import { Button } from '$lib/components/ui/button';
    import Input from "../input/input.svelte";
    
    import IconTablerFilter from '~icons/tabler/filter';
    import LucidePlus from '~icons/lucide/plus';
    import LucideX from '~icons/lucide/x';

    const availableFilters = [
        { label: "Category", value: "category", inputValue: "" },
    ];

    // Props
    let { updateFilters, initialFilters }: {
        updateFilters: (filters: { filters: { label: string, value: string, inputValue: string }[], type: "and" | "or" }) => void;
        initialFilters?: { filters: { label: string, value: string, inputValue: string }[], type: "and" | "or" } | null;
    } = $props();

    // State for the filters
    const filters = $state<{ label: string, value: string, inputValue: string }[]>([]);
    let appliedFilters = $state<{ label: string, value: string, inputValue: string }[]>([]);
    let filterType = $state<"and" | "or">("and");
    let initialized = $state(false);

    // Add a new filter
    const addFilter = () => {
        filters.push({ ...availableFilters[0], inputValue: '' });
    };

    // Remove an existing filter
    const removeFilter = (index: number) => {
        filters.splice(index, 1);
    };

    // Initialize from props
    const initializeFromProps = () => {
        if (initialFilters && !initialized) {
            filters.length = 0;
            filters.push(...initialFilters.filters);
            appliedFilters = Array.from(initialFilters.filters);
            filterType = initialFilters.type;
            initialized = true;
        }
    };

    // Apply filters (expose values)
    const applyFilter = () => {
        appliedFilters = Array.from(filters);
        updateFilters({ filters: appliedFilters, type: filterType });
    };

    // Initialize on mount
    $effect(() => {
        initializeFromProps();
    });
</script>

<div>
    <Popover.Root>
        <Popover.Trigger class="flex items-center p-2 px-4 border rounded-lg text-nowrap">
            {#snippet child({ props })}
                <Button {...props} variant={appliedFilters.length === 0 ? "outline" : "default"} class="flex items-center gap-2">
                    <IconTablerFilter class="h-4 w-4" />
                    <span class="hidden md:block">{appliedFilters.length === 0 ? "Filter" : `Filtered by ${appliedFilters.length} rule${Math.abs(appliedFilters.length) === 1 ? "" : "s"}`}</span>
                </Button>
	        {/snippet}
        </Popover.Trigger>
        <Popover.Content class="p-4 rounded-lg shadow-lg w-[90vw] max-w-[32rem] sm:w-[32rem]">
            {#if filters.length === 0}
                <div>
                    <div class="flex-1">
                        <h1 class="font-bold">No filters applied</h1>
                        <p>Add filters to refine your search</p>
                    </div>
                </div>
            {/if}

            {#each filters as filter, index}
                <div class="mb-4 sm:mb-2">
                    <div class="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                        <!-- Dropdown for filter field -->
                        <Select.Root
                            type="single"
                            name={`filter-${index}`}
                            bind:value={filters[index].label}
                        >
                            <Select.Trigger class="w-full sm:w-[180px]">
                                {filters[index].label
                                    ? filters[index].label
                                    : "Select a filter..."}
                            </Select.Trigger>
                            <Select.Content>
                                {#each availableFilters as availableFilter}
                                    <Select.Item
                                        value={availableFilter.label}
                                        label={availableFilter.label}
                                        onclick={() => {
                                            filters[index].value = availableFilter.value;
                                        }}
                                    >
                                        {availableFilter.label}
                                    </Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>

                        <!-- Input and Remove button container for mobile -->
                        <div class="flex space-x-2 sm:contents">
                            <!-- Input for filter value -->
                            <Input
                                type="text"
                                class="border rounded pl-3 flex-1"
                                bind:value={filters[index].inputValue}
                                placeholder="Enter value"
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        applyFilter();
                                    }
                                }}
                            />

                            <!-- Remove filter button -->
                            <Button
                                class="text-red-500 hover:bg-transparent hover:text-accent-foreground flex-shrink-0"
                                variant="ghost"
                                size="icon"
                                onclick={() => removeFilter(index)}
                            >
                                <LucideX />
                            </Button>
                        </div>
                    </div>
                </div>
            {/each}

            <div class="flex flex-col space-y-2 mt-4 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                <span class="text-sm">Filters must match:</span>
                <Select.Root
                    type="single"
                    name="filter-type"
                    bind:value={filterType}
                >
                    <Select.Trigger class="w-full sm:w-[180px]">
                        {filterType === "or" ? "any filter (OR)" : "all filters (AND)"}
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="or">any filter (OR)</Select.Item>
                        <Select.Item value="and">all filters (AND)</Select.Item>
                    </Select.Content>
                </Select.Root>
            </div>

            <Separator class="my-4" />

            <!-- Add and apply buttons -->
            <div class="flex justify-between items-center mt-4">
                <Button
                    variant="ghost"
                    class="flex items-center"
                    onclick={addFilter}
                >
                    <LucidePlus /> Add filter
                </Button>
                <Button
                    class="px-4 py-2"
                    onclick={applyFilter}
                >
                    Apply filter
                </Button>
            </div>
        </Popover.Content>
    </Popover.Root>
</div>