<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	onMount(() => {
		goto(`${base}/dashboard`, { replaceState: true });
	});
</script>

<div class="flex items-center justify-center min-h-[60vh]">
	<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
</div>
