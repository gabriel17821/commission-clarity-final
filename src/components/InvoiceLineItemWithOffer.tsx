import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Gift } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface InvoiceLineItemWithOfferProps {
  productName: string;
  productColor: string;
  percentage: number;
  quantity: number;
  unitPrice: number;
  isOffer: boolean;
  onQuantityChange: (quantity: number) => void;
  onUnitPriceChange: (price: number) => void;
  onOfferChange: (isOffer: boolean) => void;
  onRemove: () => void;
}

export const InvoiceLineItemWithOffer = ({
  productName,
  productColor,
  percentage,
  quantity,
  unitPrice,
  isOffer,
  onQuantityChange,
  onUnitPriceChange,
  onOfferChange,
  onRemove,
}: InvoiceLineItemWithOfferProps) => {
  const [qtyStr, setQtyStr] = useState('');
  const [priceStr, setPriceStr] = useState('');

  useEffect(() => {
    if (quantity > 0 && qtyStr === '') {
      setQtyStr(quantity.toString());
    }
  }, [quantity]);

  useEffect(() => {
    if (unitPrice > 0 && priceStr === '') {
      setPriceStr(unitPrice.toString());
    }
  }, [unitPrice]);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setQtyStr(val);
    onQuantityChange(parseInt(val) || 0);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    if ((val.match(/\./g) || []).length > 1) return;
    setPriceStr(val);
    onUnitPriceChange(parseFloat(val) || 0);
  };

  const grossAmount = quantity * unitPrice;
  // If it's an offer, net is 0 (no commission)
  const netAmount = isOffer ? 0 : grossAmount;
  const commission = netAmount * (percentage / 100);

  return (
    <div className={cn(
      "grid grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-all",
      isOffer 
        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700" 
        : "bg-card border-border hover:border-primary/30"
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
          <span className={cn(
            "font-medium text-sm truncate block",
            isOffer && "text-amber-700 dark:text-amber-300"
          )}>
            {productName}
          </span>
          {isOffer && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 uppercase">
              <Gift className="h-3 w-3" />
              <span>GRATIS</span>
            </div>
          )}
        </div>
      </div>

      {/* Quantity */}
      <div className="col-span-2">
        <Input
          type="text"
          inputMode="numeric"
          value={qtyStr}
          onChange={handleQtyChange}
          placeholder="0"
          className="h-9 text-center text-sm font-semibold"
        />
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
            className={cn(
              "h-9 pl-5 text-right text-sm font-semibold",
              isOffer && "text-muted-foreground"
            )}
          />
        </div>
      </div>

      {/* Totals */}
      <div className="col-span-3 text-right space-y-0.5">
        {isOffer ? (
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground line-through">
              {formatCurrency(grossAmount)}
            </div>
            <div className="text-sm font-bold text-amber-600">
              $0.00 (Oferta)
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm font-semibold">
              {formatCurrency(netAmount)}
            </span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm font-bold text-success">
              {formatCurrency(commission)}
            </span>
          </div>
        )}
      </div>

      {/* Offer Checkbox + Remove */}
      <div className="col-span-2 flex items-center justify-end gap-2">
        {/* OFFER CHECKBOX - VISIBLE AND CLICKABLE */}
        <div 
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all border",
            isOffer 
              ? "bg-amber-200 dark:bg-amber-800 border-amber-400 dark:border-amber-600" 
              : "bg-muted/50 border-transparent hover:bg-muted hover:border-border"
          )}
          onClick={() => onOfferChange(!isOffer)}
        >
          <Checkbox 
            checked={isOffer} 
            onCheckedChange={(checked) => onOfferChange(!!checked)}
            className={cn(
              "h-4 w-4",
              isOffer && "border-amber-600 data-[state=checked]:bg-amber-600"
            )}
          />
          <Label className="text-xs font-semibold cursor-pointer select-none">
            <Gift className={cn("h-3.5 w-3.5", isOffer ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")} />
          </Label>
        </div>

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
