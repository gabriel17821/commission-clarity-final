import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Gift, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InvoiceLineItemWithOfferProps {
  productName: string;
  productColor: string;
  percentage: number;
  quantitySold: number;
  quantityFree: number;
  unitPrice: number;
  onQuantitySoldChange: (quantity: number) => void;
  onQuantityFreeChange: (quantity: number) => void;
  onUnitPriceChange: (price: number) => void;
  onRemove: () => void;
}

export const InvoiceLineItemWithOffer = ({
  productName,
  productColor,
  percentage,
  quantitySold,
  quantityFree,
  unitPrice,
  onQuantitySoldChange,
  onQuantityFreeChange,
  onUnitPriceChange,
  onRemove,
}: InvoiceLineItemWithOfferProps) => {
  const [soldStr, setSoldStr] = useState('');
  const [freeStr, setFreeStr] = useState('');
  const [priceStr, setPriceStr] = useState('');

  useEffect(() => {
    if (quantitySold > 0 && soldStr === '') {
      setSoldStr(quantitySold.toString());
    }
  }, [quantitySold]);

  useEffect(() => {
    if (quantityFree > 0 && freeStr === '') {
      setFreeStr(quantityFree.toString());
    }
  }, [quantityFree]);

  useEffect(() => {
    if (unitPrice > 0 && priceStr === '') {
      setPriceStr(unitPrice.toString());
    }
  }, [unitPrice]);

  const handleSoldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setSoldStr(val);
    onQuantitySoldChange(parseInt(val) || 0);
  };

  const handleFreeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setFreeStr(val);
    onQuantityFreeChange(parseInt(val) || 0);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    if ((val.match(/\./g) || []).length > 1) return;
    setPriceStr(val);
    onUnitPriceChange(parseFloat(val) || 0);
  };

  const totalQuantity = quantitySold + quantityFree;
  const grossAmount = totalQuantity * unitPrice;
  const netAmount = quantitySold * unitPrice;
  const commission = netAmount * (percentage / 100);
  const hasOffer = quantityFree > 0;

  return (
    <div className={cn(
      "grid grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-all",
      hasOffer ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-card border-border hover:border-primary/30"
    )}>
      {/* Product Name */}
      <div className="col-span-3 flex items-center gap-2">
        <span 
          className="h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
          style={{ backgroundColor: productColor }}
        >
          {percentage}%
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-medium text-sm truncate block">{productName}</span>
          {hasOffer && (
            <Badge variant="outline" className="text-[10px] gap-1 mt-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300">
              <Gift className="h-3 w-3" />
              {quantitySold}+{quantityFree}
            </Badge>
          )}
        </div>
      </div>

      {/* Quantity Sold */}
      <div className="col-span-2">
        <div className="relative">
          <Input
            type="text"
            inputMode="numeric"
            value={soldStr}
            onChange={handleSoldChange}
            placeholder="0"
            className="h-9 text-center text-sm font-semibold pr-6"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Tag className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Cantidad vendida</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Quantity Free */}
      <div className="col-span-1">
        <div className="relative">
          <Input
            type="text"
            inputMode="numeric"
            value={freeStr}
            onChange={handleFreeChange}
            placeholder="0"
            className={cn(
              "h-9 text-center text-sm font-semibold",
              hasOffer && "border-amber-300 bg-amber-50/50 dark:bg-amber-900/30"
            )}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Gift className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3",
                  hasOffer ? "text-amber-600" : "text-muted-foreground"
                )} />
              </TooltipTrigger>
              <TooltipContent>
                <p>Cantidad gratis (oferta)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Unit Price */}
      <div className="col-span-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <Input
            type="text"
            inputMode="decimal"
            value={priceStr}
            onChange={handlePriceChange}
            placeholder="0.00"
            className="h-9 pl-5 text-right text-sm font-semibold"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="col-span-3 text-right space-y-0.5">
        {hasOffer && (
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground line-through">
            <span>Bruto: {formatCurrency(grossAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <span className={cn("text-sm font-semibold", hasOffer && "text-amber-700 dark:text-amber-300")}>
            {formatCurrency(netAmount)}
          </span>
          <span className="text-xs text-muted-foreground">→</span>
          <span className="text-sm font-bold text-success">
            {formatCurrency(commission)}
          </span>
        </div>
      </div>

      {/* Remove */}
      <div className="col-span-1 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
