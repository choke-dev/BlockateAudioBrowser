import { db } from '$lib/server/db';
import { user_permissions, permissions } from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

export async function checkUserPermissions(userId: string, nodes: string[]): Promise<boolean> {
	if (nodes.length === 0) {
		return true;
	}

	const result = await db
		.select({
			count: sql<number>`count(*)`
		})
		.from(user_permissions)
		.innerJoin(permissions, eq(user_permissions.permissionId, permissions.id))
		.where(
			and(
				eq(user_permissions.userId, userId),
				inArray(permissions.node, nodes),
				eq(user_permissions.active, true)
			)
		);

	return result[0].count > 0;
}