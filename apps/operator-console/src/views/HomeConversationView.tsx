import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Send, 
  Bot, 
  Zap,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { converseWithAssistant } from '../lib/assistantApi';
import type { ChatMessage, AssistantConversationResponse, AssistantConverseRequest } from '../types/assistantConversation';
import { StatusPill } from '../components/ui/StatusPill';
import { useSession } from '../lib/useSession';
import { API_BASE_URL } from '../config';
import { generateId } from '../utils/generateId';

const HOME_ASCII_ART = `
                         8888  8888888
                  888888888888888888888888
               8888:::8888888888888888888888888888
             8888::::::88888888888888888888888888888888
            88::::::::888:::888888888888888888888888888
          88888888::::8:::::::::::8888888888888888888888
        888 8::888888::::::::::::::::::88888888888   888
           88::::88888888::::m::::::::::88888888888    8
         888888888888888888:M:::::::::::8888888888888
        88888888888888888888::::::::::::M88888888888888
        8888888888888888888888:::::::::M8888888888888888
         8888888888888888888888:::::::M888888888888888888
        8888888888888888::88888::::::M88888888888888888888
      88888888888888888:::88888:::::M888888888888888   8888
     88888888888888888:::88888::::M::;o*M*o;888888888    88
    88888888888888888:::8888:::::M:::::::::::88888888    8
   88888888888888888::::88::::::M:;:::::::::::888888888
  8888888888888888888:::8::::::M::aAa::::::::M8888888888       8
  88   8888888888::88::::8::::M:::::::::::::888888888888888 8888
 88  88888888888:::8:::::::::M::::::::::;::88:88888888888888888
 8  8888888888888:::::::::::M::"@@@@@@"::::8w8888888888888888
  88888888888:888::::::::::M:::::"@a@":::::M8i88888888888888888
 8888888888::::88:::::::::M88:::::::::::::M88z888888888888888888
8888888888:::::8:::::::::M88888:::::::::MM888!888888888888888888
888888888:::::8:::::::::M8888888MAmmmAMVMM888*88888888   88888888
888888 M:::::::::::::::M888888888:::::::MM88888888888888   8888888
8888   M::::::::::::::M88888888888::::::MM888888888888888    88888
 888   M:::::::::::::M8888888888888M:::::mM888888888888888    8888
  888  M::::::::::::M8888:888888888888::::m::Mm88888 888888   8888
   88  M::::::::::::8888:88888888888888888::::::Mm8   88888   888
   88  M::::::::::8888M::88888::888888888888:::::::Mm88888    88
   8   MM::::::::8888M:::8888:::::888888888888::::::::Mm8     4
       8M:::::::8888M:::::888:::::::88:::8888888::::::::Mm    2
      88MM:::::8888M:::::::88::::::::8:::::888888:::M:::::M
     8888M:::::888MM::::::::8:::::::::::M::::8888::::M::::M
    88888M:::::88:M::::::::::8:::::::::::M:::8888::::::M::M
   88 888MM:::888:M:::::::::::::::::::::::M:8888:::::::::M:
   8 88888M:::88::M:::::::::::::::::::::::MM:88::::::::::::M
     88888M:::88::M::::::::::*88*::::::::::M:88::::::::::::::M
    888888M:::88::M:::::::::88@@88:::::::::M::88::::::::::::::M
    888888MM::88::MM::::::::88@@88:::::::::M:::8::::::::::::::*8
    88888  M:::8::MM:::::::::*88*::::::::::M:::::::::::::::::88@@
    8888   MM::::::MM:::::::::::::::::::::MM:::::::::::::::::88@@
     888    M:::::::MM:::::::::::::::::::MM::M::::::::::::::::*8
     888    MM:::::::MMM::::::::::::::::MM:::MM:::::::::::::::M
      88     M::::::::MMMM:::::::::::MMMM:::::MM::::::::::::MM
       88    MM:::::::::MMMMMMMMMMMMMMM::::::::MMM::::::::MMM
        88    MM::::::::::::MMMMMMM::::::::::::::MMMMMMMMMM
         88   8MM::::::::::::::::::::::::::::::::::MMMMMM
          8   88MM::::::::::::::::::::::M:::M::::::::MM
              888MM::::::::::::::::::MM::::::MM::::::MM
             88888MM:::::::::::::::MMM:::::::mM:::::MM
             888888MM:::::::::::::MMM:::::::::MMM:::M
            88888888MM:::::::::::MMM:::::::::::MM:::M
           88 8888888M:::::::::MMM::::::::::::::M:::M
           8  888888 M:::::::MM:::::::::::::::::M:::M:
              888888 M::::::M:::::::::::::::::::M:::MM
             888888  M:::::M::::::::::::::::::::::::M:M
             888888  M:::::M:::::::::@::::::::::::::M::M
             88888   M::::::::::::::@@:::::::::::::::M::M
            88888   M::::::::::::::@@@::::::::::::::::M::M
           88888   M:::::::::::::::@@::::::::::::::::::M::M
          88888   M:::::m::::::::::@::::::::::Mm:::::::M:::M
          8888   M:::::M:::::::::::::::::::::::MM:::::::M:::M
          8888   M:::::M:::::::::::::::::::::::MMM::::::::M:::M
        888    M:::::Mm::::::::::::::::::::::MMM:::::::::M::::M
      8888    MM::::Mm:::::::::::::::::::::MMMM:::::::::m::m:::M
     888      M:::::M::::::::::::::::::::MMM::::::::::::M::mm:::M
  8888       MM:::::::::::::::::::::::::MM:::::::::::::mM::MM:::M:
             M:::::::::::::::::::::::::M:::::::::::::::mM::MM:::Mm
            MM::::::m:::::::::::::::::::::::::::::::::::M::MM:::MM
            M::::::::M:::::::::::::::::::::::::::::::::::M::M:::MM
           MM:::::::::M:::::::::::::M:::::::::::::::::::::M:M:::MM
           M:::::::::::M88:::::::::M:::::::::::::::::::::::MM::MMM
           M::::::::::::8888888888M::::::::::::::::::::::::MM::MM
           M:::::::::::::88888888M:::::::::::::::::::::::::M::MM
           M::::::::::::::888888M:::::::::::::::::::::::::M::MM
           M:::::::::::::::88888M:::::::::::::::::::::::::M:MM
           M:::::::::::::::::88M::::::::::::::::::::::::::MMM
           M:::::::::::::::::::M::::::::::::::::::::::::::MMM
           MM:::::::::::::::::M::::::::::::::::::::::::::MMM
            M:::::::::::::::::M::::::::::::::::::::::::::MMM
            MM:::::::::::::::M::::::::::::::::::::::::::MMM
             M:::::::::::::::M:::::::::::::::::::::::::MMM
             MM:::::::::::::M:::::::::::::::::::::::::MMM
              M:::::::::::::M::::::::::::::::::::::::MMM
              MM:::::::::::M::::::::::::::::::::::::MMM
               M:::::::::::M:::::::::::::::::::::::MMM
               MM:::::::::M:::::::::::::::::::::::MMM
                M:::::::::M::::::::::::::::::::::MMM
                MM:::::::M::::::::::::::::::::::MMM
                 MM::::::M:::::::::::::::::::::MMM
                 MM:::::M:::::::::::::::::::::MMM
                  MM::::M::::::::::::::::::::MMM
                  MM:::M::::::::::::::::::::MMM
                   MM::M:::::::::::::::::::MMM
                   MM:M:::::::::::::::::::MMM
                    MMM::::::::::::::::::MMM
                    MM::::::::::::::::::MMM
                     M:::::::::::::::::MMM
                    MM::::::::::::::::MMM
                    MM:::::::::::::::MMM
                    MM::::M:::::::::MMM:
                    mMM::::MM:::::::MMMM
                     MMM:::::::::::MMM:M
                     mMM:::M:::::::M:M:M
                      MM::MMMM:::::::M:M
                      MM::MMM::::::::M:M
                      mMM::MM::::::::M:M
                       MM::MM:::::::::M:M
                       MM::MM::::::::::M:m
                       MM:::M:::::::::::MM
                       MMM:::::::::::::::M:
                       MMM:::::::::::::::M:
                       MMM::::::::::::::::M
                       MMM::::::::::::::::M
                       MMM::::::::::::::::Mm
                        MM::::::::::::::::MM
                        MMM:::::::::::::::MM
                        MMM:::::::::::::::MM
                        MMM:::::::::::::::MM
                        MMM:::::::::::::::MM
                         MM::::::::::::::MMM
                         MMM:::::::::::::MM
                         MMM:::::::::::::MM
                         MMM::::::::::::MM
                          MM::::::::::::MM
                          MM::::::::::::MM
                          MM:::::::::::MM
                          MMM::::::::::MM
                          MMM::::::::::MM
                           MM:::::::::MM
                           MMM::::::::MM
                           MMM::::::::MM
                            MM::::::::MM
                            MMM::::::MM
                            MMM::::::MM
                             MM::::::MM
                             MM::::::MM
                              MM:::::MM
                              MM:::::MM:
                              MM:::::M:M
                              MM:::::M:M
                              :M::::::M:
                             M:M:::::::M
                            M:::M::::::M
                           M::::M::::::M
                          M:::::M:::::::M
                         M::::::MM:::::::M
                         M:::::::M::::::::M
                         M;:;::::M:::::::::M
                         M:m:;:::M::::::::::M
                         MM:m:m::M::::::::;:M
                          MM:m::MM:::::::;:;M
                           MM::MMM::::::;:m:M
                            MMMM MM::::m:m:MM
                                  MM::::m:MM
                                   MM::::MM
                                    MM::MM
                                     MMMM
`;

export const HomeConversationView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSession(() => {});
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
      id: generateId(),
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
      const response = await converseWithAssistant({ 
        prompt: userText,
        userName: user?.displayName || user?.username
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

  const handleOptionClick = async (optionId: string, label: string, pendingAction?: AssistantConverseRequest['pendingAction']) => {
    if (isLoading) return;

    addMessage({ 
      role: 'user', 
      content: t('assistant.conversation.selected_option', { label }) 
    });
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: `Selected: ${label}`,
        userName: user?.displayName || user?.username,
        selectedOptionId: optionId,
        pendingAction,
        confirmed: optionId === 'confirm'
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
    <div className="flex flex-col h-full w-full animate-in fade-in duration-500 bg-background overflow-hidden">
      {/* Scrollable Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 lg:px-10 py-6 space-y-6 scroll-smooth custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="relative group">
              <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <pre aria-hidden="true" className="font-mono text-[2px] sm:text-[3px] md:text-[4px] lg:text-[5px] leading-[1.05] text-primary/60 select-none whitespace-pre filter drop-shadow-sm transition-all duration-700 group-hover:text-primary group-hover:scale-[1.02] max-h-72 overflow-hidden">
                {HOME_ASCII_ART}
              </pre>
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-bold tracking-tight text-foreground bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text">
                {t('assistant.conversation.empty_chat_title')}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto text-lg leading-relaxed">
                {t('assistant.conversation.empty_chat_description')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full mt-8">
              {[
                t('assistant.conversation.placeholder').split('ej: ')[1]?.split(',')[0] || t('assistant.conversation.suggestion_1'),
                t('assistant.conversation.suggestion_1'),
                t('assistant.conversation.suggestion_2'),
                t('assistant.conversation.suggestion_3')
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(suggestion)}
                  className="p-4 bg-card/40 hover:bg-card border border-border hover:border-primary/50 rounded-2xl text-sm text-left transition-all duration-200 hover:shadow-md group flex items-center justify-between"
                >
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">{suggestion}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "flex w-full animate-in slide-in-from-bottom-2 duration-300",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "flex space-x-3",
              msg.role === 'user' ? "flex-row-reverse space-x-reverse max-w-[88%] lg:max-w-[64%]" : "flex-row max-w-[88%] lg:max-w-[72%]"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg mt-1 overflow-hidden",
                msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-muted-foreground"
              )}>
                {msg.role === 'user' ? (
                  user?.avatarDataUri ? (
                    <img 
                      src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri} 
                      alt="avatar" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="font-black text-xs uppercase">{(user?.username || 'U').substring(0, 2)}</span>
                  )
                ) : (
                  <Bot className="w-5 h-5 text-primary" />
                )}
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
                
                <span className={cn(
                  "text-[10px] text-muted-foreground px-1 opacity-40",
                  msg.role === 'user' ? "text-right" : "text-left"
                )}>
                  {new Date(msg.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start w-full max-w-[85%] animate-in fade-in duration-300">
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

      {/* Sticky Input Area */}
      <div className="px-4 py-4 md:px-6 md:pb-8 bg-background/80 backdrop-blur-xl border-t border-border shrink-0">
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative flex items-center bg-card border border-border rounded-2xl focus-within:border-primary/40 focus-within:shadow-lg transition-all duration-300 group ring-offset-background focus-within:ring-2 focus-within:ring-primary/10">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('assistant.conversation.placeholder')}
              className="flex-1 bg-transparent border-none focus:ring-0 text-foreground p-4 py-4 pr-16 resize-none custom-scrollbar min-h-[56px] max-h-48 placeholder:text-muted-foreground/50 text-base"
              disabled={isLoading}
            />
            <div className="absolute right-2 bottom-2 flex items-center space-x-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 p-0 rounded-xl shadow-md hover:shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center px-1 mt-3">
            <div className="flex items-center space-x-2">
              <StatusPill variant={isLoading ? "warning" : "success"} className="scale-[0.7] origin-left" />
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                {t('assistant.conversation.version_label')}
              </p>
            </div>
            <div className="flex items-center space-x-4 opacity-40 hover:opacity-100 transition-opacity duration-500">
               <span className="text-[10px] text-muted-foreground flex items-center font-bold uppercase tracking-tighter">
                 <Zap className="w-3 h-3 mr-1 text-primary animate-pulse" /> {t('assistant.conversation.input_hint')}
               </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
