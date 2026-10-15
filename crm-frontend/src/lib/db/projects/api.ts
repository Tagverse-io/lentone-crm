import { ref, push, set, update, remove, onValue, off } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

// --- Types ---
export type ProjectStatus = 'Kick-off' | 'Planning' | 'Implementation' | 'Review' | 'Closing';
export type TaskStatus = 'To Do' | 'Done';
export type TaskPriority = 'Normal' | 'High' | 'Urgent';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  color: string;
  members: string[]; // Member IDs
  linkedDeal: string | null;
  emoji: string;
  startDate: string;
  endDate: string;
  budget: { est: number; actual: number; };
  progress: number;
}

export interface Member {
  id: string;
  name: string;
  avatar: string; // 2-letter initials
  email?: string;
  role?: string;
  status?: 'Active' | 'Pending' | 'Invited' | 'Inactive' | 'Accepted' | 'Expired';
  projectIds?: string[];
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  owner?: string; // Legacy single Member ID fallback
  assigneeIds?: string[]; // Multiple Member IDs
  owners?: string[];
  status: TaskStatus;
  priority: TaskPriority;
  due: string;
  phase: ProjectStatus;
  description?: string;
}

export type NoteVisibility = 'only-me' | 'everyone' | 'specific';

export interface Note {
  id: string;
  projectId: string;
  title: string;
  description: string;
  visibility: NoteVisibility;
  visibleTo?: string[]; // Member IDs when visibility is 'specific'
  createdBy: string; // User ID
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export type ProjectsData = {
  projects: Project[];
  tasks: Task[];
  members: Member[];
  notes: Note[];
};

// --- Refs ---
const getProjectsRef = (companyId: string) => ref(db, `projects/${companyId}`);
const getProjectItemRef = (companyId: string, projectId: string) => ref(db, `projects/${companyId}/${projectId}`);

const getTasksRef = (companyId: string) => ref(db, `project_tasks/${companyId}`);
const getTaskItemRef = (companyId: string, taskId: string) => ref(db, `project_tasks/${companyId}/${taskId}`);

const getMembersRef = (companyId: string) => ref(db, `project_members/${companyId}`);
const getMemberItemRef = (companyId: string, memberId: string) => ref(db, `project_members/${companyId}/${memberId}`);

const getNotesRef = (companyId: string) => ref(db, `project_notes/${companyId}`);
const getNoteItemRef = (companyId: string, noteId: string) => ref(db, `project_notes/${companyId}/${noteId}`);

// --- Subscriptions ---
export const subscribeToProjectsData = (
  companyId: string, 
  callback: (data: ProjectsData) => void
) => {
  const pRef = getProjectsRef(companyId);
  const tRef = getTasksRef(companyId);
  const mRef = getMembersRef(companyId);

  let currentProjects: Project[] = [];
  let currentTasks: Task[] = [];
  let currentMembers: Member[] = [];
  let currentNotes: Note[] = [];

  const triggerCallback = () => {
    callback({
      projects: currentProjects,
      tasks: currentTasks,
      members: currentMembers,
      notes: currentNotes,
    });
  };

  onValue(pRef, (snap) => {
    const data = snap.val();
    currentProjects = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  onValue(tRef, (snap) => {
    const data = snap.val();
    currentTasks = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  onValue(mRef, (snap) => {
    const data = snap.val();
    currentMembers = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  const nRef = getNotesRef(companyId);
  onValue(nRef, (snap) => {
    const data = snap.val();
    currentNotes = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  return () => {
    off(pRef);
    off(tRef);
    off(mRef);
    off(nRef);
  };
};

// --- Mutations ---
export const createProject = async (companyId: string, project: Omit<Project, 'id'>) => {
  const newRef = push(getProjectsRef(companyId));
  await set(newRef, project);
  return newRef.key;
};

export const updateProject = async (companyId: string, projectId: string, updates: Partial<Project>) => {
  await update(getProjectItemRef(companyId, projectId), updates);
};

export const deleteProject = async (companyId: string, projectId: string) => {
  await remove(getProjectItemRef(companyId, projectId));
};

export const createTask = async (companyId: string, task: Omit<Task, 'id'>) => {
  const newRef = push(getTasksRef(companyId));
  await set(newRef, task);
  return newRef.key;
};

export const updateTask = async (companyId: string, taskId: string, updates: Partial<Task>) => {
  await update(getTaskItemRef(companyId, taskId), updates);
};

export const deleteTask = async (companyId: string, taskId: string) => {
  await remove(getTaskItemRef(companyId, taskId));
};

export const createMember = async (companyId: string, member: Omit<Member, 'id'>) => {
  const newRef = push(getMembersRef(companyId));
  await set(newRef, member);
  return newRef.key;
};

export const updateMember = async (companyId: string, memberId: string, updates: Partial<Member>) => {
  await update(getMemberItemRef(companyId, memberId), updates);
};

export const deleteMember = async (companyId: string, memberId: string) => {
  await remove(getMemberItemRef(companyId, memberId));
};

// Notes
export const createNote = async (companyId: string, note: Omit<Note, 'id'>) => {
  const newRef = push(getNotesRef(companyId));
  await set(newRef, note);
  return newRef.key;
};

export const updateNote = async (companyId: string, noteId: string, updates: Partial<Note>) => {
  await update(getNoteItemRef(companyId, noteId), updates);
};

export const deleteNote = async (companyId: string, noteId: string) => {
  await remove(getNoteItemRef(companyId, noteId));
};
