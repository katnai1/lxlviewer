<script lang="ts">
	import DecoratedData from '$lib/components/DecoratedData.svelte';
	import FilterPanel from './FilterPanel.svelte';
	import FiltersActive from './FiltersActive.svelte';

	export let data;
</script>

<div class="m-3">
	<FiltersActive mapping={data.searchResult.mapping} />
	<div class="flex">
		<FilterPanel facets={data.searchResult.facetGroups} />
		<main class="w-10/12">
			<ul>
				{#each data.searchResult.items as item (item['@id'])}
					<li>
						<DecoratedData data={item} />
					</li>
					<br />
				{/each}
			</ul>
		</main>
	</div>
</div>
