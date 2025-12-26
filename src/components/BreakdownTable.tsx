import { formatNumber, formatCurrency } from "@/lib/formatters";
import { Gift } from "lucide-react";

interface Breakdown {
  name: string;
  label: string;
  amount: number;
  percentage: number;
  commission: number;
  color: string;
  // Optional offer fields
  grossAmount?: number;
  netAmount?: number;
  quantitySold?: number;
  quantityFree?: number;
  unitPrice?: number;
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
  const activeProducts = breakdown.filter(b => b.amount > 0 || (b.netAmount && b.netAmount > 0));
  const hasOffers = activeProducts.some(b => b.quantityFree && b.quantityFree > 0);
  
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Desglose de Comisión</h3>
        {hasOffers && (
          <div className="flex items-center gap-1.5 text-amber-600">
            <Gift className="h-4 w-4" />
            <span className="text-xs font-medium">Incluye ofertas</span>
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
        
        {/* Special Products */}
        {activeProducts.map((item, idx) => {
          const hasOffer = item.quantityFree && item.quantityFree > 0;
          const displayAmount = item.netAmount ?? item.amount;
          
          return (
            <div key={idx} className="grid grid-cols-4 text-sm">
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="text-foreground font-medium truncate">{item.label}</span>
                {hasOffer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium">
                    {item.quantitySold}+{item.quantityFree}
                  </span>
                )}
              </div>
              <div className="px-4 py-3 text-right font-mono text-foreground">
                {hasOffer && item.grossAmount && (
                  <span className="text-muted-foreground line-through mr-2 text-xs">${formatNumber(item.grossAmount)}</span>
                )}
                ${formatNumber(displayAmount)}
              </div>
              <div className="px-4 py-3 text-center text-muted-foreground text-xs">
                {hasOffer && item.quantitySold && item.unitPrice && (
                  <span>{item.quantitySold} × ${formatNumber(item.unitPrice)}</span>
                )}
              </div>
              <div className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                +${formatCurrency(item.commission)}
                <span className="text-muted-foreground text-xs ml-1">({item.percentage}%)</span>
              </div>
            </div>
          );
        })}
        
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
