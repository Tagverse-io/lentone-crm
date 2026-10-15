import { ref, push, set, update, remove, onValue, off } from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

// --- Types ---
export interface Assignee { id: string; name: string; avatar: string; email: string; }
export interface SubTask { id: string; title: string; completed: boolean; dueDate?: string; description?: string; assignees?: Assignee[]; }
export interface Comment { id: string; author: string; avatar: string; text: string; timestamp: string; }
export interface DealReference { name: string; value: string; stage: string; }
export interface Attachment { id: string; name: string; size: string; type: string; }

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type ViewType = 'Kanban' | 'Dashboard' | 'List' | 'Table' | 'Calendar';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string; 
  assignees?: Assignee[];
  assignee?: Assignee; // Legacy fallback
  priority: TaskPriority;
  dueDate: string; 
  subtasks: SubTask[];
  comments: Comment[];
  labels: string[];
  dealReference: DealReference | null;
  attachments: Attachment[];
}

export type TasksData = {
  tasks: Task[];
  columns: string[];
};

// --- Refs ---
const getTasksRef = (companyId: string) => ref(db, `company_tasks/${companyId}`);
const getTaskItemRef = (companyId: string, taskId: string) => ref(db, `company_tasks/${companyId}/${taskId}`);
const getTaskColumnsRef = (companyId: string) => ref(db, `company_task_columns/${companyId}`);

// --- Subscriptions ---
export const subscribeToTasksData = (
  companyId: string, 
  callback: (data: TasksData) => void
) => {
  const tRef = getTasksRef(companyId);
  const cRef = getTaskColumnsRef(companyId);

  let currentTasks: Task[] = [];
  let currentColumns: string[] = ['To Do', 'In Progress', 'Review', 'Done'];

  const triggerCallback = () => {
    callback({
      tasks: currentTasks,
      columns: currentColumns
    });
  };

  onValue(tRef, (snap) => {
    const data = snap.val();
    currentTasks = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    triggerCallback();
  });

  onValue(cRef, (snap) => {
    const data = snap.val();
    if (data && Array.isArray(data)) {
      currentColumns = data;
    } else {
      currentColumns = ['To Do', 'In Progress', 'Review', 'Done']; // Fallback
    }
    triggerCallback();
  });

  return () => {
    off(tRef);
    off(cRef);
  };
};

// --- Mutations ---
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

export const saveTaskColumns = async (companyId: string, columns: string[]) => {
  await set(getTaskColumnsRef(companyId), columns);
  return true;
};
