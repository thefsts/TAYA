import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useGetContactInfo, useUpdateContactInfo } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Hours = { day: string; hours: string };

function asHours(raw: unknown[]): Hours[] {
  return (raw as Hours[]) ?? [];
}

export default function ContactInfo({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useGetContactInfo(siteId);
  const updateMutation = useUpdateContactInfo();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mapEmbedUrl, setMapEmbedUrl] = useState("");
  const [hours, setHours] = useState<Hours[]>([]);

  useEffect(() => {
    if (data) {
      setEmail(data.email);
      setPhone(data.phone);
      setAddress(data.address);
      setMapEmbedUrl(data.mapEmbedUrl ?? "");
      setHours(asHours(data.hours ?? []));
    }
  }, [data]);

  function handleSave() {
    updateMutation.mutate(
      { siteId, data: { email, phone, address, mapEmbedUrl: mapEmbedUrl || undefined, hours } },
      {
        onSuccess: () => toast({ title: "Contact info updated" }),
        onError: (err) =>
          toast({
            title: "Something went wrong",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
  }

  if (isLoading) {
    return (
      <AppLayout siteId={params.siteId}>
        <Skeleton className="h-64" />
      </AppLayout>
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contact Info</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contact details shown across the public site.</p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Map Embed URL</Label>
            <Input value={mapEmbedUrl} onChange={(e) => setMapEmbedUrl(e.target.value)} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-900">Business Hours</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setHours([...hours, { day: "", hours: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add Row
            </Button>
          </div>
          <div className="space-y-2">
            {hours.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Day (e.g. Mon-Fri)"
                  value={h.day}
                  onChange={(e) => {
                    const next = [...hours];
                    next[i] = { ...h, day: e.target.value };
                    setHours(next);
                  }}
                />
                <Input
                  placeholder="Hours (e.g. 9am-5pm)"
                  value={h.hours}
                  onChange={(e) => {
                    const next = [...hours];
                    next[i] = { ...h, hours: e.target.value };
                    setHours(next);
                  }}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setHours(hours.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            {hours.length === 0 && <p className="text-sm text-slate-500">No hours configured.</p>}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
