<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const alertVariants = tv({
		base: "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
		variants: {
			variant: {
			default: "bg-card text-card-foreground border-border",
			destructive: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100 border-red-200 dark:border-red-800 *:data-[slot=alert-description]:text-red-600 dark:*:data-[slot=alert-description]:text-red-300",
			success: "bg-green-100 text-green-800 dark:bg-green-975 dark:text-green-500 border-green-200 dark:border-green-900 *:data-[slot=alert-description]:text-green-700 dark:*:data-[slot=alert-description]:text-green-500",
			info: "bg-blue-100 text-blue-800 dark:bg-blue-975 dark:text-blue-500 border-blue-200 dark:border-blue-900 *:data-[slot=alert-description]:text-blue-700 dark:*:data-[slot=alert-description]:text-blue-500",
			warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-975 dark:text-yellow-500 border-yellow-200 dark:border-yellow-900 *:data-[slot=alert-description]:text-yellow-700 dark:*:data-[slot=alert-description]:text-yellow-500",
			error: "bg-rose-100 text-rose-800 dark:bg-rose-975 dark:text-rose-500 border-rose-200 dark:border-rose-900 *:data-[slot=alert-description]:text-rose-700 dark:*:data-[slot=alert-description]:text-rose-500",
		},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type AlertVariant = VariantProps<typeof alertVariants>["variant"];
</script>

<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: AlertVariant;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert"
	class={cn(alertVariants({ variant }), className)}
	{...restProps}
	role="alert"
>
	{@render children?.()}
</div>
