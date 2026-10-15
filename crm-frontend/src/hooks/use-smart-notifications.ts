'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import { NormalizedActivity, ActivityType } from '@/lib/db/types';
import { getActivities } from '@/lib/db/activities/api';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  FileText, 
  DollarSign,
  Users,
  Calendar
} from 'lucide-react';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  icon?: string;
}

export interface SmartNotification {
  id: string;
  type: 'overdue_invoice' | 'upcoming_followup' | 'deal_stale' | 'quote_expiring' | 'new_lead' | 'payment_received';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  entityId: string;
  entityType: 'lead' | 'deal' | 'quote' | 'invoice' | 'payment';
  actionUrl: string;
  read?: boolean;
}

/**
 * Hook to fetch smart notifications based on data state
 */
export function useSmartNotifications() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id || '';
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const smartNotifications: SmartNotification[] = [];

      // Fetch data for notifications
      const activities = await getActivities(workspaceId, 50);

      // Check for overdue invoices
      // This would normally query Firebase, but we'll use a simplified approach
      // In production, you'd fetch invoices and check due dates

      // Check for upcoming follow-ups from activities
      const followUpActivities = activities.filter(a => 
        a.type.includes('follow_up') || a.type.includes('scheduled')
      );

      followUpActivities.forEach(activity => {
        smartNotifications.push({
          id: `followup-${activity.activity_id}`,
          type: 'upcoming_followup',
          title: 'Upcoming Follow-up',
          message: activity.title,
          severity: 'medium',
          timestamp: activity.created_at,
          entityId: activity.deal_id || activity.quote_id || activity.invoice_id || '',
          entityType: 'deal',
          actionUrl: `/deals`,
        });
      });

      // Sort by severity and timestamp
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      smartNotifications.sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setNotifications(smartNotifications);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchNotifications();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
