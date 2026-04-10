import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const search = url.searchParams.get('search')?.trim() || '';

	let query = `SELECT * FROM activities WHERE 1=1`;
	const params: any[] = [];
	let idx = 1;

	if (search) {
		query += ` AND (activity ILIKE $${idx} OR action_taken ILIKE $${idx})`;
		params.push(`%${search}%`);
		idx++;
	}
	query += ` ORDER BY log_date DESC, log_time DESC`;

	try {
		const activities = await sql.query(query, params);

		for (const activity of activities) {
			const actions = await sql.query(
				`SELECT * FROM activity_actions WHERE activity_id = $1 ORDER BY action_date ASC, action_time ASC`,
				[activity.id]
			);
			activity.actions = actions;
		}

		return json({ success: true, activities });
	} catch (e: any) {
		return json({ success: false, message: e.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	const action = url.searchParams.get('action') || 'save';
	const data = await request.json();

	if (action === 'delete') {
		return deleteActivity(data);
	}
	return saveActivity(data);
};

async function saveActivity(data: any) {
	try {
		let activityId: number;

		// Build legacy text
		let legacyText = data.action_taken || '';
		if (!legacyText && data.actions?.length) {
			legacyText = data.actions
				.map((a: any) => `[${a.date || ''} ${a.time || ''}] ${a.description}`)
				.join(' | ');
		}

		if (!data.id) {
			const result = await sql.query(
				`INSERT INTO activities (log_date, log_time, activity, action_taken)
				 VALUES ($1, $2, $3, $4)
				 RETURNING id`,
				[data.log_date, data.log_time || null, data.activity, legacyText]
			);
			activityId = result[0].id;
		} else {
			await sql.query(
				`UPDATE activities SET
					log_date = $1, log_time = $2, activity = $3, action_taken = $4, updated_at = NOW()
				 WHERE id = $5`,
				[data.log_date, data.log_time || null, data.activity, legacyText, data.id]
			);
			activityId = data.id;
			await sql.query(`DELETE FROM activity_actions WHERE activity_id = $1`, [activityId]);
		}

		if (data.actions?.length) {
			for (const a of data.actions) {
				await sql.query(
					`INSERT INTO activity_actions (activity_id, action_date, action_time, description)
					 VALUES ($1, $2, $3, $4)`,
					[activityId, a.date || null, a.time || null, a.description]
				);
			}
		}

		return json({ success: true, message: 'Activity saved successfully', id: activityId });
	} catch (e: any) {
		return json({ success: false, message: e.message }, { status: 500 });
	}
}

async function deleteActivity(data: any) {
	try {
		await sql.query(`DELETE FROM activity_actions WHERE activity_id = $1`, [data.id]);
		await sql.query(`DELETE FROM activities WHERE id = $1`, [data.id]);
		return json({ success: true, message: 'Activity deleted successfully' });
	} catch (e: any) {
		return json({ success: false, message: e.message }, { status: 500 });
	}
}
