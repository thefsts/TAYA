import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { LockedField, DesignLockBanner } from "@/components/LockedField";

export default function EmailConfig({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.email.get, { siteId });
  const updateEmailSettings = useMutation(api.email.update);

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notifyOnNewLead, setNotifyOnNewLead] = useState(false);
  const [notifyOnBooking, setNotifyOnBooking] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (data) {
      setFromName(data.fromName ?? "");
      setFromEmail(data.fromEmail ?? "");
      setReplyToEmail(data.replyToEmail ?? "");
      setNotificationEmail((data as { notificationEmail?: string }).notificationEmail ?? "");
      setNotifyOnNewLead(data.notifyOnNewLead ?? false);
      setNotifyOnBooking(data.notifyOnBooking ?? false);
    }
  }, [data]);

  async function handleSave() {
    setIsPending(true);
    try {
      await updateEmailSettings({ siteId, fromName, fromEmail, replyToEmail, notificationEmail: notificationEmail || undefined, notifyOnNewLead, notifyOnBooking });
      toast({ title: "Email settings updated" });
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Email Settings</h1>
      <p className="text-sm text-slate-500 mb-6">Outbound email identity and notification preferences.</p>
      <DesignLockBanner label="Email Provider Settings" />
      {data === undefined ? (
        <Skeleton className="h-64 max-w-xl" />
      ) : data === null ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700 max-w-xl">
          Unable to load Email Settings — you may not have access to this site or the email module is disabled.
        </div>
      ) : (
        <LockedField capabilityLabel="Email Provider Settings">
          <div className="bg-white p-6 border border-slate-200 rounded-md shadow-sm max-w-xl space-y-4">
            <div className="space-y-1.5">
              <Label>From Name</Label>
              <Input aria-label="from name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>From Email</Label>
              <Input aria-label="from email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reply To</Label>
              <Input aria-label="reply to email" type="email" value={replyToEmail} onChange={(e) => setReplyToEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Lead Alert Recipient</Label>
              <Input
                aria-label="Lead Alert Recipient"
                type="email"
                placeholder={fromEmail || "Where should lead alerts be sent?"}
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Where should lead alert emails be delivered? Leave blank to use the From Email above.
              </p>
            </div>
            <div className="flex items-center justify-between py-1">
              <Label>Notify on new lead</Label>
              <Switch checked={notifyOnNewLead} onCheckedChange={setNotifyOnNewLead} />
            </div>
            <div className="flex items-center justify-between py-1">
              <Label>Notify on booking</Label>
              <Switch checked={notifyOnBooking} onCheckedChange={setNotifyOnBooking} />
            </div>
            <div className="pt-2">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </div>
        </LockedField>
      )}
    </AppLayout>
  );
}
