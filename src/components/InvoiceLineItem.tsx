import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Gift } from "lucide-react";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface InvoiceLineItemProps {
  productName: string;
  productColor?: string;
  percentage: number;
  quantity: number;
  unitPrice: number;
  isOffer: boolean;
  onQuantityChange: (quantity: number) => void;
  onUnitPriceChange: (price: number) => void;
  onOfferChange: (isOffer: boolean) => void;
  onRemove: () => void;
}

export const InvoiceLineItem = ({
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
}: InvoiceLineItemProps) => {
  const [qtyValue, setQtyValue] = useState(quantity > 0 ? quantity.toString() : '');
  const [priceValue, setPriceValue] = useState(unitPrice > 0 ? unitPrice.toString() : '');

  useEffect(() => {
    if (quantity === 0 && qtyValue !== '' && qtyValue !== '0') {
      setQtyValue('');
    }
  }, [quantity]);

  useEffect(() => {
    if (unitPrice === 0 && priceValue !== '' && priceValue !== '0') {
      setPriceValue('');
    }
  }, [unitPrice]);

  const grossAmount = quantity * unitPrice;
  // If offer, net is 0 (no commission)
  const netAmount = isOffer ? 0 : grossAmount;
  const commission = netAmount * (percentage / 100);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setQtyValue(raw);
    onQuantityChange(parseInt(raw) || 0);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    if ((raw.match(/\./g) || []).length > 1) return;
    setPriceValue(raw);
    onUnitPriceChange(parseFloat(raw) || 0);
  };

  return (
    <div className={cn(
      "group grid grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-all",
      isOffer 
        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700" 
        : "bg-card border-border hover:border-primary/30"
    )}>
      {/* Product Name */}
      <div className="col-span-3 flex items-center gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-sm font-medium truncate",
            isOffer ? "text-amber-700 dark:text-amber-300" : "text-foreground"
          )}>
            {productName}
          </p>
          {isOffer ? (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600 uppercase">
              <Gift className="h-3 w-3" />
              <span>GRATIS</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{percentage}% comisión</p>
          )}
        </div>
      </div>

      {/* Quantity */}
      <div className="col-span-2">
        <Input
          type="text"
          inputMode="numeric"
          value={qtyValue}
          onChange={handleQtyChange}
          placeholder="Cant."
          className="h-9 text-center text-sm font-medium"
        />
      </div>

      {/* Unit Price */}
      <div className="col-span-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <Input
            type="text"
            inputMode="decimal"
            value={priceValue}
            onChange={handlePriceChange}
            placeholder="0.00"
            className={cn(
              "h-9 pl-5 text-right text-sm font-medium",
              isOffer && "text-muted-foreground"
            )}
          />
        </div>
      </div>

      {/* Line Total */}
      <div className="col-span-2 text-right">
        {isOffer ? (
          <div>
            <p className="text-sm text-muted-foreground line-through">${formatNumber(grossAmount)}</p>
            <p className="text-sm font-bold text-amber-600">$0 (Oferta)</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-bold text-foreground">${formatNumber(netAmount)}</p>
            {netAmount > 0 && (
              <p className="text-xs font-semibold text-emerald-600">
                +${formatCurrency(commission)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Offer Checkbox + Delete */}
      <div className="col-span-3 flex items-center justify-end gap-2">
        {/* OFFER TOGGLE - ALWAYS VISIBLE */}
        <div 
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all border",
            isOffer 
              ? "bg-amber-200 dark:bg-amber-800 border-amber-400 dark:border-amber-600" 
              : "bg-muted/50 border-border hover:bg-muted hover:border-primary/30"
          )}
          onClick={() => onOfferChange(!isOffer)}
        >
          <Checkbox 
            checked={isOffer} 
            onCheckedChange={(checked) => onOfferChange(!!checked)}
            className={cn(
              "h-4 w-4",
              isOffer && "border-amber-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
            )}
          />
          <Gift className={cn(
            "h-4 w-4",
            isOffer ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
          )} />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
