// shared/utils/event-state.ts
// One definition of "past", "needs finalizing" and "archived", shared by the
// Events page, the Past events page and (the same rule as) the database.
import { EventDashboardStats, EventItem } from '../../core/models';

export function isPast(e: EventItem): boolean {
  return new Date(e.event_date).getTime() < Date.now();
}

/**
 * The event date has passed and something is still unresolved:
 * it's still 'listed', or it has active registrations that never checked in.
 */
export function needsFinalize(e: EventItem, stat?: EventDashboardStats): boolean {
  if (!isPast(e)) return false;
  const unchecked = stat ? stat.registered - stat.checked_in : 0;
  return e.status === 'listed' || unchecked > 0;
}

/** Past and fully resolved: belongs in the Past events archive. */
export function isArchived(e: EventItem, stat?: EventDashboardStats): boolean {
  return isPast(e) && !needsFinalize(e, stat);
}
