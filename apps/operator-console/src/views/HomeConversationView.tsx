import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  MessageSquare,
  Zap,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { converseWithAssistant } from '../lib/assistantApi';
import type { ChatMessage, AssistantConversationResponse } from '../types/assistantConversation';
import { StatusPill } from '../components/ui/StatusPill';

export const HomeConversationView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userText = text.trim();
    setInput('');
    addMessage({ role: 'user', content: userText });
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({ prompt: userText });
      handleResponse(response);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addMessage({
        role: 'assistant',
        content: errorMessage || t('assistant.conversation.unknown_error'),
        responseType: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResponse = (response: AssistantConversationResponse) => {
    addMessage({
      role: 'assistant',
      content: response.message,
      responseType: response.type,
      options: response.clarification?.options,
      execution: response.execution,
      pendingAction: response.clarification?.pendingAction
    });
  };

  const handleOptionClick = async (optionId: string, label: string, pendingAction?: any) => {
    if (isLoading) return;

    addMessage({ 
      role: 'user', 
      content: t('assistant.conversation.selected_option', { label }) 
    });
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: `Selected: ${label}`,
        selectedOptionId: optionId,
        pendingAction
      });
      handleResponse(response);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addMessage({
        role: 'assistant',
        content: errorMessage || t('assistant.conversation.unknown_error'),
        responseType: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <SectionHeader 
        title={t('assistant.conversation.title')} 
        subtitle={t('assistant.conversation.subtitle')}
        icon={MessageSquare}
      />

      <div className="flex flex-col flex-1 min-h-0 bg-card/40 backdrop-blur-md border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
              <div className="p-4 bg-primary/10 rounded-full">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-foreground">{t('assistant.conversation.empty_title')}</h3>
                <p className="text-muted-foreground max-w-sm">{t('assistant.conversation.empty_description')}</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex w-full max-w-[85%] animate-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? "ml-auto justify-end" : "mr-auto justify-start"
              )}
            >
              <div className={cn(
                "flex space-x-3",
                msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
                  msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-muted-foreground"
                )}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-primary" />}
                </div>
                
                <div className="flex flex-col space-y-2">
                  <div className={cn(
                    "p-4 rounded-2xl shadow-xl border",
                    msg.role === 'user' 
                      ? "bg-primary text-primary-foreground rounded-tr-none border-primary" 
                      : "bg-muted/80 border-border text-foreground rounded-tl-none"
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {/* Clarification Options */}
                    {msg.options && msg.options.length > 0 && (
                      <div className="mt-4 space-y-2 pt-4 border-t border-border/50">
                        <p className="text-sm text-muted-foreground mb-3">{t('assistant.conversation.options_question')}</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.options.map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => handleOptionClick(opt.id, opt.label, msg.pendingAction)}
                              className="px-4 py-2 bg-background/50 hover:bg-primary/10 border border-border hover:border-primary/50 rounded-xl text-sm font-medium transition-all duration-200 flex items-center group text-foreground"
                            >
                              <span>{opt.label}</span>
                              <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Execution Status */}
                    {msg.execution && (
                      <div className="mt-4 pt-4 border-t border-border/50 flex items-center space-x-2">
                        {msg.execution.status === 'success' ? (
                          <StatusPill variant="success">{t('assistant.conversation.execution_success')}</StatusPill>
                        ) : msg.execution.status === 'partial' ? (
                          <StatusPill variant="warning">{t('assistant.conversation.execution_partial')}</StatusPill>
                        ) : (
                          <StatusPill variant="danger">{t('assistant.conversation.execution_failed')}</StatusPill>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <span className="text-[10px] text-muted-foreground px-1 opacity-40">
                    {new Date(msg.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex mr-auto justify-start w-full max-w-[85%] animate-in fade-in duration-300">
              <div className="flex space-x-3">
                <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0 shadow-lg">
                  <Bot className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div className="bg-muted/30 border border-border p-4 rounded-2xl rounded-tl-none flex space-x-1.5 items-center shadow-lg">
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-muted/20 border-t border-border backdrop-blur-sm">
          <div className="relative flex items-center bg-card/40 border border-border rounded-2xl focus-within:border-primary/50 transition-all duration-200 shadow-inner group">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('assistant.conversation.placeholder')}
              className="flex-1 bg-transparent border-none focus:ring-0 text-foreground p-4 py-4 pr-16 resize-none custom-scrollbar min-h-[56px] max-h-32 placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <div className="absolute right-2 flex items-center space-x-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 p-0 rounded-xl shadow-lg"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center px-1 mt-2">
            <p className="text-[10px] text-muted-foreground opacity-40 uppercase tracking-widest font-medium">
              {t('assistant.conversation.version_label')} • {isLoading ? t('assistant.conversation.sending') : t('assistant.conversation.ready')}
            </p>
            <div className="flex items-center space-x-4 opacity-30 hover:opacity-100 transition-opacity duration-300">
               <span className="text-[10px] text-muted-foreground flex items-center"><Zap className="w-3 h-3 mr-1" /> {t('assistant.conversation.input_hint')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
