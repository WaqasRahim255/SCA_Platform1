import { useAuth } from "@clerk/clerk-react";
import { ImagePlus, Loader2, MessagesSquare, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getChatMessages, sendChatMessage } from "@/services/api";
import type { ChatMessageResponse, ChatMode } from "@/types/api";
import { cn } from "@/utils/cn";

const PROJECT_ID = "default-project";
const modes: Array<{ id: ChatMode; label: string }> = [
  { id: "planning", label: "Planning" },
  { id: "editing", label: "Editing" },
  { id: "answering", label: "Answering" },
];

export function SessionsPage() {
  const { getToken, isSignedIn } = useAuth();
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("planning");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!isSignedIn) {
        setIsLoadingMessages(false);
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No Clerk token available.");
        }

        const response = await getChatMessages(PROJECT_ID, token);
        if (isMounted) {
          setMessages(response.messages);
          setError(null);
        }
      } catch (caught) {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Could not load chat messages.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
    }

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No Clerk token available.");
      }

      const savedMessage = await sendChatMessage(token, {
        project_id: PROJECT_ID,
        content,
        role: "user",
        mode,
        attachment_name: attachmentName,
      });

      setMessages((currentMessages) => [...currentMessages, savedMessage]);
      setInput("");
      setAttachmentName(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-accent">Plan 1 workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">Analysis Chat</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Messages are saved to the project chat history. AI responses will connect here later.
          </p>
        </div>
        <div className="flex rounded-md border border-border bg-card p-1">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "h-9 rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                mode === item.id && "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <MessagesSquare className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Project conversation</h2>
              <p className="text-xs text-muted-foreground">Project ID: {PROJECT_ID}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground sm:flex">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
            AI integration pending
          </div>
        </div>

        <div className="min-h-[22rem] flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Loading chat history
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
              <MessagesSquare className="h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold">No messages yet</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with a planning note, a data question, or the analysis task you want to run.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[min(42rem,85%)] rounded-lg px-4 py-3 text-sm leading-6",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-muted text-foreground",
                  )}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                    <span className="capitalize">{message.mode}</span>
                    <span aria-hidden="true">/</span>
                    <span>{new Date(message.created_at).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.attachment_name ? (
                    <p className="mt-2 text-xs opacity-80">Attachment: {message.attachment_name}</p>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {isSending ? (
            <div className="flex justify-end">
              <div className="flex items-center rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Sending
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="border-t border-border px-4 py-2 text-sm text-destructive">{error}</div>
        ) : null}

        {attachmentName ? (
          <div className="border-t border-border px-4 py-2 text-sm text-muted-foreground">
            Image placeholder attached: {attachmentName}
          </div>
        ) : null}

        <form className="border-t border-border p-4" onSubmit={handleSend}>
          <div className="flex items-end gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Add image placeholder"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <textarea
              className="min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none transition focus:ring-2 focus:ring-ring"
              rows={1}
              placeholder={`Message in ${mode} mode`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
