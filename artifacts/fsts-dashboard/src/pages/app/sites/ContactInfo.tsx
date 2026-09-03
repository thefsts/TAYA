import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Clock3, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

type Hours = { day: string; hours: string };

function asHours(raw: unknown[]): Hours[] {
  return (raw as Hours[]) ?? [];
}

export default function ContactInfo({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.contact.get, { siteId });
  const updateContactInfo = useMutation(api.contact.update);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mapEmbedUrl, setMapEmbedUrl] = useState("");
  const [hours, setHours] = useState<Hours[]>([]);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (data) {
      setEmail(data.email ?? "");
      setPhone(data.phone ?? "");
      setAddress(data.address ?? "");
      setMapEmbedUrl(data.mapEmbedUrl ?? "");
      setHours(asHours((data.hours as unknown[]) ?? []));
    }
  }, [data]);

  async function handleSave() {
    setIsPending(true);
    try {
      await updateContactInfo({
        siteId,
        email,
        phone,
        address,
        mapEmbedUrl: mapEmbedUrl || undefined,
        hours,
      });
      toast({ title: "Contact info updated" });
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

  if (data === undefined) {
    return (
      <AppLayout siteId={params.siteId}>
        <ClientLoadingList rows={3} />
      </AppLayout>
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader
        eyebrow="Website Details"
        title="Contact Information"
        description="Keep the public phone number, email address, location, map link, and business hours accurate across your website."
        actions={
          <Button onClick={handleSave} disabled={isPending} className="shadow-sm">
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-6">
          <ClientSection title="Public Contact Details" description="These details can appear in your footer, contact page, forms, and other enabled website sections.">
            <div className="space-y-5 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" />Email</Label>
                  <Input aria-label="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@yourdomain.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />Phone</Label>
                  <Input aria-label="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-0123" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" />Address</Label>
                <Textarea aria-label="address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Business or public mailing address" />
              </div>

              <div className="space-y-1.5">
                <Label>Map Embed URL</Label>
                <Input aria-label="map embed url" value={mapEmbedUrl} onChange={(e) => setMapEmbedUrl(e.target.value)} placeholder="Paste the approved map embed URL" />
                <p className="text-xs leading-5 text-slate-400">Use the map/embed link supplied by your map provider. Leave blank if the website should not display a map.</p>
              </div>
            </div>
          </ClientSection>

          <ClientSection
            title="Business Hours"
            description="Add the schedule visitors should see on the public website."
            actions={
              <Button type="button" variant="outline" size="sm" onClick={() => setHours([...hours, { day: "", hours: "" }])}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Hours
              </Button>
            }
          >
            {hours.length === 0 ? (
              <ClientEmptyState
                icon={Clock3}
                compact
                title="No business hours configured"
                description="Add your regular hours, appointment availability, or a note such as “By appointment only.”"
                action={
                  <Button type="button" variant="outline" onClick={() => setHours([{ day: "", hours: "" }])}>
                    <Plus className="mr-2 h-4 w-4" />Add First Row
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {hours.map((h, i) => (
                  <div key={i} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-center sm:px-5">
                    <Input
                      aria-label="Day (e.g. Mon–Fri)"
                      placeholder="Day (e.g. Mon–Fri)"
                      value={h.day}
                      onChange={(e) => {
                        const next = [...hours];
                        next[i] = { ...h, day: e.target.value };
                        setHours(next);
                      }}
                    />
                    <Input
                      aria-label="Hours (e.g. 9:00 AM–5:00 PM)"
                      placeholder="Hours (e.g. 9:00 AM–5:00 PM)"
                      value={h.hours}
                      onChange={(e) => {
                        const next = [...hours];
                        next[i] = { ...h, hours: e.target.value };
                        setHours(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-self-start text-slate-400 hover:bg-red-50 hover:text-red-600 sm:h-9 sm:w-9 sm:justify-self-auto sm:p-0"
                      onClick={() => setHours(hours.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="mr-2 h-4 w-4 sm:mr-0" />
                      <span className="sm:hidden">Remove row</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ClientSection>
        </div>

        <aside>
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Building2 className="h-5 w-5 text-emerald-300" />
            </div>
            <h2 className="text-base font-semibold">What this controls</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              These are content settings only. Your website layout and design remain protected by FSTS while your approved contact details stay editable here.
            </p>
            <div className="mt-5 space-y-3 border-t border-slate-800 pt-4 text-xs text-slate-400">
              <div className="flex items-start gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>Email and phone displayed publicly</span></div>
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>Address and optional map destination</span></div>
              <div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>Business hours shown to website visitors</span></div>
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
