"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/use-collection";
import { postsService, socialAccountsService } from "@/lib/services";
import type { Post, PostStatus, SocialPlatform } from "@/lib/types";
import { nowIso, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/card";
import { Badge, stageTone } from "@/components/ui/badge";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "linkedin", "x", "youtube"];
const STATUSES: PostStatus[] = ["draft", "scheduled", "published", "failed"];

export default function SocialPage(): JSX.Element {
  const { orgId } = useAuth();
  const { items, loading, error, reload } = useCollection(postsService, orgId);
  const accounts = useCollection(socialAccountsService, orgId);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<SocialPlatform | "all">("all");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);

  const savePost = async (): Promise<void> => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await postsService.create(orgId, {
        platform, content, scheduledAt: scheduledAt || undefined,
        status: scheduledAt ? "scheduled" : "draft", createdAt: nowIso(),
      });
      setOpen(false); setContent(""); setScheduledAt(""); setPlatform("all");
    } finally {
      setSaving(false);
    }
  };

  const connectAccount = async (): Promise<void> => {
    if (!handle.trim()) return;
    await socialAccountsService.create(orgId, { platform: "facebook", handle, connected: true, createdAt: nowIso() });
    setHandle("");
  };

  if (loading) return <LoadingState label="Loading social…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Social accounts & posts" subtitle="STUB: providers are not live — accounts and scheduled posts are stored locally for the calendar feed." actions={<Button onClick={() => setOpen(true)}>New post</Button>} />
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-5">
          <p className="mb-2 font-semibold">Connected accounts ({accounts.items.length})</p>
          <div className="flex gap-2">
            <Input placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} aria-label="Account handle" />
            <Button variant="outline" onClick={connectAccount}>Connect (stub)</Button>
          </div>
          <ul className="mt-2 text-sm">
            {accounts.items.map((a) => <li key={a.id} className="py-1">{a.platform} · {a.handle} {a.connected ? "(connected)" : ""}</li>)}
          </ul>
        </CardContent></Card>
      </div>
      <Card><CardContent className="p-0">
        {items.length === 0 ? <EmptyState title="No posts yet" hint="Schedule a post to see it on the calendars." /> : (
          <Table>
            <THead><TH>Content</TH><TH>Platform</TH><TH>Scheduled</TH><TH>Status</TH><TH><span className="sr-only">Actions</span></TH></THead>
            <TBody>
              {items.map((p: Post) => (
                <TR key={p.id}>
                  <TD className="max-w-xs truncate">{p.content}</TD>
                  <TD>{p.platform}</TD>
                  <TD>{p.scheduledAt ? formatDateTime(p.scheduledAt) : "—"}</TD>
                  <TD><Badge tone={stageTone(p.status)}>{p.status}</Badge></TD>
                  <TD><div className="flex gap-1">
                    {STATUSES.filter((s) => s !== p.status).slice(0, 2).map((s) => (
                      <Button key={s} size="sm" variant="outline" onClick={() => postsService.update(orgId, p.id, { status: s })}>{s}</Button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => postsService.remove(orgId, p.id)}>Delete</Button>
                  </div></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent></Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New post</DialogTitle>
        <DialogDescription>Scheduled posts appear on the Central Calendar.</DialogDescription>
        <div className="grid gap-3">
          <Field label="Platform">
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform | "all")}>
              <option value="all">All</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Content"><Textarea value={content} onChange={(e) => setContent(e.target.value)} /></Field>
          <Field label="Schedule at"><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></Field>
          <Button onClick={savePost} disabled={saving || !content.trim()}>{saving ? "Saving…" : "Save post"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
