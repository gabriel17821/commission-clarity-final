import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, Calendar, Package, DollarSign, TrendingUp, ArrowLeft, Check, Save } from 'lucide-react';

interface Breakdown {
  name: string;
  label: string;
  amount: number;
  percentage: number;
  commission: number;
  color: string;
}

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  data: {
    ncf: string;
    invoiceDate: Date;
    clientName: string | null;
    totalAmount: number;
    breakdown: Breakdown[];
    restAmount: number;
    restPercentage: number;
    restCommission: number;
    totalCommission: number;
  };
}

export const InvoicePreviewDialog = ({
  open,
  onOpenChange,
  onConfirm,
  loading,
  data,
}: InvoicePreviewDialogProps) => {
  const hasProducts = data.breakdown.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Save className="h-5 w-5 text-primary" />
            Confirmar y Guardar
          </DialogTitle>
        </DialogHeader>

        {/* Horizontal Card Layout */}
        <div className="bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border/60 overflow-hidden">
          {/* Top Row - NCF, Date, Client, Total */}
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-border/40">
            {/* NCF */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">NCF</span>
              <p className="font-mono text-sm font-bold text-foreground">{data.ncf}</p>
            </div>
            
            {/* Date */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Fecha
              </span>
              <p className="text-sm font-semibold text-foreground">
                {format(data.invoiceDate, "d MMM yyyy", { locale: es })}
              </p>
            </div>
            
            {/* Client */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                <User className="h-3 w-3" /> Cliente
              </span>
              <p className="text-sm font-semibold text-foreground truncate">
                {data.clientName || 'Sin cliente'}
              </p>
            </div>
            
            {/* Total */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Total
              </span>
              <p className="text-lg font-bold text-foreground">${formatNumber(data.totalAmount)}</p>
            </div>
          </div>

          {/* Products Row - Horizontal scroll */}
          {(hasProducts || data.restAmount > 0) && (
            <div className="p-4 border-b border-border/40">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desglose</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {data.breakdown.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/80 border border-border/50"
                  >
                    <span 
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.percentage}%
                    </span>
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">${formatNumber(item.amount)}</span>
                    <span className="text-sm font-semibold text-success">${formatCurrency(item.commission)}</span>
                  </div>
                ))}
                
                {data.restAmount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/50">
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px] font-bold">
                      {data.restPercentage}%
                    </span>
                    <span className="text-sm font-medium text-foreground">Resto</span>
                    <span className="text-xs text-muted-foreground">${formatNumber(data.restAmount)}</span>
                    <span className="text-sm font-semibold text-success">${formatCurrency(data.restCommission)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Commission Row */}
          <div className="p-4 bg-gradient-to-r from-success/10 via-success/5 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Tu Comisión Total</span>
              </div>
              <p className="text-2xl font-black text-success">${formatCurrency(data.totalCommission)}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 gap-2 gradient-success text-success-foreground"
          >
            <Check className="h-4 w-4" />
            {loading ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
