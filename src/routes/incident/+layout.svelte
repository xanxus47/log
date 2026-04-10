<script>
  import './app.css';
  import './layout.css';
  import { Toaster } from '$lib/components/ui/sonner/index.js';
  let { children } = $props();
</script>

<svelte:head>
  <!-- nothing needed here -->
</svelte:head>

{@render children()}
<Toaster richColors position="bottom-right" />