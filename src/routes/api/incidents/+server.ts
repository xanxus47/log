import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const search = url.searchParams.get('search')?.trim() || '';
	const status = url.searchParams.get('status') || '';

	let query = `SELECT * FROM incidents WHERE 1=1`;
	const params: any[] = [];
	let idx = 1;

	if (search) {
		query += ` AND (name ILIKE $${idx} OR location ILIKE $${idx} OR caller ILIKE $${idx} OR street ILIKE $${idx})`;
		params.push(`%${search}%`);
		idx++;
	}
	if (status && status !== 'all') {
		query += ` AND status = $${idx}`;
		params.push(status);
		idx++;
	}
	query += ` ORDER BY incident_date DESC, incident_time DESC`;

	try {
		const incidents = await sql.query(query, params);

		// Fetch actions for each incident
		for (const incident of incidents) {
			const actions = await sql.query(
				`SELECT * FROM incident_actions WHERE incident_id = $1 ORDER BY action_date ASC, action_time ASC`,
				[incident.id]
			);
			incident.actions = actions;
		}

		// Stats
		const statsRows = await sql.query(
			`SELECT status, COUNT(*)::int as count FROM incidents GROUP BY status`
		);
		const stats = { total: 0, ongoing: 0, monitoring: 0, solved: 0 };
		for (const row of statsRows) {
			if (row.status === 'On-Going Response') stats.ongoing = row.count;
			else if (row.status === 'Under Monitoring') stats.monitoring = row.count;
			else if (row.status === 'Solved') stats.solved = row.count;
			stats.total += row.count;
		}

		return json({ success: true, incidents, stats });
	} catch (e: any) {
		return json({ success: false, message: e.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	const action = url.searchParams.get('action') || 'save';
	const data = await request.json();

	if (action === 'delete') {
		return deleteIncident(data);
	}
	return saveIncident(data);
};

async function saveIncident(data: any) {
	try {
		let incidentId: number;

		if (!data.id) {
			const result = await sql.query(
				`INSERT INTO incidents (incident_date, incident_time, name, location, street, channel, contact, caller, status)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				 RETURNING id`,
				[data.incident_date, data.incident_time || null, data.name, data.location || '', data.street || '', data.channel || '', data.contact || '', data.caller || '', data.status || 'On-Going Response']
			);
			incidentId = result[0].id;
		} else {
			await sql.query(
				`UPDATE incidents SET
					incident_date = $1, incident_time = $2, name = $3, location = $4,
					street = $5, channel = $6, contact = $7, caller = $8, status = $9, updated_at = NOW()
				 WHERE id = $10`,
				[data.incident_date, data.incident_time || null, data.name, data.location || '', data.street || '', data.channel || '', data.contact || '', data.caller || '', data.status, data.id]
			);
			incidentId = data.id;
			await sql.query(`DELETE FROM incident_actions WHERE incident_id = $1`, [incidentId]);
		}

		if (data.actions?.length) {
			for (let i = 0; i < data.actions.length; i++) {
				const a = data.actions[i];
				await sql.query(
					`INSERT INTO incident_actions (incident_id, action_date, action_time, description, sequence_order)
					 VALUES ($1, $2, $3, $4, $5)`,
					[incidentId, a.date || null, a.time || null, a.description, i]
				);
			}
		}

		return json({ success: true, message: 'Incident saved successfully', id: incidentId });
	} catch (e: any) {
		return json({ success: false, message: e.message }, { status: 500 });
	}
}

async function deleteIncident(data: any) {
	try {
		await sql.query(`DELETE FROM incident_actions WHERE incident_id = $1`, [data.id]);
		await sql.query(`DELETE FROM incidents WHERE id = $1`, [data.id]);
		return json({ success: true, message: 'Incident deleted successfully' });
	} catch (e: any) {
		return json({ success: false, message: e.message }, { status: 500 });
	}
}
