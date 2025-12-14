import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Package, FileDown, Loader2, Pencil, User } from 'lucide-react';
import { generateBreakdownPdf } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { EditInvoiceDialog } from '@/components/EditInvoiceDialog';
import { EditGlobalPercentageDialog } from '@/components/EditGlobalPercentageDialog';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyBreakdownProps {
  invoices: Invoice[];
  clients?: Client[];
  onUpdateInvoice?: (
    id: string,
    ncf: string,
    invoiceDate: string,
    totalAmount: number,
    restAmount: number,
    restPercentage: number,
    restCommission: number,
    totalCommission: number,
    products: { name: string; amount: number; percentage: number; commission: number }[]
  ) => Promise<any>;
  onDeleteInvoice?: (id: string) => Promise<boolean>;
  onRefreshInvoices?: () => void;
  sellerName?: string;
}

interface ProductEntry {
  ncf: string;
  date: string;
  amount: number;
  clientId?: string | null;
  clientName?: string;
}

interface ProductBreakdown {
  name: string;
  percentage: number;
  entries: ProductEntry[];
  totalAmount: number;
  totalCommission: number;
}

// Helper function to parse dates correctly without timezone issues
const parseInvoiceDate = (dateString: string): Date => {
  // If it's a date-only string (YYYY-MM-DD), parse as UTC to avoid timezone shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Otherwise parse normally
  return new Date(dateString);
};

// Helper to get month key from date
const getMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const MonthlyBreakdown = ({ invoices, clients, onUpdateInvoice, onDeleteInvoice, onRefreshInvoices, sellerName }: MonthlyBreakdownProps) => {
  // Initialize with current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return getMonthKey(now);
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const getClientName = (clientId?: string | null) => {
    if (!clientId || !clients) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  // Generate available months - always show last 4 months plus any with invoices
  const months = useMemo(() => {
    const uniqueMonths = new Set<string>();
    
    // Always add the last 4 months (current month included)
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      uniqueMonths.add(getMonthKey(date));
    }
    
    // Add months from invoices
    invoices.forEach(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      uniqueMonths.add(getMonthKey(date));
    });
    
    return Array.from(uniqueMonths).sort().reverse();
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(new Date(year, month - 1, 1));
    
    return invoices.filter(inv => {
      const invDate = parseInvoiceDate(inv.invoice_date || inv.created_at);
      return isWithinInterval(invDate, { start, end });
    });
  }, [invoices, selectedMonth]);

  const productsBreakdown = useMemo(() => {
    const products: Record<string, ProductBreakdown> = {};
    
    filteredInvoices.forEach(invoice => {
      const clientName = getClientName((invoice as any).client_id);
      
      invoice.products?.forEach(product => {
        if (product.amount <= 0) return;
        
        const key = product.product_name;
        if (!products[key]) {
          products[key] = {
            name: product.product_name,
            percentage: product.percentage,
            entries: [],
            totalAmount: 0,
            totalCommission: 0,
          };
        }
        
        products[key].entries.push({
          ncf: invoice.ncf,
          date: invoice.invoice_date || invoice.created_at,
          amount: Number(product.amount),
          clientId: (invoice as any).client_id,
          clientName,
        });
        products[key].totalAmount += Number(product.amount);
        products[key].totalCommission += Number(product.commission);
      });
    });
    
    return Object.values(products).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredInvoices, clients]);

  // Resto de productos (25%)
  const restBreakdown = useMemo(() => {
    const entries: ProductEntry[] = [];
    let totalAmount = 0;
    let totalCommission = 0;
    
    filteredInvoices.forEach(inv => {
      if (inv.rest_amount > 0) {
        const clientName = getClientName((inv as any).client_id);
        entries.push({
          ncf: inv.ncf,
          date: inv.invoice_date || inv.created_at,
          amount: Number(inv.rest_amount),
          clientId: (inv as any).client_id,
          clientName,
        });
        totalAmount += Number(inv.rest_amount);
        totalCommission += Number(inv.rest_commission);
      }
    });
    
    return { entries, totalAmount, totalCommission };
  }, [filteredInvoices, clients]);

  // Function to update global percentage
  const handleUpdateGlobalPercentage = async (productName: string, newPercentage: number): Promise<boolean> => {
    try {
      // Get all invoice_products for this product in the filtered invoices
      const invoiceIds = filteredInvoices.map(i => i.id);
      
      // Update percentage and recalculate commission for each affected invoice_product
      for (const invoice of filteredInvoices) {
        const productToUpdate = invoice.products?.find(p => p.product_name === productName);
        if (!productToUpdate) continue;
        
        const newCommission = (productToUpdate.amount * newPercentage) / 100;
        
        await supabase
          .from('invoice_products')
          .update({ 
            percentage: newPercentage,
            commission: newCommission 
          })
          .eq('invoice_id', invoice.id)
          .eq('product_name', productName);
        
        // Recalculate and update total commission for the invoice
        const otherProducts = invoice.products?.filter(p => p.product_name !== productName) || [];
        const otherCommissions = otherProducts.reduce((sum, p) => sum + Number(p.commission), 0);
        const newTotalCommission = otherCommissions + newCommission + Number(invoice.rest_commission);
        
        await supabase
          .from('invoices')
          .update({ total_commission: newTotalCommission })
          .eq('id', invoice.id);
      }
      
      toast.success(`Porcentaje de ${productName} actualizado a ${newPercentage}% en ${filteredInvoices.length} facturas`);
      onRefreshInvoices?.();
      return true;
    } catch (error) {
      console.error('Error updating global percentage:', error);
      toast.error('Error al actualizar el porcentaje');
      return false;
    }
  };

  const grandTotalCommission = useMemo(() => {
    return productsBreakdown.reduce((sum, p) => sum + p.totalCommission, 0) + restBreakdown.totalCommission;
  }, [productsBreakdown, restBreakdown]);

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  
  // Check if selected month is current month
  const isCurrentMonth = selectedMonth === getMonthKey(new Date());

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateBreakdownPdf({
        month: capitalizedMonth,
        products: productsBreakdown,
        rest: restBreakdown,
        grandTotal: grandTotalCommission,
        sellerName,
      }, selectedMonth);
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (invoices.length === 0) {
    return (
      <Card className="p-12 text-center bg-card border-border">
        <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center animate-pulse-soft">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Sin datos</h3>
        <p className="text-sm text-muted-foreground">
          Guarda facturas para ver el desglose mensual
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-foreground">Desglose Mensual</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              isCurrentMonth 
                ? 'bg-primary/10 text-primary animate-pulse-soft' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {capitalizedMonth}
              {isCurrentMonth && <span className="ml-1.5 text-xs">(Actual)</span>}
            </span>
          </div>
          <p className="text-muted-foreground">
            Resumen detallado por producto
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-56 bg-card border-border hover:bg-muted/50 transition-colors">
              <Calendar className="h-4 w-4 mr-2 text-primary" />
              <SelectValue placeholder="Seleccionar mes" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => {
                const [y, mo] = m.split('-').map(Number);
                const label = format(new Date(y, mo - 1, 1), 'MMMM yyyy', { locale: es });
                const isCurrent = m === getMonthKey(new Date());
                return (
                  <SelectItem key={m} value={m}>
                    <span className="flex items-center gap-2">
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                          Actual
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          {filteredInvoices.length > 0 && (
            <Button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              className="gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground"
            >
              {isGeneratingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border">
          <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Sin facturas este mes</h3>
          <p className="text-sm text-muted-foreground">
            No hay facturas registradas para {capitalizedMonth}
          </p>
        </Card>
      ) : (
        <>
          {/* Product Cards Grid - Layout horizontal en desktop */}
          <div className="space-y-4">
            {productsBreakdown.map((product, index) => (
              <Card 
                key={product.name} 
                className="overflow-hidden bg-card border border-border/60 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Product Header */}
                <div className="px-5 py-4 bg-muted/30 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg text-foreground">{product.name}</h3>
                      <EditGlobalPercentageDialog
                        productName={product.name}
                        currentPercentage={product.percentage}
                        invoiceCount={product.entries.length}
                        month={capitalizedMonth}
                        onUpdate={(newPercentage) => handleUpdateGlobalPercentage(product.name, newPercentage)}
                      />
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                      {product.percentage}%
                    </span>
                  </div>
                </div>
                
                <div className="p-5">
                  {/* Entries Table */}
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {product.entries.map((entry, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between text-sm py-2.5 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          {entry.clientName && (
                            <span className="text-foreground font-medium text-sm flex items-center gap-1">
                              <User className="h-3 w-3 text-primary" />
                              {entry.clientName}
                            </span>
                          )}
                          <span className="text-muted-foreground font-mono text-xs">
                            {entry.ncf}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">
                            {format(parseInvoiceDate(entry.date), 'd MMM', { locale: es })}
                          </span>
                          <span className="font-semibold text-foreground">
                            ${formatNumber(entry.amount)}
                          </span>
                          {onUpdateInvoice && onDeleteInvoice && (
                            <EditInvoiceDialog
                              invoice={filteredInvoices.find(inv => inv.ncf === entry.ncf)!}
                              onUpdate={onUpdateInvoice}
                              onDelete={onDeleteInvoice}
                              trigger={
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Línea divisoria */}
                  <div className="border-t-2 border-dashed border-border my-4" />
                  
                  {/* Summary Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Subtotal</span>
                        <p className="font-bold text-lg text-foreground">${formatNumber(product.totalAmount)}</p>
                      </div>
                    </div>
                    
                    {/* Comisión */}
                    <div className="px-5 py-3 rounded-xl bg-success/10 border border-success/20">
                      <span className="text-xs text-success font-medium">Comisión ({product.percentage}%)</span>
                      <p className="font-bold text-2xl text-success">${formatCurrency(product.totalCommission)}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            
            {/* Resto de Productos Card */}
            {restBreakdown.totalAmount > 0 && (
              <Card 
                className="overflow-hidden bg-card border border-border/60 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${productsBreakdown.length * 80}ms` }}
              >
                {/* Header */}
                <div className="px-5 py-4 bg-muted/50 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg text-foreground">Resto de Productos</h3>
                    <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm font-bold">
                      25%
                    </span>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {restBreakdown.entries.map((entry, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between text-sm py-2.5 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          {entry.clientName && (
                            <span className="text-foreground font-medium text-sm flex items-center gap-1">
                              <User className="h-3 w-3 text-primary" />
                              {entry.clientName}
                            </span>
                          )}
                          <span className="text-muted-foreground font-mono text-xs">
                            {entry.ncf}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">
                            {format(parseInvoiceDate(entry.date), 'd MMM', { locale: es })}
                          </span>
                          <span className="font-semibold text-foreground">
                            ${formatNumber(entry.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Línea divisoria */}
                  <div className="border-t-2 border-dashed border-border my-4" />
                  
                  {/* Summary Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Subtotal</span>
                      <p className="font-bold text-lg text-foreground">${formatNumber(restBreakdown.totalAmount)}</p>
                    </div>
                    
                    <div className="px-5 py-3 rounded-xl bg-success/10 border border-success/20">
                      <span className="text-xs text-success font-medium">Comisión (25%)</span>
                      <p className="font-bold text-2xl text-success">${formatCurrency(restBreakdown.totalCommission)}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Gran Total */}
          <Card className="overflow-hidden bg-card border border-border shadow-md">
            <div className="p-6 md:p-8">
              {/* Suma horizontal de todas las comisiones */}
              <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
                {productsBreakdown.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="px-5 py-3 rounded-xl bg-muted/50 border border-border/50">
                      <p className="text-xs text-muted-foreground font-medium mb-1">{product.name}</p>
                      <p className="font-bold text-lg text-foreground">${formatCurrency(product.totalCommission)}</p>
                    </div>
                    {(index < productsBreakdown.length - 1 || restBreakdown.totalAmount > 0) && (
                      <span className="text-3xl font-light text-muted-foreground">+</span>
                    )}
                  </div>
                ))}
                {restBreakdown.totalAmount > 0 && (
                  <div className="px-5 py-3 rounded-xl bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Resto (25%)</p>
                    <p className="font-bold text-lg text-foreground">${formatCurrency(restBreakdown.totalCommission)}</p>
                  </div>
                )}
              </div>
              
              {/* Línea de suma */}
              <div className="relative max-w-2xl mx-auto mb-8">
                <div className="border-t-2 border-border" />
                <div className="absolute left-1/2 -translate-x-1/2 -top-3 bg-card px-4">
                  <span className="text-muted-foreground font-bold text-lg">=</span>
                </div>
              </div>
              
              {/* Total Final - SIN ICONOS */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wide">
                  Comisión Total — {capitalizedMonth}
                </p>
                <p className="text-5xl md:text-6xl font-bold text-success">
                  ${formatCurrency(grandTotalCommission)}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
