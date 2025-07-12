<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Blockate Audio Browser FAQ - {data.meta.title}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={data.meta.title} />
	<meta name="description" content={data.meta.title} />
	{#if data.meta.tags}
		<meta name="keywords" content={data.meta.tags} />
	{/if}
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-5xl">
	<h1 class="text-4xl font-bold mb-8">{data.meta.title}</h1>
	<div class="prose dark:prose-invert w-full max-w-none">
		<data.content />
	</div>
</div>
