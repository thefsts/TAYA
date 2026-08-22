import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  X, Send, Sparkles, ChevronDown, RotateCcw, Loader2,
  HelpCircle, BookOpen, Image as ImageIcon, Search, Shield, Mail,
  AlertCircle, CheckCircle2, Settings2,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AIStatus = "idle" | "checking" | "ready" | "not-configured" | "error";

const SECTION_NAMES: Record<string, string> = {
  homepage: "Homepage Editor",
  courses: "Courses Manager",
  events: "Events Manager",
  articles: "Articles Manager",
  media: "Media Library",
  seo: "SEO Settings",
  footer: "Footer Editor",
  contact: "Contact Info",
  payments: "Square Payments",
  email: "Email Config",
  crm: "Marketing & CRM",
  faq: "FAQ Manager",
  testimonials: "Testimonials",
  forms: "Form Builder",
  inbox: "Contact Inbox",
  health: "Website Health",
  team: "Team Manager",
  careers: "Careers Manager",
  backups: "Backups",
  history: "Version History",
  activity: "Activity Log",
  help: "Help Center",
  navigation: "Navigation Manager",
  announcement: "Announcement Banner",
  cta: "CTA Buttons",
  downloads: "Downloads Manager",
  popup: "Popup Manager",
};

const QUICK_PROMPTS = [
  { icon: Search, label: "SEO tips for my site", prompt: "What are the most important SEO improvements I should make for my website right now?" },
  { icon: ImageIcon, label: "Optimize my images", prompt: "How should I optimize images for better page speed and SEO?" },
  { icon: BookOpen, label: "Write better content", prompt: "Give me tips on writing engaging content that converts visitors into customers." },
  { icon: Mail, label: "Email setup help", prompt: "Help me set up email notifications for my contact forms." },
  { icon: Shield, label: "Improve security", prompt: "What security steps should I take to protect my website?" },
  { icon: HelpCircle, label: "Accessibility help", prompt: "How can I make my website more accessible to all users?" },
];

function sectionFromPath(path: string): string | undefined {
  const parts = path.split("/").filter(Boolean);
  const siteIdx = parts.indexOf("sites");
  if (siteIdx !== -1 && parts[siteIdx + 2]) return parts[siteIdx + 2];
  return undefined;
}

function formatContent(content: string) {
  const lines = content.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) return <h3 key={i} className="mb-1 mt-2 font-bold text-slate-900">{line.slice(2)}</h3>;
    if (line.startsWith("## ")) return <h4 key={i} className="mb-1 mt-2 font-semibold text-slate-800">{line.slice(3)}</h4>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-slate-800">{line.slice(2, -2)}</p>;
    if (line.startsWith("- ") || line.startsWith("• ")) return <li key={i} className="ml-3 text-slate-700">{line.slice(2)}</li>;
    if (line.match(/^\d+\. /)) return <li key={i} className="ml-3 list-inside list-decimal text-slate-700">{line.replace(/^\d+\. /, "")}</li>;
    if (line === "") return <div key={i} className="h-2" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="leading-relaxed text-slate-700">
        {parts.map((part, j) => part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part)}
      </p>
    );
  });
}

function friendlyAIError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("AI_NOT_CONFIGURED")) return "The AI Assistant is not connected yet. FSTS is finishing the AI service setup for this dashboard.";
  if (message.includes("AI_PROVIDER_ERROR_401") || message.includes("AI_PROVIDER_ERROR_403")) return "The AI connection needs attention from FSTS. Your website content is unaffected.";
  if (message.includes("AI_PROVIDER_ERROR_429")) return "The AI service is temporarily busy. Please try again shortly.";
  if (message.includes("AI_PROVIDER_ERROR")) return "The AI service is temporarily unavailable. Please try again shortly.";
  if (message.includes("Unauthenticated") || message.includes("Forbidden")) return "Your AI session could not be verified. Refresh the dashboard and try again.";
  return "The AI Assistant could not respond right now. Please try again in a moment.";
}

type Props = {
  siteId: string;
  pageContext?: string;
};

export function AIAssistant({ siteId, pageContext }: Props) {
  const [location] = useLocation();
  const chatAction = useAction(api.ai.chat);
  const statusAction = useAction(api.ai.status);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [aiStatus, setAIStatus] = useState<AIStatus>("idle");
  const [modelName, setModelName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sectionKey = sectionFromPath(location);
  const sectionName = sectionKey ? SECTION_NAMES[sectionKey] ?? sectionKey : "Dashboard";

  const checkStatus = useCallback(async () => {
    setAIStatus("checking");
    try {
      const result = await statusAction({ siteId: siteId as Id<"sites"> });
      setModelName(result.model ?? null);
      setAIStatus(result.configured ? "ready" : "not-configured");
    } catch {
      setAIStatus("error");
    }
  }, [siteId, statusAction]);

  useEffect(() => {
    if (isOpen && aiStatus === "idle") void checkStatus();
  }, [isOpen, aiStatus, checkStatus]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isPending]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isPending || aiStatus !== "ready") return;
    const userMessage: Message = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsPending(true);
    try {
      const { content: reply } = await chatAction({
        siteId: siteId as Id<"sites">,
        messages: newMessages,
        section: sectionName,
        pageContext: pageContext || undefined,
      });
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (err) {
      const friendly = friendlyAIError(err);
      if ((err instanceof Error ? err.message : String(err)).includes("AI_NOT_CONFIGURED")) setAIStatus("not-configured");
      setMessages((current) => [...current, { role: "assistant", content: friendly }]);
    } finally {
      setIsPending(false);
    }
  }, [aiStatus, chatAction, isPending, messages, pageContext, sectionName, siteId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const clearChat = () => setMessages([]);
  const greeting = messages.length === 0;
  const inputDisabled = isPending || aiStatus !== "ready";

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-white shadow-lg transition-all hover:bg-primary/90 sm:bottom-6 sm:right-6"
        title="FSTS AI Dashboard Assistant™"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">AI Assistant</span>
      </button>
    );
  }

  return (
    <div className={`fixed inset-x-3 bottom-3 z-40 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px] ${isMinimized ? "h-14" : "h-[min(600px,calc(100dvh-1.5rem))]"}`}>
      <div className="flex cursor-pointer items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3" onClick={() => setIsMinimized((value) => !value)}>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary"><Sparkles className="h-4 w-4 text-white" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">FSTS AI Assistant™</p>
            {aiStatus === "ready" && <span className="h-2 w-2 rounded-full bg-emerald-500" title="AI ready" />}
            {aiStatus === "not-configured" && <span className="h-2 w-2 rounded-full bg-amber-500" title="AI setup pending" />}
            {aiStatus === "error" && <span className="h-2 w-2 rounded-full bg-red-500" title="AI status unavailable" />}
          </div>
          <p className="truncate text-xs text-slate-500">{sectionName}</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && !isMinimized && <button onClick={(e) => { e.stopPropagation(); clearChat(); }} className="p-1 text-slate-400 hover:text-slate-600" title="Clear chat"><RotateCcw className="h-3.5 w-3.5" /></button>}
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized((value) => !value); }} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Minimize AI assistant"><ChevronDown className={`h-4 w-4 transition-transform ${isMinimized ? "rotate-180" : ""}`} /></button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close AI assistant"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {aiStatus === "checking" && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin text-primary" />Checking AI Assistant availability…</div>
            )}

            {aiStatus === "not-configured" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3"><Settings2 className="mt-0.5 h-5 w-5 text-amber-600" /><div><p className="text-sm font-semibold text-amber-900">AI setup is being completed</p><p className="mt-1 text-sm leading-5 text-amber-800">The dashboard is working normally. FSTS still needs to connect the AI service before this assistant can answer questions.</p></div></div>
                <Button variant="outline" size="sm" className="mt-3 border-amber-300 bg-white" onClick={() => void checkStatus()}>Check again</Button>
              </div>
            )}

            {aiStatus === "error" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 text-red-600" /><div><p className="text-sm font-semibold text-red-900">AI status could not be verified</p><p className="mt-1 text-sm leading-5 text-red-700">Your website tools are still available. Try the AI check again in a moment.</p></div></div>
                <Button variant="outline" size="sm" className="mt-3 bg-white" onClick={() => void checkStatus()}>Retry status check</Button>
              </div>
            )}

            {aiStatus === "ready" && greeting && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-sm text-slate-700">Hi! I’m your FSTS AI Assistant™. I can help with content, SEO, images, forms, accessibility, and common website-management questions.</p>{sectionKey && <Badge variant="secondary" className="mt-2 text-xs">You’re in {sectionName}</Badge>}</div></div>
                </div>
                <p className="px-1 text-xs font-medium text-slate-500">Quick questions:</p>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                    <button key={label} onClick={() => void sendMessage(prompt)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs transition-colors hover:border-slate-300 hover:bg-slate-50"><Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" /><span className="text-slate-700">{label}</span></button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && <div className="mr-2 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary"><Sparkles className="h-3.5 w-3.5 text-white" /></div>}
                <div className={`max-w-[82%] space-y-1 rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm border border-slate-100 bg-slate-50 text-slate-700"}`}>
                  {msg.role === "user" ? <p>{msg.content}</p> : <div className="space-y-1">{formatContent(msg.content)}</div>}
                </div>
              </div>
            ))}

            {isPending && (
              <div className="flex items-start gap-2"><div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary"><Sparkles className="h-3.5 w-3.5 text-white" /></div><div className="rounded-2xl rounded-bl-sm border border-slate-100 bg-slate-50 px-4 py-3"><div className="flex items-center gap-1"><div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" /><div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} /><div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} /></div></div></div>
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex items-end gap-2">
              <Textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={aiStatus === "ready" ? "Ask me anything about your site…" : "AI Assistant is not available yet"} rows={2} className="min-h-0 flex-1 resize-none border-slate-200 text-sm focus-visible:ring-primary/20" disabled={inputDisabled} />
              <Button size="sm" onClick={() => void sendMessage(input)} disabled={!input.trim() || inputDisabled} className="h-9 w-9 flex-shrink-0 p-0">{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px] text-slate-400"><span>{aiStatus === "ready" ? "Enter to send · Shift+Enter for new line" : "Website tools remain available while AI setup is pending"}</span>{modelName && aiStatus === "ready" && <span className="hidden truncate sm:inline" title={modelName}>AI ready</span>}</div>
          </div>
        </>
      )}
    </div>
  );
}
