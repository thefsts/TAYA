import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useGetEmailSettings, useUpdateEmailSettings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function EmailConfig({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useGetEmailSettings(siteId);
  const updateMutation = useUpdateEmailSettings();

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [notifyOnNewLead, setNotifyOnNewLead] = useState(false);
  const [notifyOnBooking, setNotifyOnBooking] = useState(false);

  useEffect(() => {
    if (data) {
      setFromName(data.fromName);
      setFromEmail(data.fromEmail);
      setReplyToEmail(data.replyToEmail);
      setNotifyOnNewLead(data.notifyOnNewLead ?? false);
      setNotifyOnBooking(data.notifyOnBooking ?? false);
    }
  }, [data]);

  function handleSave() {
    updateMutation.mutate(
      { siteId, data: { fromName, fromEmail, replyToEmail, notifyOnNewLead, notifyOnBooking } },
      {
        onSuccess: () => toast({ title: "Email settings updated" }),
        onError: (err) =>
          toast({
            title: "Something went wrong",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Email Settings</h1>
      <p className="text-sm text-slate-500 mb-6">Outbound email identity and notification preferences.</p>
      {isLoading ? (
        <Skeleton className="h-64 max-w-xl" />
      ) : (
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
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
