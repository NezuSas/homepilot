import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Settings2, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

interface DormantWidgetPlaceholderProps {
  title: string;
  icon: LucideIcon;
  message: string;
  isEditing: boolean;
  onConfigure?: () => void;
  variant?: 'glass' | 'solid' | 'radiant' | 'outline' | 'flat';
}

export function DormantWidgetPlaceholder({
  title,
  icon: Icon,
  message,
  isEditing,
  onConfigure,
  variant = 'glass'
}: DormantWidgetPlaceholderProps) {
  const { t } = useTranslation();
  return (
    <div className={cn(
      "relative w-full h-full rounded-[2.5rem] overflow-hidden flex flex-col items-center justify-center p-8 text-center transition-all duration-700",
      variant === 'glass' && "bg-card/40 backdrop-blur-2xl border border-border/40",
      variant === 'solid' && "bg-muted/80 border border-border/20",
      variant === 'radiant' && "bg-gradient-to-br from-primary/20 via-primary/5 to-card border border-primary/30 shadow-2xl shadow-primary/10",
      variant === 'outline' && "bg-transparent border-2 border-dashed border-border/40",
      variant === 'flat' && "bg-muted/30"
    )}>
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.05),transparent_70%)]" />
      </div>

      <div className={cn(
        "relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500",
        isEditing ? "bg-primary/20 text-primary animate-pulse" : "bg-muted text-muted-foreground/30"
      )}>
        <Icon className="w-7 h-7" />
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background border-2 border-muted flex items-center justify-center">
           <AlertCircle className="w-2.5 h-2.5 text-muted-foreground/40" />
        </div>
      </div>

      <div className="space-y-2 max-w-[200px]">
        <h4 className="text-body font-black uppercase tracking-widest text-foreground/40">{title}</h4>
        <p className="text-micro text-muted-foreground/40 leading-relaxed font-bold italic">
          {message}
        </p>
      </div>

      {isEditing && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onConfigure}
          className="mt-6 rounded-xl border-primary/20 hover:bg-primary/10 hover:text-primary transition-all group active:scale-95"
        >
          <Settings2 className="w-3.5 h-3.5 mr-2 group-hover:rotate-90 transition-transform" />
          <span className="text-micro font-black uppercase tracking-widest leading-none">
            {t('dashboards.widgets.bind_now')}
          </span>
        </Button>
      )}
    </div>
  );
}
