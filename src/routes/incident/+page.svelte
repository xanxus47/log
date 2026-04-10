<script>
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	let currentPage = $state('incident');
	let sidebarOpen = $state(false);

	let iData = $state([]);
	let iPage = $state(1);
	let iPS = $state(10);
	let iFilter = $state('all');
	let iSearch = $state('');
	let iTimer;
	let iStats = $state({ total: 0, ongoing: 0, monitoring: 0, solved: 0 });

	let aData = $state([]);
	let aPage = $state(1);
	let aPS = $state(10);
	let aSearch = $state('');
	let aTimer;
	let aStats = $state({ total: 0, month: 0, week: 0, today: 0 });

	let iModalOpen = $state(false);
	let iModalTitle = $state('Log New Incident');
	let aModalOpen = $state(false);
	let aModalTitle = $state('New Activity Log');

	let fId = $state('');
	let fDate = $state('');
	let fTime = $state('');
	let fName = $state('');
	let fLocation = $state('');
	let fStreet = $state('');
	let fChannel = $state('');
	let fContact = $state('');
	let fCaller = $state('');
	let fStatus = $state('On-Going Response');
	let fActions = $state([]);

	let afId = $state('');
	let afDate = $state('');
	let afTime = $state('');
	let afActivity = $state('');
	let afActions = $state([]);

	let iAutoTimer;
	let aAutoTimer;
	let iAutosaveState = $state('');
	let iAutosaveText = $state('');
	let aAutosaveState = $state('');
	let aAutosaveText = $state('');

	// Search effects
	$effect(() => {
		const search = iSearch;
		clearTimeout(iTimer);
		iTimer = setTimeout(loadIncidents, 350);
		return () => clearTimeout(iTimer);
	});
	$effect(() => {
		const search = aSearch;
		clearTimeout(aTimer);
		aTimer = setTimeout(loadActivities, 350);
		return () => clearTimeout(aTimer);
	});

	let iSaving = $state(false);
	let aSaving = $state(false);

	let iTotalPg = $derived(Math.max(1, Math.ceil(iData.length / iPS)));
	let iSlice = $derived(iData.slice((iPage - 1) * iPS, iPage * iPS));
	let aTotalPg = $derived(Math.max(1, Math.ceil(aData.length / aPS)));
	let aSlice = $derived(aData.slice((aPage - 1) * aPS, aPage * aPS));

	function fmt12(t) {
		if (!t) return '—';
		const [h, m] = t.split(':').map(Number);
		return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
	}
	function fmtDate(d) {
		if (!d) return '—';
		const str = String(d);
		const date = str.length === 10 ? new Date(str + 'T00:00') : new Date(str);
		if (isNaN(date.getTime())) return '—';
		return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
	}
	function today() { return new Date().toISOString().split('T')[0]; }
	function nowTime() { return new Date().toTimeString().slice(0, 5); }

	function showToast(msg, err = false) {
		if (err) toast.error(msg);
		else toast.success(msg);
	}

	// ── INCIDENTS ──
	async function loadIncidents() {
		let url = '/api/incidents?';
		if (iFilter !== 'all') url += `status=${encodeURIComponent(iFilter)}&`;
		if (iSearch) url += `search=${encodeURIComponent(iSearch)}&`;
		try {
			const res = await fetch(url);
			const d = await res.json();
			if (!d.success) { showToast(d.message, true); return; }
			iData = d.incidents;
			iPage = 1;
			iStats = d.stats;
		} catch (e) { showToast('Failed to load incidents.', true); }
	}

	// iDebounce replaced by $effect above

	function iGoPage(p) { if (p >= 1 && p <= iTotalPg) iPage = p; }
	function iPSChange(e) { iPS = parseInt(e.target.value); iPage = 1; }

	function setIFilter(f) { iFilter = f; iPage = 1; loadIncidents(); }


	// Incident modal
	function openIncidentModal(isEdit = false) {
		if (!isEdit) {
			iModalTitle = 'Log New Incident';
			fId = ''; fDate = today(); fTime = nowTime();
			fName = ''; fLocation = ''; fStreet = '';
			fChannel = ''; fContact = ''; fCaller = '';
			fStatus = 'On-Going Response';
			fActions = [{ date: today(), time: nowTime(), description: '' }];
		}
		iModalOpen = true;
	}
	function closeIncidentModal() { iModalOpen = false; }

	function editIncident(inc) {
		iModalTitle = 'Edit Incident';
		fId = inc.id;
		fDate = inc.incident_date;
		fTime = inc.incident_time || '';
		fName = inc.name;
		fLocation = inc.location || '';
		fStreet = inc.street || '';
		fChannel = inc.channel || '';
		fContact = inc.contact || '';
		fCaller = inc.caller || '';
		fStatus = inc.status;
		fActions = (inc.actions || []).map(a => ({
			date: a.action_date || '',
			time: a.action_time || '',
			description: a.description || ''
		}));
		if (!fActions.length) fActions = [{ date: today(), time: nowTime(), description: '' }];
		openIncidentModal(true);
	}

	function addActionRow() {
		fActions = [...fActions, { date: today(), time: nowTime(), description: '' }];
	}
	function removeActionRow(i) {
		fActions = fActions.filter((_, idx) => idx !== i);
	}

	async function autoSaveIncidentSilent() {
		if (!fName) { alert('Please select Incident Type first.'); return null; }
		const payload = {
			id: fId || null, incident_date: fDate, incident_time: fTime,
			name: fName, location: fLocation, street: fStreet,
			channel: fChannel, contact: fContact, caller: fCaller,
			actions: fActions.filter(a => a.description.trim()),
			status: fStatus
		};
		try {
			const res = await fetch('/api/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			const d = await res.json();
			if (!d.success) { showToast(d.message, true); return null; }
			if (!fId && d.id) fId = d.id;
			return fId;
		} catch (e) { showToast('Auto-save failed.', true); return null; }
	}

	async function autoAddActionRow() {
		iSaving = true;
		try {
			const id = await autoSaveIncidentSilent();
			if (!id) return;
			addActionRow();
			showToast('Action row added & incident saved.');
			loadIncidents();
		} finally { iSaving = false; }
	}

	async function saveIncident() {
		if (!fName) { alert('Incident type is required.'); return; }
		iSaving = true;
		const payload = {
			id: fId || null, incident_date: fDate, incident_time: fTime,
			name: fName, location: fLocation, street: fStreet,
			channel: fChannel, contact: fContact, caller: fCaller,
			actions: fActions.filter(a => a.description.trim()),
			status: fStatus
		};
		try {
			const res = await fetch('/api/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			const d = await res.json();
			if (!d.success) { showToast(d.message, true); return; }
			closeIncidentModal();
			loadIncidents();
			showToast(payload.id ? 'Incident updated.' : 'Incident logged.');
		} catch (e) { showToast('Failed to save incident.', true); }
		finally { iSaving = false; }
	}

	let deleteDialogOpen = $state(false);
	let deleteType = $state('');
	let deleteId = $state('');

	function promptDelete(type, id) {
		deleteType = type;
		deleteId = id;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		deleteDialogOpen = false;
		if (deleteType === 'incident') {
			try {
				const res = await fetch('/api/incidents?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteId }) });
				const d = await res.json();
				if (!d.success) { showToast(d.message, true); return; }
				loadIncidents();
				showToast('Incident deleted.');
			} catch (e) { showToast('Error deleting incident.', true); }
		} else if (deleteType === 'activity') {
			try {
				const res = await fetch('/api/activities?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteId }) });
				const d = await res.json();
				if (!d.success) { showToast(d.message, true); return; }
				loadActivities();
				showToast('Activity deleted.');
			} catch (e) { showToast('Error deleting activity.', true); }
		}
	}

	function exportIncidentCSV() {
		const rows = [['ID', 'Date', 'Incident Time', 'Comm. Channel', 'Contact No.', 'Caller Name', 'Location', 'Street/Purok/Sitio', 'Incident Type', 'Action Date', 'Action Time', 'Action Description', 'Status']];
		iData.forEach(i => {
			if (!i.actions || !i.actions.length) { rows.push([`#${i.id}`, i.incident_date, i.incident_time, i.channel || '', i.contact || '', i.caller || '', i.location || '', i.street || '', i.name, '', '', '', i.status]); return; }
			i.actions.forEach((a, ai) => {
				rows.push(ai === 0
					? [`#${i.id}`, i.incident_date, i.incident_time, i.channel || '', i.contact || '', i.caller || '', i.location || '', i.street || '', i.name, a.action_date || '', a.action_time, a.description, i.status]
					: ['', '', '', '', '', '', '', '', '', a.action_date || '', a.action_time, a.description, '']);
			});
		});
		dlCSV(rows, `incident-log-${today()}.csv`);
	}

	// ── ACTIVITIES ──
	async function loadActivities() {
		let url = '/api/activities?';
		if (aSearch) url += `search=${encodeURIComponent(aSearch)}&`;
		try {
			const res = await fetch(url);
			const d = await res.json();
			if (!d.success) { showToast(d.message, true); return; }
			aData = d.activities;
			aPage = 1;
			const todayStr = today();
			const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
			const monthPfx = todayStr.slice(0, 7);
			aStats = {
				total: aData.length,
				month: aData.filter(a => (a.log_date || '').startsWith(monthPfx)).length,
				week: aData.filter(a => a.log_date >= weekAgo).length,
				today: aData.filter(a => a.log_date === todayStr).length
			};
		} catch (e) { showToast('Failed to load activities.', true); }
	}

	// aDebounce replaced by $effect above

	function aGoPage(p) { if (p >= 1 && p <= aTotalPg) aPage = p; }
	function aPSChange(e) { aPS = parseInt(e.target.value); aPage = 1; }

	function openActivityModal(isEdit = false) {
		if (!isEdit) {
			aModalTitle = 'New Activity Log';
			afId = ''; afDate = today(); afTime = nowTime();
			afActivity = '';
			afActions = [{ date: today(), time: nowTime(), description: '' }];
		}
		aModalOpen = true;
	}
	function closeActivityModal() { aModalOpen = false; }

	function editActivity(a) {
		aModalTitle = 'Edit Activity';
		afId = a.id;
		afDate = a.log_date;
		afTime = a.log_time || '';
		afActivity = a.activity || '';
		if ((a.actions || []).length) {
			afActions = a.actions.map(x => ({ date: x.action_date || '', time: x.action_time || '', description: x.description || '' }));
		} else if (a.action_taken) {
			const parts = a.action_taken.split(' | ').filter(s => s.trim());
			afActions = parts.map(p => {
				const m = p.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\] (.+)$/);
				if (m) return { date: m[1], time: m[2], description: m[3].trim() };
				return { date: '', time: '', description: p.trim() };
			});
		} else {
			afActions = [{ date: today(), time: nowTime(), description: '' }];
		}
		openActivityModal(true);
	}

	function addAActionRow() {
		afActions = [...afActions, { date: today(), time: nowTime(), description: '' }];
	}
	function removeAActionRow(i) {
		afActions = afActions.filter((_, idx) => idx !== i);
	}

	async function autoSaveActivitySilent() {
		if (!afActivity) { alert('Please fill in Activity first.'); return null; }
		const aActs = afActions.filter(a => a.description.trim());
		const legacyText = aActs.map(a => `[${a.date} ${a.time}] ${a.description}`).join(' | ');
		const payload = { id: afId || null, log_date: afDate, log_time: afTime, activity: afActivity, actions: aActs, action_taken: legacyText };
		try {
			const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			const d = await res.json();
			if (!d.success) { showToast(d.message, true); return null; }
			if (!afId && d.id) afId = d.id;
			return afId;
		} catch (e) { showToast('Auto-save failed.', true); return null; }
	}

	async function autoAddAActionRow() {
		aSaving = true;
		try {
			const id = await autoSaveActivitySilent();
			if (!id) return;
			addAActionRow();
			showToast('Action row added & activity saved.');
			loadActivities();
		} finally { aSaving = false; }
	}

	async function saveActivity() {
		if (!afActivity.trim()) { showToast('Activity name is required.', true); return; }
		aSaving = true;
		const aActs = afActions.filter(a => a.description.trim());
		const legacyText = aActs.map(a => `[${a.date} ${a.time}] ${a.description}`).join(' | ');
		const payload = { id: afId || null, log_date: afDate, log_time: afTime, activity: afActivity, actions: aActs, action_taken: legacyText };
		try {
			const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			const d = await res.json();
			if (!d.success) { showToast(d.message, true); return; }
			closeActivityModal();
			loadActivities();
			showToast(payload.id ? 'Activity updated.' : 'Activity logged.');
		} catch (e) { showToast('Failed to save activity.', true); }
		finally { aSaving = false; }
	}

	function exportActivityCSV() {
		const rows = [['ID', 'Date', 'Time', 'Activity', 'Action #', 'Action Date', 'Action Time', 'Action Description']];
		aData.forEach(a => {
			let actions = a.actions || [];
			if (!actions.length && a.action_taken) {
				actions = a.action_taken.split(' | ').filter(s => s.trim()).map(s => {
					const m = s.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\] (.+)$/);
					if (m) return { action_date: m[1], action_time: m[2], description: m[3].trim() };
					return { action_date: '', action_time: '', description: s.trim() };
				});
			}
			if (!actions.length) { rows.push([`#${a.id}`, a.log_date, fmt12(a.log_time) || '', a.activity || '', '', '', '', '']); return; }
			actions.forEach((x, xi) => {
				rows.push(xi === 0
					? [`#${a.id}`, a.log_date, fmt12(a.log_time) || '', a.activity || '', `#${xi + 1}`, x.action_date || '', fmt12(x.action_time) || '', x.description]
					: ['', '', '', '', `#${xi + 1}`, x.action_date || '', fmt12(x.action_time) || '', x.description]);
			});
		});
		dlCSV(rows, `activity-log-${today()}.csv`);
	}

	// ── CSV DOWNLOAD ──
	function dlCSV(rows, filename) {
		const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
		const a = document.createElement('a');
		a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
		a.download = filename; a.click();
	}

	function getActionsForCell(actions, legacyText) {
		if ((!actions || !actions.length) && legacyText) {
			return legacyText.split(' | ').filter(s => s.trim()).map(s => {
				const m = s.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\] (.+)$/);
				if (m) return { action_date: m[1], action_time: m[2], description: m[3].trim() };
				return { action_date: '', action_time: '', description: s.trim() };
			});
		}
		return actions || [];
	}

	// ── PAGINATION HELPERS ──
	function pageNumbers(totalPg, cur) {
		if (totalPg <= 7) return Array.from({ length: totalPg }, (_, i) => i + 1);
		let pages = [1];
		let lo = Math.max(2, cur - 1), hi = Math.min(totalPg - 1, cur + 1);
		if (cur <= 3) { lo = 2; hi = 5; }
		if (cur >= totalPg - 2) { lo = totalPg - 4; hi = totalPg - 1; }
		if (lo > 2) pages.push('…');
		for (let i = lo; i <= hi; i++) pages.push(i);
		if (hi < totalPg - 1) pages.push('…');
		pages.push(totalPg);
		return pages;
	}

	// ── SIDEBAR ──
	function switchPage(pg) {
		currentPage = pg;
		sidebarOpen = false;
		if (pg === 'incident') loadIncidents();
		else loadActivities();
	}

	// ── AUTOSAVE ──
	function triggerIAutosave() {
		clearTimeout(iAutoTimer);
		iAutoTimer = setTimeout(async () => {
			if (!fName) return;
			iAutosaveState = 'saving'; iAutosaveText = 'Saving...';
			const payload = {
				id: fId || null, incident_date: fDate, incident_time: fTime,
				name: fName, location: fLocation, street: fStreet,
				channel: fChannel, contact: fContact, caller: fCaller,
				actions: fActions.filter(a => a.description.trim()), status: fStatus
			};
			try {
				const res = await fetch('/api/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
				const d = await res.json();
				if (!d.success) { iAutosaveState = 'saving'; iAutosaveText = 'Failed'; return; }
				if (!fId && d.id) fId = d.id;
				iAutosaveState = 'saved'; iAutosaveText = '✓ Saved';
				loadIncidents();
				setTimeout(() => { iAutosaveState = ''; }, 2000);
			} catch { iAutosaveState = 'saving'; iAutosaveText = 'Failed'; }
		}, 800);
	}

	function triggerAAutosave() {
		clearTimeout(aAutoTimer);
		aAutoTimer = setTimeout(async () => {
			if (!afActivity) return;
			aAutosaveState = 'saving'; aAutosaveText = 'Saving...';
			const aActs = afActions.filter(a => a.description.trim());
			const legacyText = aActs.map(a => `[${a.date} ${a.time}] ${a.description}`).join(' | ');
			const payload = { id: afId || null, log_date: afDate, log_time: afTime, activity: afActivity, actions: aActs, action_taken: legacyText };
			try {
				const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
				const d = await res.json();
				if (!d.success) { aAutosaveState = 'saving'; aAutosaveText = 'Failed'; return; }
				if (!afId && d.id) afId = d.id;
				aAutosaveState = 'saved'; aAutosaveText = '✓ Saved';
				loadActivities();
				setTimeout(() => { aAutosaveState = ''; }, 2000);
			} catch { aAutosaveState = 'saving'; aAutosaveText = 'Failed'; }
		}, 800);
	}

	onMount(() => {
		loadIncidents();
	});
</script>

{#snippet sidebarNav()}
<div class="flex flex-col h-full">
	<div class="p-5 border-b border-sidebar-border">
		<div class="flex items-center gap-3">
			<div class="size-9 rounded-xl bg-red-600 flex items-center justify-center text-sm font-bold text-white font-mono">M</div>
			<div>
				<div class="text-sm font-semibold text-sidebar-foreground">MDRRMO</div>
				<div class="text-[10px] text-muted-foreground font-mono">Magsaysay, Occ. Mindoro</div>
			</div>
		</div>
	</div>
	<div class="p-3 space-y-1 flex-1">
		<div class="px-3 mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Logs</div>
		<button
			class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors {currentPage === 'incident' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
			onclick={() => switchPage('incident')}
		>
			<span class="text-base">🚨</span>
			<span>Incident Log</span>
			<Badge variant="outline" class="ml-auto text-[10px] font-mono">{iStats.total || '—'}</Badge>
		</button>
		<button
			class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors {currentPage === 'activity' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
			onclick={() => switchPage('activity')}
		>
			<span class="text-base">📋</span>
			<span>Activity Log</span>
			<Badge variant="outline" class="ml-auto text-[10px] font-mono">{aStats.total || '—'}</Badge>
		</button>
	</div>
	<div class="p-4 border-t border-sidebar-border">
		<div class="text-[10px] font-mono text-muted-foreground px-2">v2.0 · SvelteKit · 2025</div>
	</div>
</div>
{/snippet}

<!-- DESKTOP SIDEBAR -->
<aside class="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-sidebar border-r border-sidebar-border">
	{@render sidebarNav()}
</aside>

<!-- MOBILE SIDEBAR -->
<Sheet.Root bind:open={sidebarOpen}>
	<Sheet.Content side="left" class="w-64 p-0 bg-sidebar border-sidebar-border">
		<Sheet.Header class="sr-only">
			<Sheet.Title>Navigation</Sheet.Title>
			<Sheet.Description>App navigation menu</Sheet.Description>
		</Sheet.Header>
		{@render sidebarNav()}
	</Sheet.Content>
</Sheet.Root>

<!-- MAIN -->
<div class="md:ml-64 flex-1 min-h-screen flex flex-col bg-background">
	<!-- TOP BAR -->
	<header class="sticky top-0 z-20 bg-card/80 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Button variant="outline" size="icon" class="md:hidden" onclick={() => sidebarOpen = true}>☰</Button>
			<div>
				<h1 class="text-sm font-semibold">{currentPage === 'incident' ? 'Incident Log' : 'Activity Log'}</h1>
				<p class="text-xs text-muted-foreground font-mono">MDRRMO · Magsaysay, Occidental Mindoro</p>
			</div>
		</div>
		<div class="flex gap-2">
			{#if currentPage === 'incident'}
				<Button variant="outline" size="sm" onclick={exportIncidentCSV}>⬇ Export</Button>
				<Button size="sm" onclick={() => openIncidentModal()}>+ Log Incident</Button>
			{:else}
				<Button variant="outline" size="sm" onclick={exportActivityCSV}>⬇ Export</Button>
				<Button size="sm" onclick={() => openActivityModal()}>+ New Log</Button>
			{/if}
		</div>
	</header>

	<!-- INCIDENT PAGE -->
	{#if currentPage === 'incident'}
	<div class="p-6 max-w-[1600px] mx-auto w-full space-y-6">
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">Total Incidents</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{iStats.total}</div></Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">On-Going Response</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{iStats.ongoing}</div></Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">Under Monitoring</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{iStats.monitoring}</div></Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">Solved</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{iStats.solved}</div></Card.Content>
			</Card.Root>
		</div>

		<div class="flex items-center justify-between gap-4 flex-wrap">
			<Input type="text" placeholder="Search incidents..." class="max-w-xs" bind:value={iSearch} />
			<div class="flex gap-2 flex-wrap">
				<Button variant={iFilter === 'all' ? 'default' : 'outline'} size="sm" onclick={() => setIFilter('all')}>All</Button>
				<Button variant={iFilter === 'On-Going Response' ? 'destructive' : 'outline'} size="sm" onclick={() => setIFilter('On-Going Response')}>On-Going</Button>
				<Button variant={iFilter === 'Under Monitoring' ? 'secondary' : 'outline'} size="sm" onclick={() => setIFilter('Under Monitoring')}>Monitoring</Button>
				<Button variant={iFilter === 'Solved' ? 'default' : 'outline'} size="sm" class={iFilter === 'Solved' ? 'bg-green-600 hover:bg-green-700 text-white' : ''} onclick={() => setIFilter('Solved')}>Solved</Button>
			</div>
		</div>

		<Card.Root>
			<div class="overflow-x-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-16">#</Table.Head>
							<Table.Head>Date</Table.Head>
							<Table.Head>Channel</Table.Head>
							<Table.Head>Contact</Table.Head>
							<Table.Head>Caller</Table.Head>
							<Table.Head>Location</Table.Head>
							<Table.Head>Street</Table.Head>
							<Table.Head>Type</Table.Head>
							<Table.Head class="min-w-[200px]">Actions Taken</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head class="w-20"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if iData.length === 0}
							<Table.Row>
								<Table.Cell colspan={11} class="text-center py-12 text-muted-foreground">
									<div class="text-3xl mb-2">📋</div><p>No incidents found.</p>
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each iSlice as inc}
							<Table.Row>
								<Table.Cell class="font-mono text-xs text-muted-foreground">#{String(inc.id).padStart(3, '0')}</Table.Cell>
								<Table.Cell class="font-mono text-xs whitespace-nowrap">
									<div>{fmtDate(inc.incident_date)}</div>
									<div class="text-muted-foreground">{fmt12(inc.incident_time)}</div>
								</Table.Cell>
								<Table.Cell>{inc.channel || '—'}</Table.Cell>
								<Table.Cell class="whitespace-nowrap">{inc.contact || '—'}</Table.Cell>
								<Table.Cell>{inc.caller || '—'}</Table.Cell>
								<Table.Cell>{inc.location || '—'}</Table.Cell>
								<Table.Cell>{inc.street || '—'}</Table.Cell>
								<Table.Cell class="font-medium">{inc.name}</Table.Cell>
								<Table.Cell>
									{#each [getActionsForCell(inc.actions)] as cellActions}
									{#if cellActions.length}
										<Popover.Root>
											<Popover.Trigger>
												<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors text-left max-w-[220px]">
													<span class="text-xs truncate flex-1">{cellActions[0].description}</span>
													{#if cellActions.length > 1}<Badge variant="secondary" class="text-[10px] font-mono shrink-0">{cellActions.length}</Badge>{/if}
												</button>
											</Popover.Trigger>
											<Popover.Content class="w-80">
												<div class="space-y-2">
													<h4 class="text-xs font-mono uppercase tracking-wider text-muted-foreground">Actions Taken</h4>
													<Separator />
													{#each cellActions as a, i}
													<div class="rounded-lg bg-muted/50 border border-border p-3 space-y-1">
														<div class="flex items-center gap-2">
															<Badge variant="secondary" class="text-[10px] font-mono">#{i + 1}</Badge>
															<span class="text-[10px] font-mono text-muted-foreground">{a.action_date ? fmtDate(a.action_date) + ' · ' : ''}{fmt12(a.action_time)}</span>
														</div>
														<p class="text-xs leading-relaxed">{a.description}</p>
													</div>
													{/each}
												</div>
											</Popover.Content>
										</Popover.Root>
									{:else}
										<span class="text-xs text-muted-foreground">—</span>
									{/if}
									{/each}
								</Table.Cell>
								<Table.Cell>
									{#if inc.status === 'On-Going Response'}
										<Badge variant="destructive">On-Going</Badge>
									{:else if inc.status === 'Under Monitoring'}
										<Badge variant="outline" class="border-yellow-500/30 text-yellow-500">Monitoring</Badge>
									{:else}
										<Badge variant="secondary" class="text-green-500">Solved</Badge>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<div class="flex gap-1">
										<Button variant="ghost" size="icon-sm" onclick={() => editIncident(inc)}>✎</Button>
										<Button variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive" onclick={() => promptDelete('incident', inc.id)}>✕</Button>
									</div>
								</Table.Cell>
							</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
			{#if iData.length > 0}
			<div class="flex items-center justify-between px-4 py-3 border-t border-border flex-wrap gap-3">
				<div class="flex items-center gap-2 text-xs font-mono text-muted-foreground">
					Rows
					<select class="bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground" value={iPS} onchange={iPSChange}>
						<option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
					</select>
				</div>
				<span class="text-xs font-mono text-muted-foreground">{(iPage-1)*iPS+1}–{Math.min(iPage*iPS, iData.length)} of {iData.length}</span>
				<div class="flex items-center gap-1">
					<Button variant="outline" size="icon-sm" disabled={iPage === 1} onclick={() => iGoPage(iPage - 1)}>‹</Button>
					{#each pageNumbers(iTotalPg, iPage) as p}
						{#if p === '…'}
							<span class="px-1 text-xs text-muted-foreground">…</span>
						{:else}
							<Button variant={p === iPage ? 'default' : 'outline'} size="icon-sm" onclick={() => iGoPage(p)}>{p}</Button>
						{/if}
					{/each}
					<Button variant="outline" size="icon-sm" disabled={iPage === iTotalPg} onclick={() => iGoPage(iPage + 1)}>›</Button>
				</div>
			</div>
			{/if}
		</Card.Root>
	</div>
	{/if}

	<!-- ACTIVITY PAGE -->
	{#if currentPage === 'activity'}
	<div class="p-6 max-w-[1600px] mx-auto w-full space-y-6">
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">Total Activities</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{aStats.total}</div></Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">This Month</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{aStats.month}</div></Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">This Week</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{aStats.week}</div></Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header class="pb-1 pt-4 px-5"><Card.Description class="text-[11px] uppercase tracking-wider font-mono">Today</Card.Description></Card.Header>
				<Card.Content class="px-5 pb-4"><div class="text-3xl font-bold font-mono">{aStats.today}</div></Card.Content>
			</Card.Root>
		</div>

		<div class="flex items-center gap-4">
			<Input type="text" placeholder="Search activities..." class="max-w-xs" bind:value={aSearch} />
		</div>

		<Card.Root>
			<div class="overflow-x-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-16">#</Table.Head>
							<Table.Head>Date</Table.Head>
							<Table.Head>Time</Table.Head>
							<Table.Head>Activity</Table.Head>
							<Table.Head class="min-w-[200px]">Action Taken</Table.Head>
							<Table.Head class="w-20"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if aData.length === 0}
							<Table.Row>
								<Table.Cell colspan={6} class="text-center py-12 text-muted-foreground">
									<div class="text-3xl mb-2">📋</div><p>No activities found.</p>
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each aSlice as a}
							<Table.Row>
								<Table.Cell class="font-mono text-xs text-muted-foreground">#{String(a.id).padStart(3, '0')}</Table.Cell>
								<Table.Cell class="font-mono text-xs whitespace-nowrap">{fmtDate(a.log_date)}</Table.Cell>
								<Table.Cell class="font-mono text-xs text-muted-foreground">{fmt12(a.log_time)}</Table.Cell>
								<Table.Cell class="font-medium">{a.activity || '—'}</Table.Cell>
								<Table.Cell>
									{#each [getActionsForCell(a.actions, a.action_taken)] as cellActions}
									{#if cellActions.length}
										<Popover.Root>
											<Popover.Trigger>
												<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors text-left max-w-[220px]">
													<span class="text-xs truncate flex-1">{cellActions[0].description}</span>
													{#if cellActions.length > 1}<Badge variant="secondary" class="text-[10px] font-mono shrink-0">{cellActions.length}</Badge>{/if}
												</button>
											</Popover.Trigger>
											<Popover.Content class="w-80">
												<div class="space-y-2">
													<h4 class="text-xs font-mono uppercase tracking-wider text-muted-foreground">Actions Taken</h4>
													<Separator />
													{#each cellActions as act, i}
													<div class="rounded-lg bg-muted/50 border border-border p-3 space-y-1">
														<div class="flex items-center gap-2">
															<Badge variant="secondary" class="text-[10px] font-mono">#{i + 1}</Badge>
															<span class="text-[10px] font-mono text-muted-foreground">{act.action_date ? fmtDate(act.action_date) + ' · ' : ''}{fmt12(act.action_time)}</span>
														</div>
														<p class="text-xs leading-relaxed">{act.description}</p>
													</div>
													{/each}
												</div>
											</Popover.Content>
										</Popover.Root>
									{:else}
										<span class="text-xs text-muted-foreground">—</span>
									{/if}
									{/each}
								</Table.Cell>
								<Table.Cell>
									<div class="flex gap-1">
										<Button variant="ghost" size="icon-sm" onclick={() => editActivity(a)}>✎</Button>
										<Button variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive" onclick={() => promptDelete('activity', a.id)}>✕</Button>
									</div>
								</Table.Cell>
							</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
			{#if aData.length > 0}
			<div class="flex items-center justify-between px-4 py-3 border-t border-border flex-wrap gap-3">
				<div class="flex items-center gap-2 text-xs font-mono text-muted-foreground">
					Rows
					<select class="bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground" value={aPS} onchange={aPSChange}>
						<option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
					</select>
				</div>
				<span class="text-xs font-mono text-muted-foreground">{(aPage-1)*aPS+1}–{Math.min(aPage*aPS, aData.length)} of {aData.length}</span>
				<div class="flex items-center gap-1">
					<Button variant="outline" size="icon-sm" disabled={aPage === 1} onclick={() => aGoPage(aPage - 1)}>‹</Button>
					{#each pageNumbers(aTotalPg, aPage) as p}
						{#if p === '…'}
							<span class="px-1 text-xs text-muted-foreground">…</span>
						{:else}
							<Button variant={p === aPage ? 'default' : 'outline'} size="icon-sm" onclick={() => aGoPage(p)}>{p}</Button>
						{/if}
					{/each}
					<Button variant="outline" size="icon-sm" disabled={aPage === aTotalPg} onclick={() => aGoPage(aPage + 1)}>›</Button>
				</div>
			</div>
			{/if}
		</Card.Root>
	</div>
	{/if}
</div>

<!-- INCIDENT DIALOG -->
<Dialog.Root bind:open={iModalOpen}>
	<Dialog.Content class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{iModalTitle}</Dialog.Title>
			<Dialog.Description class="sr-only">Incident form</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<label for="i-location" class="text-sm font-medium">Location</label>
					<select id="i-location" class="w-full h-9 rounded-lg border border-input bg-input/30 px-3 text-sm" bind:value={fLocation} onchange={triggerIAutosave}>
						<option value="">— Select Barangay —</option>
						<option>Alibog</option><option>Caguray</option><option>Calawag</option>
						<option>Gapasan</option><option>Laste</option><option>Lourdes</option>
						<option>Nicolas</option><option>Paclolo</option><option>Poblacion</option>
						<option>Purnaga</option><option>Sta Teresa</option><option>Sibalat</option>
					</select>
				</div>
				<div class="space-y-2">
					<label for="i-street" class="text-sm font-medium">Street / Purok / Sitio</label>
					<Input id="i-street" bind:value={fStreet} oninput={triggerIAutosave} placeholder="e.g. Purok 3, Sitio Mabini..." />
				</div>
			</div>
			<div class="space-y-2">
				<label for="i-type" class="text-sm font-medium">Incident Type</label>
				<select id="i-type" class="w-full h-9 rounded-lg border border-input bg-input/30 px-3 text-sm" bind:value={fName} onchange={triggerIAutosave}>
					<option value="">— Select Incident Type —</option>
					<optgroup label="Vehicular Accidents">
						<option>Lone Vehicular</option><option>Pedestrian-Vehicle</option><option>Animal Vehicle</option>
						<option>Head-On Collision</option><option>Rear-End Collision</option><option>Side-Impact Collision</option>
						<option>Multiple Vehicular</option><option>Mechanical Incident</option>
					</optgroup>
					<optgroup label="Human Incidents">
						<option>Self-Induced</option><option>Human Violence</option><option>Medical Emergency</option>
						<option>Mass Casualty</option><option>Drowning</option>
					</optgroup>
					<optgroup label="Fire Incidents">
						<option>Residential Fire</option><option>Commercial Fire</option><option>Bush Fire</option><option>Grass Fire</option>
					</optgroup>
					<optgroup label="Water & Armed">
						<option>Capsized Boat</option><option>Insurgency</option>
					</optgroup>
					<optgroup label="Natural Disasters">
						<option>Flood</option><option>Tsunami</option><option>Landslide</option><option>Earthquake</option>
						<option>Storm Surge</option><option>Typhoon</option><option>Drought</option><option>Tornado</option><option>Hurricane</option>
					</optgroup>
				</select>
			</div>
			<div class="space-y-2">
				<label for="i-channel" class="text-sm font-medium">Communication Channel</label>
				<select id="i-channel" class="w-full h-9 rounded-lg border border-input bg-input/30 px-3 text-sm" bind:value={fChannel} onchange={triggerIAutosave}>
					<option value="">— Select Channel —</option>
					<option>Phone Call</option><option>Text Message</option><option>Email</option>
					<option>Radio</option><option>Social Media</option>
				</select>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<label for="i-contact" class="text-sm font-medium">Contact Number</label>
					<Input id="i-contact" bind:value={fContact} oninput={triggerIAutosave} placeholder="e.g. 09171234567" />
				</div>
				<div class="space-y-2">
					<label for="i-caller" class="text-sm font-medium">Name of Caller</label>
					<Input id="i-caller" bind:value={fCaller} oninput={triggerIAutosave} placeholder="Full name..." />
				</div>
			</div>
			<div class="space-y-2">
				<label class="text-sm font-medium">Actions Taken</label>
				<div class="space-y-3">
					{#each fActions as action, i}
					<div class="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
						<div class="flex items-center gap-2">
							<Badge variant="secondary" class="text-[10px] font-mono">#{i + 1}</Badge>
							<input type="time" class="h-8 rounded-md border border-input bg-input/30 px-2 text-xs font-mono flex-1" bind:value={action.time} oninput={triggerIAutosave}>
							<Button variant="ghost" size="icon-xs" class="text-destructive" onclick={() => removeActionRow(i)}>✕</Button>
						</div>
						<Input bind:value={action.description} oninput={triggerIAutosave} placeholder="Describe action taken..." />
					</div>
					{/each}
				</div>
				<Button variant="outline" size="sm" class="w-full mt-2" disabled={iSaving} onclick={autoAddActionRow}>
					{iSaving ? '⟳ Saving...' : '+ Add Action'}
				</Button>
			</div>
			<div class="space-y-2">
				<label for="i-status" class="text-sm font-medium">Status</label>
				<select id="i-status" class="w-full h-9 rounded-lg border border-input bg-input/30 px-3 text-sm" bind:value={fStatus} onchange={triggerIAutosave}>
					<option value="On-Going Response">On-Going Response</option>
					<option value="Under Monitoring">Under Monitoring</option>
					<option value="Solved">Solved</option>
				</select>
			</div>
		</div>
		<Dialog.Footer class="flex items-center justify-between">
			<div class="flex items-center gap-2 text-xs font-mono text-muted-foreground">
				{#if iAutosaveState === 'saving'}
					<div class="size-2 rounded-full bg-yellow-500 animate-pulse"></div><span>{iAutosaveText}</span>
				{:else if iAutosaveState === 'saved'}
					<div class="size-2 rounded-full bg-green-500"></div><span>{iAutosaveText}</span>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={closeIncidentModal}>Cancel</Button>
				<Button disabled={iSaving} onclick={saveIncident}>{iSaving ? 'Saving...' : 'Save Incident'}</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- ACTIVITY DIALOG -->
<Dialog.Root bind:open={aModalOpen}>
	<Dialog.Content class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{aModalTitle}</Dialog.Title>
			<Dialog.Description class="sr-only">Activity form</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<label for="a-date" class="text-sm font-medium">Date</label>
					<input id="a-date" type="date" class="w-full h-9 rounded-lg border border-input bg-input/30 px-3 text-sm" bind:value={afDate}>
				</div>
				<div class="space-y-2">
					<label for="a-time" class="text-sm font-medium">Time</label>
					<input id="a-time" type="time" class="w-full h-9 rounded-lg border border-input bg-input/30 px-3 text-sm" bind:value={afTime}>
				</div>
			</div>
			<div class="space-y-2">
				<label for="a-activity" class="text-sm font-medium">Activity</label>
				<Input id="a-activity" bind:value={afActivity} oninput={triggerAAutosave} placeholder="e.g. Monitoring of flood-prone areas..." />
			</div>
			<div class="space-y-2">
				<label class="text-sm font-medium">Actions Taken</label>
				<div class="space-y-3">
					{#each afActions as action, i}
					<div class="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
						<div class="flex items-center gap-2">
							<Badge variant="secondary" class="text-[10px] font-mono">#{i + 1}</Badge>
							<input type="time" class="h-8 rounded-md border border-input bg-input/30 px-2 text-xs font-mono flex-1" bind:value={action.time} oninput={triggerAAutosave}>
							<Button variant="ghost" size="icon-xs" class="text-destructive" onclick={() => removeAActionRow(i)}>✕</Button>
						</div>
						<Input bind:value={action.description} oninput={triggerAAutosave} placeholder="Describe action taken..." />
					</div>
					{/each}
				</div>
				<Button variant="outline" size="sm" class="w-full mt-2" disabled={aSaving} onclick={autoAddAActionRow}>
					{aSaving ? '⟳ Saving...' : '+ Add Action'}
				</Button>
			</div>
		</div>
		<Dialog.Footer class="flex items-center justify-between">
			<div class="flex items-center gap-2 text-xs font-mono text-muted-foreground">
				{#if aAutosaveState === 'saving'}
					<div class="size-2 rounded-full bg-yellow-500 animate-pulse"></div><span>{aAutosaveText}</span>
				{:else if aAutosaveState === 'saved'}
					<div class="size-2 rounded-full bg-green-500"></div><span>{aAutosaveText}</span>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={closeActivityModal}>Cancel</Button>
				<Button disabled={aSaving} onclick={saveActivity}>{aSaving ? 'Saving...' : 'Save Activity'}</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- DELETE CONFIRMATION DIALOG -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {deleteType === 'incident' ? 'Incident' : 'Activity'}?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete this record and remove its data from our servers.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" onclick={confirmDelete}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
