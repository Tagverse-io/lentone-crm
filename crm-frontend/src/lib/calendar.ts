import { SOURCE_COLORS } from "./types";
import type { CalendarEvent, CrmEvent, FollowUp, Post, Project, Task } from "./types";

export type { CalendarEvent };
export { SOURCE_COLORS };

interface CalendarSources {
  events: CrmEvent[];
  tasks: Task[];
  projects: Project[];
  followUps: FollowUp[];
  posts: Post[];
  google: { id: string; title: string; start: string; end?: string }[];
}

/** Merge every source into one normalized, time-sorted Central Calendar feed. */
export function mergeCalendar(sources: CalendarSources): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of sources.events) {
    out.push({ id: `crm-${e.id}`, title: e.title, start: e.start, end: e.end, allDay: e.allDay, source: "crm", color: SOURCE_COLORS.crm, description: e.description, link: `/calendar` });
  }
  for (const t of sources.tasks) {
    if (!t.dueDate) continue;
    out.push({ id: `task-${t.id}`, title: `Task: ${t.title}`, start: t.dueDate, source: "task", color: SOURCE_COLORS.task, description: t.description, link: `/tasks` });
  }
  for (const p of sources.projects) {
    if (!p.deadline) continue;
    out.push({ id: `project-${p.id}`, title: `Project due: ${p.title}`, start: p.deadline, source: "project", color: SOURCE_COLORS.project, link: `/projects` });
  }
  for (const f of sources.followUps) {
    out.push({ id: `followup-${f.id}`, title: `Follow-up: ${f.title}`, start: f.dueAt, source: "followup", color: SOURCE_COLORS.followup, description: f.notes, link: `/follow-ups` });
  }
  for (const p of sources.posts) {
    if (!p.scheduledAt) continue;
    out.push({ id: `social-${p.id}`, title: `Post (${p.platform})`, start: p.scheduledAt, source: "social", color: SOURCE_COLORS.social, description: p.content, link: `/content-calendar` });
  }
  for (const g of sources.google) {
    out.push({ id: `google-${g.id}`, title: g.title, start: g.start, end: g.end, source: "google", color: SOURCE_COLORS.google, link: `/calendar` });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
