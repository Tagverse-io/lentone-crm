import { ref, push, set, get, update, remove, onValue, off } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

export interface ScheduledEvent {
  id: string | number;
  date: string | number; // kept for backward compatibility
  startDate?: string; // Format: YYYY-MM-DD
  endDate?: string; // Format: YYYY-MM-DD
  title: string;
  channel: string;
  time?: string; // Optional - kept for backward compatibility
  type?: string;
  author: string; // Member ID or legacy name string
  workspace_id?: string; // Added for strict company hierarchy isolation
  client?: string;
  badgeChannel?: string;
  badgeStatus?: string;
  status?: string;
  color?: string;
  description?: string; // Optional event description
}

const getCalendarRef = (companyId: string) => ref(db, `orgs/${companyId}/marketing_calendars`);
const getCalendarItemRef = (companyId: string, eventId: string | number) => ref(db, `orgs/${companyId}/marketing_calendars/${eventId}`);

export const subscribeToCalendar = (companyId: string, callback: (events: ScheduledEvent[]) => void) => {
  const eventsRef = getCalendarRef(companyId);
  onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const items = Object.keys(data).reduce((acc, key) => {
        const val = data[key];
        // Enforce strict company-level hierarchy identical to leads
        if (val && typeof val === 'object' && (val.workspace_id === companyId || val.company_id === companyId || !val.workspace_id)) {
          acc.push({ id: key, ...val });
        }
        return acc;
      }, [] as ScheduledEvent[]);
      callback(items);
    } else {
      callback([]);
    }
  });

  return () => off(eventsRef);
};

export const createCalendarEvent = async (companyId: string, event: Omit<ScheduledEvent, 'id'>) => {
  const eventsRef = getCalendarRef(companyId);
  const newEventRef = push(eventsRef);
  await set(newEventRef, { ...event, workspace_id: companyId });
  return newEventRef.key;
};

export const updateCalendarEvent = async (companyId: string, eventId: string | number, updates: Partial<ScheduledEvent>) => {
  const eventRef = getCalendarItemRef(companyId, eventId);
  await update(eventRef, updates);
};

export const deleteCalendarEvent = async (companyId: string, eventId: string | number) => {
  const eventRef = getCalendarItemRef(companyId, eventId);
  await remove(eventRef);
};
