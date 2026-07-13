import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, X, Send, Sparkles, ChevronDown, RotateCcw, Loader2,
  HelpCircle, BookOpen, Image as ImageIcon, Search, Shield, Mail,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

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
  if (siteIdx !== -1 && parts[siteIdx + 2]) {
    return parts[siteIdx + 2];
  }
  return undefined;
}

function formatContent(content: string) {
  const lines = content.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) return <h3 key={i} className="font-bold text-slate-900 mt-2 mb-1">{line.slice(2)}</h3>;
    if (line.startsWith("## ")) return <h4 key={i} className="font-semibold text-slate-800 mt-2 mb-1">{line.slice(3)}</h4>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-slate-800">{line.slice(2, -2)}</p>;
    if (line.startsWith("- ") || line.startsWith("• ")) return <li key={i} className="ml-3 text-slate-700">{line.slice(2)}</li>;
    if (line.startsWith("1. ") || line.match(/^\d+\. /)) return <li key={i} className="ml-3 text-slate-700 list-decimal list-inside">{line.replace(/^\d+\. /, "")}</li>;
    if (line === "") return <div key={i} className="h-2" />;
    // Inline bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-slate-700 leading-relaxed">
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : p
        )}
      </p>
    );
  });
}

type Props = {
  siteId: string;
  pageContext?: string;
};

export function AIAssistant({ siteId, pageContext }: Props) {
  const [location] = useLocation();
  const chatAction = useAction(api.ai.chat);

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sectionKey = sectionFromPath(location);
  const sectionName = sectionKey ? SECTION_NAMES[sectionKey] ?? sectionKey : "Dashboard";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isPending) return;
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
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
      }]);
    } finally {
      setIsPending(false);
    }
  }, [chatAction, isPending, messages, siteId, sectionName, pageContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => setMessages([]);

  const greeting = messages.length === 0;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary text-white rounded-full px-4 py-3 shadow-lg hover:bg-primary/90 transition-all group"
        title="FSTS AI Dashboard Assistant™"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">AI Assistant</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col transition-all duration-200 ${isMinimized ? "h-14" : "h-[600px]"} w-[400px]`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 rounded-t-2xl bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer"
        onClick={() => setIsMinimized((m) => !m)}
      >
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">FSTS AI Assistant™</p>
          <p className="text-xs text-slate-500 truncate">{sectionName}</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && !isMinimized && (
            <button onClick={(e) => { e.stopPropagation(); clearChat(); }} className="p-1 text-slate-400 hover:text-slate-600" title="Clear chat">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized((m) => !m); }} className="p-1 text-slate-400 hover:text-slate-600">
            <ChevronDown className={`h-4 w-4 transition-transform ${isMinimized ? "rotate-180" : ""}`} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {greeting && (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-700">
                    Hi! I'm your FSTS AI Assistant™. I can help you manage your content, improve SEO, optimize images, troubleshoot issues, and more.
                  </p>
                  {sectionKey && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      📍 You're in {sectionName}
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 px-1">Quick questions:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(prompt)}
                      className="flex items-center gap-2 p-2 text-xs text-left rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-slate-700">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm space-y-1 ${msg.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-slate-50 border border-slate-100 text-slate-700 rounded-bl-sm"
                    }`}
                >
                  {msg.role === "user"
                    ? <p>{msg.content}</p>
                    : <div className="space-y-1">{formatContent(msg.content)}</div>
                  }
                </div>
              </div>
            ))}

            {isPending && (
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your site…"
                rows={2}
                className="flex-1 text-sm resize-none min-h-0 border-slate-200 focus-visible:ring-primary/20"
                disabled={isPending}
              />
              <Button
                size="sm"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isPending}
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </>
      )}
    </div>
  );
}
