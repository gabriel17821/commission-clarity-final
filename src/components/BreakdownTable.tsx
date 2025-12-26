import { formatNumber, formatCurrency } from "@/lib/formatters";
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breakdown {
  name: string;
  label: string;
  amount: number;
  percentage: number;
  commission: number;
  color: string;
  // Offer fields
  grossAmount?: number;
  netAmount?: number;
  quantity?: number;
  unitPrice?: number;
  isOffer?: boolean;
}

interface BreakdownTableProps {
  totalInvoice: number;
  breakdown: Breakdown[];
  restAmount: number;
  restPercentage: number;
  restCommission: number;
  totalCommission: number;
  grossTotal?: number;
  netTotal?: number;
}

export const BreakdownTable = ({
  totalInvoice,
  breakdown,
  restAmount,
  restPercentage,
  restCommission,
  totalCommission,
  grossTotal,
  netTotal,
}: BreakdownTableProps) => {
  // Separate products and offers
  const regularProducts = breakdown.filter(b => !b.isOffer && (b.amount > 0 || (b.netAmount && b.netAmount > 0)));
  const offerProducts = breakdown.filter(b => b.isOffer);
  const hasOffers = offerProducts.length > 0;
  
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Desglose de Comisión</h3>
        {hasOffers && (
          <div className="flex items-center gap-1.5 text-amber-600">
            <Gift className="h-4 w-4" />
            <span className="text-xs font-medium">{offerProducts.length} producto(s) en oferta</span>
          </div>
        )}
      </div>
      
      <div className="divide-y divide-border">
        {/* Total Invoice Row */}
        <div className="grid grid-cols-4 text-sm">
          <div className="px-4 py-3 text-muted-foreground">Total Factura</div>
          <div className="px-4 py-3 text-right font-mono text-foreground">
            {grossTotal && grossTotal !== netTotal && (
              <span className="text-muted-foreground line-through mr-2">${formatNumber(grossTotal)}</span>
            )}
            ${formatNumber(totalInvoice)}
          </div>
          <div className="px-4 py-3"></div>
          <div className="px-4 py-3 text-right text-muted-foreground">—</div>
        </div>
        
        {/* Regular Products */}
        {regularProducts.map((item, idx) => {
          const displayAmount = item.netAmount ?? item.amount;
          
          return (
            <div key={idx} className="grid grid-cols-4 text-sm">
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="text-foreground font-medium truncate">{item.label}</span>
              </div>
              <div className="px-4 py-3 text-right font-mono text-foreground">
                ${formatNumber(displayAmount)}
              </div>
              <div className="px-4 py-3 text-center text-muted-foreground text-xs">
                {item.quantity && item.unitPrice && (
                  <span>{item.quantity} × ${formatNumber(item.unitPrice)}</span>
                )}
              </div>
              <div className="px-4 py-3 text-right font-mono font-semibold text-success">
                +${formatCurrency(item.commission)}
                <span className="text-muted-foreground text-xs ml-1">({item.percentage}%)</span>
              </div>
            </div>
          );
        })}
        
        {/* OFFER Products - Grouped */}
        {hasOffers && (
          <>
            <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Productos en Oferta (Sin Comisión)</span>
            </div>
            {offerProducts.map((item, idx) => (
              <div key={`offer-${idx}`} className={cn(
                "grid grid-cols-4 text-sm",
                "bg-amber-50/50 dark:bg-amber-950/20"
              )}>
                <div className="px-4 py-3 flex items-center gap-2">
                  <Gift className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-300 font-medium truncate">{item.label}</span>
                </div>
                <div className="px-4 py-3 text-right font-mono">
                  <span className="line-through text-muted-foreground">${formatNumber(item.grossAmount || 0)}</span>
                  <span className="text-amber-600 font-bold ml-2">$0</span>
                </div>
                <div className="px-4 py-3 text-center text-muted-foreground text-xs">
                  {item.quantity && item.unitPrice && (
                    <span>{item.quantity} × ${formatNumber(item.unitPrice)}</span>
                  )}
                </div>
                <div className="px-4 py-3 text-right font-mono text-muted-foreground">
                  $0.00
                  <span className="text-xs ml-1">(GRATIS)</span>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* Rest Row */}
        {restAmount > 0 && (
          <div className="grid grid-cols-4 text-sm">
            <div className="px-4 py-3 text-muted-foreground">Resto</div>
            <div className="px-4 py-3 text-right font-mono text-foreground">
              ${formatNumber(restAmount)}
            </div>
            <div className="px-4 py-3"></div>
            <div className="px-4 py-3 text-right font-mono text-foreground">
              +${formatCurrency(restCommission)}
              <span className="text-muted-foreground text-xs ml-1">({restPercentage}%)</span>
            </div>
          </div>
        )}
        
        {/* Total Row */}
        <div className="grid grid-cols-4 text-sm bg-success/10">
          <div className="px-4 py-4 font-semibold text-foreground">Total Comisión</div>
          <div className="px-4 py-4"></div>
          <div className="px-4 py-4"></div>
          <div className="px-4 py-4 text-right font-mono font-bold text-lg text-success">
            ${formatCurrency(totalCommission)}
          </div>
        </div>
      </div>
    </div>
  );
};
