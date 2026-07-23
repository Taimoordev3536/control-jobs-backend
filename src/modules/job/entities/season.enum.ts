/**
 * Season lives in its own file (not in shift.entity) to break a circular
 * import: shift.entity imports SeasonalSchedule, and seasonal-schedule.entity
 * needs Season at @Column-decoration time. When Season was defined in
 * shift.entity, that cycle could leave it `undefined` at decoration time —
 * harmless while DB_SYNC is off, but it would fail schema creation if sync is
 * ever enabled. A standalone module has no cycle, so Season is always defined.
 */
export enum Season {
  NORMAL = 'normal',
  SUMMER = 'summer',
}
