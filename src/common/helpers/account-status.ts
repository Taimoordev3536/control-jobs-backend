import { EntityManager, IsNull } from 'typeorm';
import { RefreshToken } from '../../modules/auth/entities/refresh-token.entity';

// Two independent gates decide whether someone may log in, and they must stay
// independent:
//
//   cjobs_user.is_active  — owned by the invite / sub-user feature ("invited but
//                           not accepted yet", "member removed").
//   <entity>.active       — owned by the deactivate/reactivate action here.
//
// Nothing in this file writes is_active: recomputing it from the entities would
// silently flip a pending invite to accepted. The entity gate is enforced at
// login instead, via roleAllowsLogin().

// A cjobs_user row can back a worker, a client contact, an employer contact and
// a partner contact at once. Someone with no role links at all (a plain admin)
// is not gated by this check.
export async function roleAllowsLogin(
  manager: EntityManager,
  userId: number,
): Promise<boolean> {
  const [counts] = await manager.query(
    `SELECT
       count(*)::int AS links,
       count(*) FILTER (WHERE is_active)::int AS active_links
     FROM (
       SELECT w.active AS is_active
         FROM "workers_users" wu JOIN "workers" w ON w.id = wu."workerId"
        WHERE wu."userId" = $1
       UNION ALL
       SELECT c.active
         FROM "clients_users" cu JOIN "clients" c ON c.id = cu."clientId"
        WHERE cu."userId" = $1
       UNION ALL
       SELECT e.active
         FROM "employerUsers" eu JOIN "cjobs_empleadores" e ON e.id = eu."employerId"
        WHERE eu."userId" = $1
       UNION ALL
       SELECT p.active
         FROM "cjobs_partnersUsuarios" pu JOIN "cjobs_partners" p ON p.id = pu.partner_id
        WHERE pu.user_id = $1
     ) roles`,
    [userId],
  );

  return counts.links === 0 || counts.active_links > 0;
}

// Deactivating cuts existing sessions loose: refresh tokens die immediately, so
// access is bounded by the remaining access-token TTL.
export async function revokeUserSessions(
  manager: EntityManager,
  userIds: number[],
): Promise<void> {
  if (userIds.length === 0) return;

  for (const userId of userIds) {
    await manager.update(
      RefreshToken,
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
