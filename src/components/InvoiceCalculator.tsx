import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, Calculator, Package, CalendarIcon, FileText, User, Save, RefreshCw, DollarSign, Plus, Search, X, Settings, Gift } from "lucide-react";
import { EditRestPercentageDialog } from "@/components/EditRestPercentageDialog";
import { BreakdownTable } from "@/components/BreakdownTable";
import { ProductCatalogDialog } from "@/components/ProductCatalogDialog";
import { ClientSelector } from "@/components/ClientSelector";
import { SaveSuccessAnimation } from "@/components/SaveSuccessAnimation";
import { InvoicePreviewDialog } from "@/components/InvoicePreviewDialog";
import { InvoiceLineItemWithOffer } from "@/components/InvoiceLineItemWithOffer";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Invoice } from "@/hooks/useInvoices";
import { Client } from "@/hooks/useClients";
import { Seller } from "@/hooks/useSellers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  percentage: number;
  color: string;
  is_default: boolean;
}

interface ProductLineData {
  productId: string;
  quantity: number;
  unitPrice: number;
  isOffer: boolean; // If true, this is a free item (no commission)
}

interface Breakdown {
  name: string;
  label: string;
  amount: number;
  grossAmount: number;
  netAmount: number;
  percentage: number;
  commission: number;
  color: string;
  quantity: number;
  unitPrice: number;
  isOffer: boolean;
}

interface InvoiceCalculatorProps {
  products: Product[];
  restPercentage: number;
  isLoading: boolean;
  onAddProduct: (name: string, percentage: number) => Promise<any>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  onDeleteProduct: (id: string) => void;
  onUpdateRestPercentage: (value: number) => Promise<boolean>;
  onSaveInvoice: (ncf: string, invoiceDate: string, clientId?: string, productAmounts?: Record<string, number>) => Promise<any>;
  suggestedNcf?: number | null;
  lastInvoice?: Invoice;
  clients: Client[];
  onAddClient: (name: string, phone?: string, email?: string) => Promise<Client | null>;
  onDeleteClient?: (id: string) => Promise<boolean>;
  activeSeller?: Seller | null;
  onReset: () => void;
  productAmounts: Record<string, number>;
  onProductChange: (id: string, value: number) => void;
}

export const InvoiceCalculator = ({
  products,
  restPercentage,
  isLoading,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateRestPercentage,
  onSaveInvoice,
  suggestedNcf,
  clients,
  onAddClient,
  onDeleteClient,
  activeSeller,
  onReset,
  productAmounts,
  onProductChange,
}: InvoiceCalculatorProps) => {
  // Invoice header data
  const [ncfSuffix, setNcfSuffix] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Product lines with quantity and price
  const [productLines, setProductLines] = useState<ProductLineData[]>([]);
  
  // UI State
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPercentage, setNewProductPercentage] = useState(15);
  const [addLoading, setAddLoading] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const ncfPrefix = 'B010000';

  useEffect(() => {
    if (suggestedNcf !== null && suggestedNcf !== undefined) {
      setNcfSuffix(String(suggestedNcf).padStart(4, '0'));
    }
  }, [suggestedNcf]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate totals with offer support
  const calculations = useMemo(() => {
    const breakdown: Breakdown[] = [];
    let grossTotal = 0;
    let netTotal = 0;
    let totalOfferItems = 0;
    let totalOfferValue = 0;

    productLines.forEach(line => {
      const product = products.find(p => p.id === line.productId);
      if (product && line.quantity > 0) {
        const lineTotal = line.quantity * line.unitPrice;
        // If offer, it contributes to gross but NOT to net
        const netAmount = line.isOffer ? 0 : lineTotal;
        const commission = netAmount * (product.percentage / 100);
        
        breakdown.push({
          name: product.name,
          label: product.name,
          amount: netAmount,
          grossAmount: lineTotal,
          netAmount,
          percentage: product.percentage,
          commission,
          color: product.color,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          isOffer: line.isOffer,
        });
        
        grossTotal += lineTotal;
        netTotal += netAmount;
        
        if (line.isOffer) {
          totalOfferItems += line.quantity;
          totalOfferValue += lineTotal;
        }
      }
    });

    const restAmount = 0;
    const restCommission = restAmount * (restPercentage / 100);
    const totalCommission = breakdown.reduce((sum, item) => sum + item.commission, 0) + restCommission;

    return { 
      breakdown, 
      totalInvoice: netTotal, 
      grossTotal,
      netTotal,
      restAmount, 
      restCommission, 
      totalCommission,
      totalOfferItems,
      totalOfferValue,
    };
  }, [productLines, products, restPercentage]);

  const activeProductIds = productLines.map(l => l.productId);
  const filteredCatalog = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
    !activeProductIds.includes(p.id)
  );

  const handleAddLine = (productId: string) => {
    setProductLines(prev => [...prev, { productId, quantity: 0, unitPrice: 0, isOffer: false }]);
    setSearchTerm('');
    setShowSearch(false);
    toast.success("Producto agregado");
  };

  const handleRemoveLine = (productId: string) => {
    setProductLines(prev => prev.filter(l => l.productId !== productId));
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setProductLines(prev => prev.map(l => 
      l.productId === productId ? { ...l, quantity } : l
    ));
  };

  const handleUnitPriceChange = (productId: string, unitPrice: number) => {
    setProductLines(prev => prev.map(l => 
      l.productId === productId ? { ...l, unitPrice } : l
    ));
  };

  const handleOfferChange = (productId: string, isOffer: boolean) => {
    setProductLines(prev => prev.map(l => 
      l.productId === productId ? { ...l, isOffer } : l
    ));
  };

  // Sync productAmounts when lines change
  useEffect(() => {
    productLines.forEach(line => {
      // For offers, net amount is 0
      const lineTotal = line.isOffer ? 0 : line.quantity * line.unitPrice;
      if (productAmounts[line.productId] !== lineTotal) {
        onProductChange(line.productId, lineTotal);
      }
    });
  }, [productLines]);

  const handleNcfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setNcfSuffix(value);
  };

  const handleReset = useCallback(() => {
    setNcfSuffix('');
    setInvoiceDate(new Date());
    setSelectedClient(null);
    setProductLines([]);
    onReset();
  }, [onReset]);

  const handleConfirmSave = async () => {
    setIsSaving(true);
    setShowPreviewDialog(false);
    setShowSaveAnimation(true);
    const fullNcf = `${ncfPrefix}${ncfSuffix.padStart(4, '0')}`;
    
    // Build productAmounts from lines (offers have 0 net value)
    const amounts: Record<string, number> = {};
    productLines.forEach(line => {
      amounts[line.productId] = line.isOffer ? 0 : line.quantity * line.unitPrice;
    });
    
    await onSaveInvoice(fullNcf, format(invoiceDate, 'yyyy-MM-dd'), selectedClient?.id, amounts);
    setIsSaving(false);
  };

  const handleAnimationComplete = useCallback(() => {
    setShowSaveAnimation(false);
    handleReset();
  }, [handleReset]);

  const handleCreateAndAdd = async () => {
    if (!newProductName.trim()) return;
    setAddLoading(true);
    const newProduct = await onAddProduct(newProductName.trim(), newProductPercentage);
    setAddLoading(false);
    if (newProduct) {
      handleAddLine(newProduct.id);
      setNewProductName('');
      setNewProductPercentage(15);
      setShowAddDialog(false);
    }
  };

  const fullNcf = `${ncfPrefix}${ncfSuffix.padStart(4, '0')}`;
  const hasProducts = productLines.length > 0;
  const hasValidData = ncfSuffix.length === 4 && selectedClient && calculations.totalInvoice > 0;

  return (
    <div className="animate-fade-in">
      <SaveSuccessAnimation show={showSaveAnimation} onComplete={handleAnimationComplete} />
      
      <div className="max-w-4xl mx-auto">
        <Card className="overflow-hidden card-shadow">
          {/* Header */}
          <div className="gradient-primary px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary-foreground">Nueva Factura</h1>
                  <p className="text-primary-foreground/70 text-sm">
                    {activeSeller ? `Vendedor: ${activeSeller.name}` : 'Registro de ventas con comisiones'}
                  </p>
                </div>
              </div>
              <ProductCatalogDialog 
                products={products}
                onUpdateProduct={onUpdateProduct}
                onDeleteProduct={onDeleteProduct}
                onAddProduct={onAddProduct}
              />
            </div>
          </div>

          {/* Invoice Header Row */}
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !invoiceDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {invoiceDate ? format(invoiceDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={invoiceDate} onSelect={(date) => date && setInvoiceDate(date)} initialFocus locale={es} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* NCF */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">NCF</Label>
                <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden h-10">
                  <span className="px-2 text-sm font-mono text-muted-foreground bg-muted border-r border-border">{ncfPrefix}</span>
                  <Input 
                    value={ncfSuffix} 
                    onChange={handleNcfChange} 
                    placeholder="0000" 
                    className="border-0 text-sm font-mono font-bold text-center focus-visible:ring-0 h-full" 
                    maxLength={4} 
                    inputMode="numeric" 
                  />
                </div>
              </div>

              {/* Client */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</Label>
                <ClientSelector 
                  clients={clients} 
                  selectedClient={selectedClient} 
                  onSelectClient={setSelectedClient} 
                  onAddClient={onAddClient} 
                  onDeleteClient={onDeleteClient}
                />
              </div>
            </div>
          </div>

          {/* Product Lines Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-3">Producto</div>
              <div className="col-span-2 text-center">Cantidad</div>
              <div className="col-span-2 text-center">Precio</div>
              <div className="col-span-3 text-right">Total → Comisión</div>
              <div className="col-span-2 text-center flex items-center justify-center gap-1">
                <Gift className="h-3 w-3 text-amber-600" />
                <span>Oferta</span>
              </div>
            </div>
          </div>

          {/* Product Lines */}
          <div className="p-4 space-y-2 min-h-[200px]">
            {isLoading ? (
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
            ) : (
              <>
                {productLines.map((line) => {
                  const product = products.find(p => p.id === line.productId);
                  if (!product) return null;
                  return (
                    <InvoiceLineItemWithOffer
                      key={line.productId}
                      productName={product.name}
                      productColor={product.color}
                      percentage={product.percentage}
                      quantity={line.quantity}
                      unitPrice={line.unitPrice}
                      isOffer={line.isOffer}
                      onQuantityChange={(q) => handleQuantityChange(line.productId, q)}
                      onUnitPriceChange={(p) => handleUnitPriceChange(line.productId, p)}
                      onOfferChange={(o) => handleOfferChange(line.productId, o)}
                      onRemove={() => handleRemoveLine(line.productId)}
                    />
                  );
                })}

                {productLines.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl bg-muted/10">
                    <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No hay productos en esta factura</p>
                    <p className="text-xs text-muted-foreground mt-1">Usa el botón de abajo para agregar líneas</p>
                  </div>
                )}

                {/* Add Product Button / Search */}
                <div ref={searchRef} className="relative mt-4">
                  {showSearch ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar producto..."
                          className="pl-10 pr-10"
                          autoFocus
                        />
                        <button
                          onClick={() => { setShowSearch(false); setSearchTerm(''); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {searchTerm && (
                        <div className="border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto bg-popover">
                          {filteredCatalog.length > 0 ? (
                            filteredCatalog.map(product => (
                              <button
                                key={product.id}
                                onClick={() => handleAddLine(product.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                              >
                                <span 
                                  className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                                  style={{ backgroundColor: product.color }}
                                >
                                  {product.percentage}%
                                </span>
                                <span className="text-sm font-medium flex-1">{product.name}</span>
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                              No encontrado
                            </div>
                          )}
                          <button
                            onClick={() => { setNewProductName(searchTerm); setShowAddDialog(true); setShowSearch(false); }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-primary/10 border-t border-border transition-colors text-left"
                          >
                            <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center text-primary">
                              <Plus className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-semibold text-primary">Crear "{searchTerm}"</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-dashed h-12"
                      onClick={() => setShowSearch(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Producto
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Rest Section */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {restPercentage}%
                </span>
                <span className="text-muted-foreground">Comisión resto (si aplica)</span>
              </div>
              <EditRestPercentageDialog currentValue={restPercentage} onUpdate={onUpdateRestPercentage} />
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-border bg-muted/20 p-4 space-y-4">
            {/* OFFER COMPARISON BOX */}
            {calculations.totalOfferItems > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 space-y-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-amber-600" />
                  <span className="font-bold text-amber-800 dark:text-amber-200">Resumen de Ofertas</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Productos gratis:</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {calculations.totalOfferItems} unidades
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor regalado:</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      ${formatNumber(calculations.totalOfferValue)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* GROSS VS NET COMPARISON */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {/* Gross Total */}
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs uppercase text-muted-foreground font-semibold mb-1">Total Bruto</p>
                  <p className={cn(
                    "text-xl font-bold font-mono",
                    calculations.grossTotal !== calculations.netTotal 
                      ? "line-through text-muted-foreground" 
                      : "text-foreground"
                  )}>
                    ${formatNumber(calculations.grossTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Lo que se cobraría sin ofertas</p>
                </div>
                
                {/* Net Total */}
                <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs uppercase text-muted-foreground font-semibold mb-1">Total Neto</p>
                  <p className="text-xl font-bold font-mono text-primary">
                    ${formatNumber(calculations.netTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Base para calcular comisión</p>
                </div>
              </div>
              
              {/* Difference indicator */}
              {calculations.grossTotal !== calculations.netTotal && (
                <div className="text-center py-2 px-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Diferencia por ofertas: </span>
                    <span className="font-bold text-destructive">
                      -${formatNumber(calculations.grossTotal - calculations.netTotal)}
                    </span>
                  </p>
                </div>
              )}
            </div>
            
            {/* COMMISSION */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-700">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">MI COMISIÓN REAL</p>
                <p className="text-xs text-muted-foreground">Basada en total neto</p>
              </div>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ${formatCurrency(calculations.totalCommission)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border flex gap-3">
            <Button 
              className="flex-1 h-12 text-base gradient-primary" 
              disabled={!hasValidData}
              onClick={() => setShowPreviewDialog(true)}
            >
              <FileText className="h-5 w-5 mr-2" />
              Guardar Factura
            </Button>
            <Button variant="outline" onClick={handleReset} className="h-12 px-6">
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </Card>

        {/* Breakdown Table (if has products) */}
        {hasProducts && calculations.totalInvoice > 0 && (
          <div className="mt-6 animate-in slide-in-from-bottom-4">
            <BreakdownTable 
              totalInvoice={calculations.totalInvoice} 
              breakdown={calculations.breakdown} 
              restAmount={calculations.restAmount} 
              restPercentage={restPercentage} 
              restCommission={calculations.restCommission} 
              totalCommission={calculations.totalCommission} 
            />
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <InvoicePreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        onConfirm={handleConfirmSave}
        loading={isSaving}
        data={{
          ncf: fullNcf,
          invoiceDate: invoiceDate,
          clientName: selectedClient?.name || null,
          totalAmount: calculations.totalInvoice,
          breakdown: calculations.breakdown,
          restAmount: calculations.restAmount,
          restPercentage: restPercentage,
          restCommission: calculations.restCommission,
          totalCommission: calculations.totalCommission,
        }}
      />

      {/* Create Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre del Producto</Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Ej: Vitamina C"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Porcentaje de Comisión (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={newProductPercentage}
                onChange={(e) => setNewProductPercentage(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateAndAdd} 
                disabled={addLoading || !newProductName.trim()}
                className="gradient-primary"
              >
                {addLoading ? 'Guardando...' : 'Guardar y Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
