import { ref, push, set, update, remove, onValue, off } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // Format: YYYY-MM-DD
  time: string; // Format: HH:MM
  color: string; // Hex color code
  attendees: string[]; // Array of member IDs
  linkedRecord?: { type: 'project', id: string } | null;
}

const getCalendarRef = (companyId: string) => ref(db, `calendar_events/${companyId}`);
const getCalendarItemRef = (companyId: string, eventId: string) => ref(db, `calendar_events/${companyId}/${eventId}`);

export const subscribeToCalendarEvents = (companyId: string, callback: (events: CalendarEvent[]) => void) => {
  const eventsRef = getCalendarRef(companyId);
  onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const items = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      callback(items as CalendarEvent[]);
    } else {
      callback([]);
    }
  });

  return () => off(eventsRef);
};

export const createCalendarEvent = async (companyId: string, event: Omit<CalendarEvent, 'id'>) => {
  const eventsRef = getCalendarRef(companyId);
  const newEventRef = push(eventsRef);
  await set(newEventRef, event);
  return newEventRef.key;
};

export const updateCalendarEvent = async (companyId: string, eventId: string, updates: Partial<CalendarEvent>) => {
  const eventRef = getCalendarItemRef(companyId, eventId);
  await update(eventRef, updates);
};

export const deleteCalendarEvent = async (companyId: string, eventId: string) => {
  const eventRef = getCalendarItemRef(companyId, eventId);
  await remove(eventRef);
};
