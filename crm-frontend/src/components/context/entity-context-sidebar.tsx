'use client';

import * as React from 'react';
import { 
  Clock, 
  MessageSquare, 
  FileText, 
  CheckSquare, 
  Mail, 
  Phone,
  ArrowRight,
  DollarSign,
  Calendar,
  Plus,
  Edit,
  Trash2,
  UserMinus,
  Upload,
  Download,
  RotateCcw,
  Archive,
  LogIn,
  FileSignature,
  FolderPlus,
  Megaphone,
  Zap,
  GitMerge,
  CheckCircle,
  MousePointer,
  RefreshCw,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NormalizedActivity, ActivityType } from '@/lib/db/types';
import { getCompanyActivities, getActivityLabel, getActivityIcon } from '@/lib/db/activities/api';
import { useAuth } from '@/lib/firebase/auth-context';

interface EntityContextSidebarProps {
  entityType: 'company' | 'contact' | 'deal' | 'quote' | 'invoice';
  entityId: string;
  companyId?: string;
  className?: string;
}

export function EntityContextSidebar({
  entityType,
  entityId,
  companyId,
  className,
}: EntityContextSidebarProps) {
  const [activities, setActivities] = React.useState<NormalizedActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  React.useEffect(() => {
    if (!workspaceId || !companyId) return;
    
    const loadActivities = async () => {
      setLoading(true);
      try {
        const data = await getCompanyActivities(workspaceId, companyId, 20);
        setActivities(data);
      } catch (error) {
        console.error('Error loading activities:', error);
      }
      setLoading(false);
    };
    
    loadActivities();
  }, [workspaceId, companyId, entityId]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityColor = (type: ActivityType): string => {
    if (type.includes('created')) return 'bg-green-100 text-green-800';
    if (type.includes('updated') || type.includes('changed')) return 'bg-blue-100 text-blue-800';
    if (type.includes('deleted') || type.includes('lost') || type.includes('failed')) return 'bg-red-100 text-red-800';
    if (type.includes('won') || type.includes('paid') || type.includes('accepted')) return 'bg-green-100 text-green-800';
    if (type.includes('sent')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={cn("border-l bg-muted/30", className)}>
      <Tabs defaultValue="timeline" className="h-full">
        <TabsList className="w-full justify-start rounded-none border-b">
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="timeline" className="h-[calc(100%-40px)]">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">
                  Loading activities...
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No activities yet
                </div>
              ) : (
                activities.map((activity) => (
                  <div 
                    key={activity.activity_id}
                    className="flex gap-3 relative"
                  >
                    {/* Timeline line */}
                    <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
                    
                    {/* Activity icon */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      getActivityColor(activity.type || activity.action || 'entity_created')
                    )}>
                      <ActivityIcon type={activity.type || activity.action || 'entity_created'} className="h-4 w-4" />
                    </div>
                    
                    {/* Activity content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <Badge variant="outline" className="text-xs">
                          {(activity.type || activity.action || 'entity_created').split('_').pop()}
                        </Badge>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="communications" className="h-[calc(100%-40px)]">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="text-center text-muted-foreground py-8">
                Communications will appear here
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="notes" className="h-[calc(100%-40px)]">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="text-center text-muted-foreground py-8">
                Notes will appear here
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="tasks" className="h-[calc(100%-40px)]">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="text-center text-muted-foreground py-8">
                Tasks will appear here
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Activity Icon Component
function ActivityIcon({ type, className }: { type: ActivityType; className?: string }) {
  const iconMap: Record<ActivityType, React.ReactNode> = {
    lead_created: <ArrowRight className={className} />,
    lead_qualified: <ArrowRight className={className} />,
    lead_converted_contact: <ArrowRight className={className} />,
    lead_converted_deal: <ArrowRight className={className} />,
    contact_created: <ArrowRight className={className} />,
    contact_updated: <ArrowRight className={className} />,
    deal_created: <DollarSign className={className} />,
    deal_stage_changed: <ArrowRight className={className} />,
    deal_won: <DollarSign className={className} />,
    deal_lost: <DollarSign className={className} />,
    quote_created: <FileText className={className} />,
    quote_sent: <Mail className={className} />,
    quote_viewed: <Mail className={className} />,
    quote_accepted: <FileText className={className} />,
    quote_rejected: <FileText className={className} />,
    quote_expired: <Clock className={className} />,
    invoice_created: <FileText className={className} />,
    invoice_sent: <Mail className={className} />,
    invoice_viewed: <Mail className={className} />,
    invoice_paid: <DollarSign className={className} />,
    invoice_overdue: <Clock className={className} />,
    payment_received: <DollarSign className={className} />,
    payment_failed: <DollarSign className={className} />,
    meeting_scheduled: <Calendar className={className} />,
    meeting_completed: <Calendar className={className} />,
    meeting_cancelled: <Calendar className={className} />,
    email_sent: <Mail className={className} />,
    email_received: <Mail className={className} />,
    email_opened: <Eye className={className} />,
    email_clicked: <MousePointer className={className} />,
    note_added: <FileText className={className} />,
    task_created: <CheckSquare className={className} />,
    task_completed: <CheckSquare className={className} />,
    call_logged: <Phone className={className} />,
    whatsapp_sent: <MessageSquare className={className} />,
    whatsapp_received: <MessageSquare className={className} />,
    document_uploaded: <FileText className={className} />,
    document_downloaded: <FileText className={className} />,
    status_changed: <ArrowRight className={className} />,
    stage_changed: <ArrowRight className={className} />,
    comment_added: <MessageSquare className={className} />,
    mention_added: <MessageSquare className={className} />,
    entity_created: <Plus className={className} />,
    entity_updated: <Edit className={className} />,
    entity_deleted: <Trash2 className={className} />,
    assigned: <ArrowRight className={className} />,
    unassigned: <ArrowRight className={className} />,
    file_uploaded: <Upload className={className} />,
    file_downloaded: <Download className={className} />,
    approval_requested: <Clock className={className} />,
    approval_approved: <CheckCircle className={className} />,
    approval_rejected: <Trash2 className={className} />,
    lead_converted: <ArrowRight className={className} />,
    project_created: <FolderPlus className={className} />,
    project_updated: <Edit className={className} />,
    campaign_created: <Megaphone className={className} />,
    automation_executed: <Zap className={className} />,
    webhook_triggered: <Zap className={className} />,
    import_completed: <Upload className={className} />,
    export_completed: <Download className={className} />,
    merged: <GitMerge className={className} />,
    restored: <RotateCcw className={className} />,
    archived: <Archive className={className} />,
    user_login: <LogIn className={className} />,
    user_created: <ArrowRight className={className} />,
    contract_signed: <FileSignature className={className} />,
  };
  
  return <>{iconMap[type] || <Clock className={className} />}</>;
}
