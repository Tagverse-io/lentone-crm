import {
  ref,
  get,
  set,
  onValue,
  off
} from 'firebase/database';
import { database as db } from '@/lib/firebase/config';

export interface WidgetConfig {
  metricId: string;
  colorTheme: string;
}

export interface WidgetLayout {
  id: string;
  type: 'kpi' | 'bar' | 'donut' | 'line' | 'funnel' | 'area';
  title: string;
  config: WidgetConfig;
}

export interface GlobalFilters {
  dateRange: string;
  pipeline: string;
  owner: string;
  tag: string;
}

export interface DashboardSettings {
  widgets: WidgetLayout[];
  globalFilters: GlobalFilters;
  updatedAt: string;
}

function settingsRef(workspaceId: string) {
  return ref(db, `orgs/${workspaceId}/dashboard_settings`);
}

export async function getDashboardSettings(workspaceId: string): Promise<DashboardSettings | null> {
  const snapshot = await get(settingsRef(workspaceId));
  if (snapshot.exists()) {
    return snapshot.val() as DashboardSettings;
  }
  return null;
}

export async function saveDashboardSettings(workspaceId: string, settings: Omit<DashboardSettings, 'updatedAt'>): Promise<void> {
  await set(settingsRef(workspaceId), {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}

export function subscribeToDashboardSettings(
  workspaceId: string,
  callback: (settings: DashboardSettings | null) => void
): () => void {
  const settingsReference = settingsRef(workspaceId);

  const unsubscribe = onValue(settingsReference, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as DashboardSettings);
    } else {
      callback(null);
    }
  });

  return () => off(settingsReference, 'value', unsubscribe);
}
