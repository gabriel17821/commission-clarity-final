import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, CalendarIcon, Save, Trash2, Plus, X, User, UserPlus } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Invoice } from '@/hooks/useInvoices';
import { Product, useProducts } from '@/hooks/useProducts';
import { Client } from '@/hooks/useClients';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditInvoiceDialogProps {
  invoice: Invoice;
  clients?: Client[];
  onUpdate: (
    id: string,
    ncf: string,
    invoiceDate: string,
    totalAmount: number,
    restAmount: number,
    restPercentage: number,
    restCommission: number,
    totalCommission: number,
    products: { name: string; amount: number; percentage: number; commission: number }[],
    clientId?: string | null
  ) => Promise<any>;
  onDelete: (id: string) => Promise<boolean>;
  trigger?: React.ReactNode;
}

const parseInvoiceDate = (dateString: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
};

export const EditInvoiceDialog = ({ invoice, clients, onUpdate, onDelete, trigger }: EditInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  const [ncfSuffix, setNcfSuffix] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [totalAmount, setTotalAmount] = useState(0);
  const [products, setProducts] = useState<{ name: string; amount: number; percentage: number; commission: number }[]>([]);
  const [restPercentage, setRestPercentage] = useState(25);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // For adding new products
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPercentage, setNewProductPercentage] = useState(15);
  const [newProductAmount, setNewProductAmount] = useState(0);
  
  // Get catalog products
  const { products: catalogProducts } = useProducts();

  const ncfPrefix = 'B010000';

  useEffect(() => {
    if (open) {
      // Extract last 4 digits from NCF
      const suffix = invoice.ncf.slice(-4);
      setNcfSuffix(suffix);
      setInvoiceDate(parseInvoiceDate(invoice.invoice_date || invoice.created_at));
      setTotalAmount(invoice.total_amount);
      setRestPercentage(invoice.rest_percentage || 25);
      setSelectedClientId((invoice as any).client_id || null);
      
      // Load products
      const prods = invoice.products?.map(p => ({
        name: p.product_name,
        amount: p.amount,
        percentage: p.percentage,
        commission: p.commission,
      })) || [];
      setProducts(prods);
      setDeleteConfirm(false);
      setShowAddProduct(false);
    }
  }, [open, invoice]);

  const handleProductAmountChange = (index: number, value: string) => {
    const numValue = parseInt(value.replace(/,/g, ''), 10) || 0;
    const newProducts = [...products];
    newProducts[index].amount = numValue;
    newProducts[index].commission = numValue * (newProducts[index].percentage / 100);
    setProducts(newProducts);
  };

  const handleProductPercentageChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newProducts = [...products];
    newProducts[index].percentage = numValue;
    newProducts[index].commission = newProducts[index].amount * (numValue / 100);
    setProducts(newProducts);
  };

  const handleRemoveProduct = (index: number) => {
    const newProducts = [...products];
    newProducts.splice(index, 1);
    setProducts(newProducts);
  };

  const handleAddNewProduct = () => {
    if (!newProductName.trim()) return;
    
    const newProduct = {
      name: newProductName.trim(),
      amount: newProductAmount,
      percentage: newProductPercentage,
      commission: newProductAmount * (newProductPercentage / 100),
    };
    
    setProducts([...products, newProduct]);
    setNewProductName('');
    setNewProductPercentage(15);
    setNewProductAmount(0);
    setShowAddProduct(false);
  };

  const handleAddFromCatalog = (catalogProduct: Product) => {
    const existingIndex = products.findIndex(p => p.name === catalogProduct.name);
    if (existingIndex >= 0) {
      // Product already exists, focus on it
      return;
    }
    
    const newProduct = {
      name: catalogProduct.name,
      amount: 0,
      percentage: catalogProduct.percentage,
      commission: 0,
    };
    
    setProducts([...products, newProduct]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ncfSuffix.length !== 4) return;
    
    setLoading(true);
    
    const fullNcf = `${ncfPrefix}${ncfSuffix.padStart(4, '0')}`;
    const productsTotal = products.reduce((sum, p) => sum + p.amount, 0);
    const productsCommission = products.reduce((sum, p) => sum + p.commission, 0);
    const restAmount = Math.max(0, totalAmount - productsTotal);
    const restCommission = restAmount * (restPercentage / 100);
    const totalCommission = productsCommission + restCommission;
    
    const result = await onUpdate(
      invoice.id,
      fullNcf,
      format(invoiceDate, 'yyyy-MM-dd'),
      totalAmount,
      restAmount,
      restPercentage,
      restCommission,
      totalCommission,
      products,
      selectedClientId
    );
    
    setLoading(false);
    if (result) {
      setOpen(false);
    }
  };

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    
    setLoading(true);
    const result = await onDelete(invoice.id);
    setLoading(false);
    if (result) {
      setOpen(false);
    }
  };

  // Calculate current totals
  const productsTotal = products.reduce((sum, p) => sum + p.amount, 0);
  const restAmount = Math.max(0, totalAmount - productsTotal);
  const productsCommission = products.reduce((sum, p) => sum + p.commission, 0);
  const restCommission = restAmount * (restPercentage / 100);
  const calculatedTotalCommission = productsCommission + restCommission;

  // Products not yet in invoice
  const availableCatalogProducts = catalogProducts.filter(
    cp => !products.some(p => p.name === cp.name)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Editar Factura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client Selector */}
          <div className="space-y-2">
            <Label className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Cliente
            </Label>
            {clients && clients.length > 0 ? (
              <Select 
                value={selectedClientId || 'none'} 
                onValueChange={(value) => setSelectedClientId(value === 'none' ? null : value)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Seleccionar cliente (opcional)">
                    {selectedClient ? (
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        {selectedClient.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sin cliente asignado</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sin cliente</span>
                  </SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        {client.name}
                        {client.phone && (
                          <span className="text-xs text-muted-foreground">({client.phone})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-border text-sm text-muted-foreground text-center">
                No hay clientes disponibles
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="text-base">Fecha de la Factura</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-12",
                    !invoiceDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {invoiceDate ? format(invoiceDate, "d 'de' MMMM, yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={invoiceDate}
                  onSelect={(date) => date && setInvoiceDate(date)}
                  initialFocus
                  locale={es}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* NCF Input */}
          <div className="space-y-2">
            <Label htmlFor="ncf" className="text-base">NCF (últimos 4 dígitos)</Label>
            <div className="flex items-center rounded-lg border border-border bg-muted/30 overflow-hidden">
              <span className="px-3 py-3 text-lg font-mono font-medium text-muted-foreground bg-muted border-r border-border">
                {ncfPrefix}
              </span>
              <Input
                id="ncf"
                value={ncfSuffix}
                onChange={(e) => setNcfSuffix(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="0000"
                className="border-0 text-lg font-mono font-bold text-center focus-visible:ring-0"
                maxLength={4}
                inputMode="numeric"
                required
              />
            </div>
          </div>

          {/* Total Amount */}
          <div className="space-y-2">
            <Label className="text-base">Total Factura</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                $
              </span>
              <Input
                type="text"
                inputMode="numeric"
                value={totalAmount > 0 ? formatNumber(totalAmount) : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  setTotalAmount(parseInt(raw, 10) || 0);
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                className="h-14 pl-9 text-2xl font-bold"
                placeholder="0"
              />
            </div>
          </div>

          {/* Products */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Productos con Comisión Variable</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            
            {/* Add Product Form */}
            {showAddProduct && (
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-3 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Nombre del producto</Label>
                    <Input
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="Ej: Vitamina D"
                      className="h-9"
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Porcentaje (%)</Label>
                    <Input
                      type="number"
                      value={newProductPercentage}
                      onChange={(e) => setNewProductPercentage(Number(e.target.value))}
                      className="h-9"
                      min={0}
                      max={100}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Monto ($)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={newProductAmount > 0 ? formatNumber(newProductAmount) : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, '');
                        setNewProductAmount(parseInt(raw, 10) || 0);
                      }}
                      className="h-9"
                      placeholder="0"
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </div>
                </div>
                
                {/* Quick add from catalog */}
                {availableCatalogProducts.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <Label className="text-xs text-muted-foreground mb-2 block">O agregar del catálogo:</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCatalogProducts.slice(0, 5).map(cp => (
                        <Button
                          key={cp.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddFromCatalog(cp)}
                          className="h-7 text-xs gap-1"
                        >
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: cp.color, color: 'white' }}>
                            {cp.percentage}%
                          </span>
                          {cp.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddProduct(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddNewProduct}
                    disabled={!newProductName.trim()}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar Producto
                  </Button>
                </div>
              </div>
            )}
            
            {/* Product List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {products.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 group">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Input
                      type="number"
                      value={product.percentage}
                      onChange={(e) => handleProductPercentageChange(index, e.target.value)}
                      className="w-16 h-8 text-center text-sm font-bold"
                      min={0}
                      max={100}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                    <span className="text-sm font-medium truncate">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={product.amount > 0 ? formatNumber(product.amount) : ''}
                        onChange={(e) => handleProductAmountChange(index, e.target.value)}
                        className="h-9 pl-5 text-sm text-right font-medium"
                        placeholder="0"
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveProduct(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rest Percentage */}
          <div className="space-y-2">
            <Label className="text-base">Porcentaje del Resto (%)</Label>
            <Input
              type="number"
              value={restPercentage}
              onChange={(e) => setRestPercentage(Number(e.target.value))}
              className="h-10"
              min={0}
              max={100}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
          </div>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted/40 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Productos:</span>
              <span className="font-medium">${formatNumber(productsTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Resto ({restPercentage}%):</span>
              <span className="font-medium">${formatNumber(restAmount)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-muted-foreground">Comisión Productos:</span>
              <span className="font-medium text-success">${formatNumber(productsCommission)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Comisión Resto:</span>
              <span className="font-medium text-success">${formatNumber(restCommission)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-2">
              <span>Total Comisión:</span>
              <span className="text-success">${formatNumber(calculatedTotalCommission)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant={deleteConfirm ? "destructive" : "outline"}
              onClick={handleDelete}
              disabled={loading}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleteConfirm ? 'Confirmar' : 'Eliminar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || ncfSuffix.length !== 4}
              className="flex-1 gap-2 gradient-primary"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};