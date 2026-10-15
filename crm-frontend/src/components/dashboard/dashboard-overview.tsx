'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/dashboard/kpi-card';
import {
  DollarSign,
  Briefcase,
  CheckSquare,
  Target,
  TrendingUp,
  Loader2,
  FileText,
  Activity,
  AlertTriangle,
  Clock,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/use-dashboard-metrics';
import { useSmartNotifications } from '@/hooks/use-smart-notifications';
import { useWorkspaceData } from '@/hooks/use-workspace-data';
import { formatCurrency } from '@/lib/utils';

export function DashboardOverview() {
  const { metrics, loading: metricsLoading, error: metricsError } = useDashboardMetrics();
  const { notifications, unreadCount, loading: notifsLoading } = useSmartNotifications();
  const { currency, companyName } = useWorkspaceData();

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Error loading dashboard: {metricsError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {companyName ? `${companyName} Dashboard` : 'Dashboard'}
        </h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s what&apos;s happening.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leads"
          value={metrics.totalLeads.toString()}
          change={`${metrics.newLeadsThisWeek} new this week`}
          trend={metrics.newLeadsThisWeek > 0 ? 'up' : 'neutral'}
          icon={Users}
          description="All-time leads"
        />
        <KpiCard
          title="Open Deals"
          value={metrics.openDeals.toString()}
          change={formatCurrency(metrics.totalDealValue, currency)}
          trend="neutral"
          icon={Briefcase}
          description={`${metrics.wonDeals} won`}
        />
        <KpiCard
          title="Pending Invoices"
          value={metrics.pendingInvoices.toString()}
          change={formatCurrency(metrics.totalOutstanding, currency)}
          trend={metrics.overdueInvoices > 0 ? 'down' : 'neutral'}
          icon={FileText}
          description={`${metrics.overdueInvoices} overdue`}
        />
        <KpiCard
          title="Revenue"
          value={formatCurrency(metrics.wonDealValue, currency)}
          change={`${metrics.paidInvoices} invoices paid`}
          trend="up"
          icon={DollarSign}
          description="Total won deals"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentActivities.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {metrics.recentActivities.slice(0, 5).map((activity) => (
                  <div key={activity.activity_id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Notifications
              </span>
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifsLoading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No notifications</p>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`p-3 rounded-lg border ${
                      notif.severity === 'critical' ? 'border-red-200 bg-red-50' :
                      notif.severity === 'high' ? 'border-orange-200 bg-orange-50' :
                      'border-border'
                    }`}
                  >
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Deals Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Open Deals</span>
                <span className="font-medium">{metrics.openDeals}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Won Deals</span>
                <span className="font-medium text-green-600">{metrics.wonDeals}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lost Deals</span>
                <span className="font-medium text-red-600">{metrics.lostDeals}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Value</span>
                  <span className="font-bold">{formatCurrency(metrics.totalDealValue, currency)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">Won Value</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(metrics.wonDealValue, currency)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="font-medium">{metrics.pendingInvoices}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Overdue</span>
                <span className="font-medium text-red-600">{metrics.overdueInvoices}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Paid</span>
                <span className="font-medium text-green-600">{metrics.paidInvoices}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Outstanding</span>
                  <span className="font-bold text-orange-600">
                    {formatCurrency(metrics.totalOutstanding, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">Total Paid</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(metrics.totalPaidValue, currency)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
