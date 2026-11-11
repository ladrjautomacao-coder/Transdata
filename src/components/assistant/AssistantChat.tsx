import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, RotateCcw, Loader2, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-assistant`;

const SUGGESTIONS = [
  "Listar a última atualização do projeto",
];

export function AssistantChat({ onClose }: { onClose?: () => void }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando sessão…
      </div>
    );
  }

  return <AssistantChatInner token={token} onClose={onClose} />;
}

function AssistantChatInner({ token, onClose }: { token: string; onClose?: () => void }) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useRef<DefaultChatTransport<UIMessage>>(
    new DefaultChatTransport({
      api: ENDPOINT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    })
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    transport: transport.current,
    onError: (err) => toast({ title: "Erro no assistente", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => { inputRef.current?.focus(); }, [chatId, status]);

  const isBusy = status === "submitted" || status === "streaming";

  // Mapeia o texto enviado ao modelo -> rótulo amigável exibido na bolha do usuário
  const displayMap = useRef<Map<string, string>>(new Map());

  const handleSend = async (text?: string, displayLabel?: string) => {
    const value = (text ?? input).trim();
    if (!value || isBusy) return;
    if (displayLabel) displayMap.current.set(value, displayLabel);
    setInput("");
    await sendMessage({ text: value });
  };


  const handleReset = () => {
    setMessages([]);
    setChatId(crypto.randomUUID());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-4 py-3 bg-card/60 backdrop-blur">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Assistente Transdata</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">IA · somente leitura</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleReset} title="Nova conversa">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Olá! Posso informar a <strong>última atualização</strong> de um projeto. Clique na opção abaixo para começar.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground px-3 py-1.5 transition-colors"
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            displayMap={displayMap.current}
            onAsk={(q, label) => { void handleSend(q, label); }}
          />
        ))}



        {status === "submitted" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Consultando…
          </div>
        )}
      </div>

      <div className="border-t p-3 space-y-2">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder="Pergunte algo… (Enter envia, Shift+Enter quebra linha)"
          rows={2}
          disabled={isBusy}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => handleSend()} disabled={!input.trim() || isBusy}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onAsk, displayMap }: { message: UIMessage; onAsk?: (q: string, label?: string) => void; displayMap?: Map<string, string> }) {
  const isUser = message.role === "user";
  const textParts = message.parts.filter(p => p.type === "text") as Array<{ type: "text"; text: string }>;
  const toolParts = message.parts.filter(p => p.type.startsWith("tool-"));
  const rawText = textParts.map(p => p.text).join("");
  // Para mensagens do usuário, troca a query crua (com UUID) por rótulo amigável quando disponível
  const text = isUser && displayMap?.get(rawText) ? displayMap.get(rawText)! : rawText;


  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${isUser ? "max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3.5 py-2.5" : "w-full bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3"} text-sm shadow-sm`}>
        {!isUser && toolParts.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
            <Wrench className="h-3 w-3" /> consultando dados…
          </div>
        )}
        {text && (
          <div className={`prose prose-sm max-w-none break-words
            prose-p:my-2 prose-p:leading-relaxed
            prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold prose-headings:text-foreground
            prose-h1:text-base prose-h2:text-[15px] prose-h3:text-[13px] prose-h3:uppercase prose-h3:tracking-wider prose-h3:text-primary
            prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:marker:text-primary
            prose-strong:font-semibold prose-strong:text-foreground
            prose-hr:my-4 prose-hr:border-border/60
            prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
            ${isUser ? "prose-invert prose-headings:text-primary-foreground prose-strong:text-primary-foreground" : "dark:prose-invert"}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  if (href?.startsWith("#pick:") || href?.startsWith("#ask:")) {
                    const isPick = href.startsWith("#pick:");
                    const raw = decodeURIComponent(href.slice(isPick ? 6 : 5));
                    const q = isPick ? `Última atualização do projeto ${raw}` : raw;
                    const label = typeof children === "string"
                      ? children
                      : Array.isArray(children)
                        ? children.map(c => (typeof c === "string" ? c : "")).join("")
                        : undefined;
                    return (
                      <button
                        type="button"
                        onClick={() => onAsk?.(q, label ? `Ver última atualização — ${label}` : "Ver última atualização")}
                        className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-medium px-2.5 py-0.5 text-xs my-0.5 transition-colors"
                      >{children}</button>
                    );
                  }

                  return href?.startsWith("/")
                    ? <Link to={href} className="text-primary font-medium hover:underline">{children}</Link>
                    : <a href={href} target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline">{children}</a>;
                },
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto rounded-lg border border-border/70">
                    <table className="w-full border-collapse text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-primary/10">{children}</thead>,
                th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/70 whitespace-nowrap">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 align-top border-b border-border/40 last:border-b-0">{children}</td>,
                tr: ({ children }) => <tr className="even:bg-muted/40">{children}</tr>,
                code: ({ children }) => <code className="px-1 py-0.5 rounded bg-muted text-[0.85em] font-mono">{children}</code>,
                blockquote: ({ children }) => (
                  <blockquote className="my-3 rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2 text-foreground not-italic [&_p]:my-1">
                    {children}
                  </blockquote>
                ),
              }}
            >{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
