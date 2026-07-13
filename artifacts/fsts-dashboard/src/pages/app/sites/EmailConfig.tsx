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
  const [notifyOnNewLead, setNotifyOnNewLead] = useState(false);
  const [notifyOnBooking, setNotifyOnBooking] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (data) {
      setFromName(data.fromName ?? "");
      setFromEmail(data.fromEmail ?? "");
      setReplyToEmail(data.replyToEmail ?? "");
      setNotifyOnNewLead(data.notifyOnNewLead ?? false);
      setNotifyOnBooking(data.notifyOnBooking ?? false);
    }
  }, [data]);

  async function handleSave() {
    setIsPending(true);
    try {
      await updateEmailSettings({ siteId, fromName, fromEmail, replyToEmail, notifyOnNewLead, notifyOnBooking });
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
      ) : (
        <LockedField capabilityLabel="Email Provider Settings">
          <div className="bg-white p-6 border border-slate-200 rounded-md shadow-sm max-w-xl space-y-4">
            <div className="space-y-1.5">
              <Label>From Name</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>From Email</Label>
              <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reply To</Label>
              <Input type="email" value={replyToEmail} onChange={(e) => setReplyToEmail(e.target.value)} />
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
