import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, DollarSign, Receipt, Calendar, ChevronLeft, ChevronRight, FileText, ArrowUpRight, ArrowDownRight, Minus, ChevronDown } from 'lucide-react';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { generateMonthlyPDF } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AdvancedStatistics } from '@/components/AdvancedStatistics';

interface StatisticsProps {
  invoices: Invoice[];
  sellerName?: string;
  clients?: Client[];
}

// Helper function to parse dates correctly without timezone issues
const parseInvoiceDate = (dateString: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
};

export const Statistics = ({ invoices, sellerName, clients }: StatisticsProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const displayName = sellerName || 'Vendedor';

  // Get available months from invoices
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    invoices.forEach(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      months.add(format(date, 'yyyy-MM'));
    });
    
    // Add last 6 months even if empty
    for (let i = 0; i < 6; i++) {
      const date = subMonths(new Date(), i);
      months.add(format(date, 'yyyy-MM'));
    }
    
    return Array.from(months).sort().reverse();
  }, [invoices]);

  // Stats for selected month
  const selectedMonthStats = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    
    const monthInvoices = invoices.filter(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      return isWithinInterval(date, { start, end });
    });

    return {
      totalSales: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
      totalCommission: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0),
      invoiceCount: monthInvoices.length,
      invoices: monthInvoices,
      avgPerInvoice: monthInvoices.length > 0 
        ? monthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0) / monthInvoices.length
        : 0,
    };
  }, [invoices, selectedDate]);

  // Previous month stats for comparison
  const previousMonthStats = useMemo(() => {
    const prevDate = subMonths(selectedDate, 1);
    const start = startOfMonth(prevDate);
    const end = endOfMonth(prevDate);
    
    const monthInvoices = invoices.filter(inv => {
      const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
      return isWithinInterval(date, { start, end });
    });

    return {
      totalSales: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
      totalCommission: monthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0),
      invoiceCount: monthInvoices.length,
    };
  }, [invoices, selectedDate]);

  const salesChange = previousMonthStats.totalSales > 0 
    ? ((selectedMonthStats.totalSales - previousMonthStats.totalSales) / previousMonthStats.totalSales) * 100 
    : 0;
  
  const commissionChange = previousMonthStats.totalCommission > 0 
    ? ((selectedMonthStats.totalCommission - previousMonthStats.totalCommission) / previousMonthStats.totalCommission) * 100 
    : 0;

  const invoiceCountChange = previousMonthStats.invoiceCount > 0
    ? ((selectedMonthStats.invoiceCount - previousMonthStats.invoiceCount) / previousMonthStats.invoiceCount) * 100
    : 0;

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const monthLabel = format(selectedDate, "MMMM yyyy", { locale: es });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const prevMonthLabel = format(subMonths(selectedDate, 1), "MMMM", { locale: es });

  const getChangeIndicator = (change: number) => {
    const isPositive = change > 0;
    const isNeutral = change === 0;
    
    if (isNeutral) {
      return {
        icon: Minus,
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        label: 'Sin cambio'
      };
    }
    
    return {
      icon: isPositive ? ArrowUpRight : ArrowDownRight,
      color: isPositive ? 'text-success' : 'text-destructive',
      bg: isPositive ? 'bg-success/10' : 'bg-destructive/10',
      label: isPositive ? 'Incremento' : 'Decremento'
    };
  };

  if (showAdvanced) {
    return <AdvancedStatistics invoices={invoices} onBack={() => setShowAdvanced(false)} />;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Month Navigation */}
        <Card className="p-4 hover-lift">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('prev')}
              className="h-10 w-10 hover:bg-primary/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">{capitalizedMonth}</span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('next')}
              disabled={isSameMonth(selectedDate, new Date())}
              className="h-10 w-10 hover:bg-primary/10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        {/* Month Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {availableMonths.slice(0, 6).map((month, index) => {
            const monthDate = new Date(month + '-01');
            const isSelected = isSameMonth(monthDate, selectedDate);
            const label = format(monthDate, "MMM", { locale: es });
            
            return (
              <button
                key={month}
                onClick={() => setSelectedDate(monthDate)}
                className={`month-pill whitespace-nowrap hover-lift ${isSelected ? 'active' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sales Card */}
          <Card className="p-5 space-y-3 stat-card hover-lift hover-glow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">Ventas Totales</span>
              </div>
            </div>
            <p className="text-3xl font-bold animate-count-up">${formatNumber(selectedMonthStats.totalSales)}</p>
            {previousMonthStats.totalSales > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-help ${getChangeIndicator(salesChange).bg} ${getChangeIndicator(salesChange).color}`}>
                    {(() => {
                      const Icon = getChangeIndicator(salesChange).icon;
                      return <Icon className="h-3 w-3" />;
                    })()}
                    {salesChange > 0 ? '+' : ''}{salesChange.toFixed(1)}%
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    {salesChange > 0 ? 'Aumentó' : salesChange < 0 ? 'Disminuyó' : 'Sin cambio'} vs {prevMonthLabel}
                    <br />
                    <span className="text-muted-foreground">
                      Mes anterior: ${formatNumber(previousMonthStats.totalSales)}
                    </span>
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </Card>

          {/* Commission Card */}
          <Card className="p-5 space-y-3 stat-card hover-lift hover-glow border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">Comisiones</span>
              </div>
              {selectedMonthStats.invoiceCount > 0 && (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="badge-neutral cursor-help">
                      ~${formatNumber(Math.round(selectedMonthStats.avgPerInvoice))}/fact
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Promedio por factura</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-3xl font-bold text-primary animate-count-up">${formatCurrency(selectedMonthStats.totalCommission)}</p>
            {previousMonthStats.totalCommission > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-help ${getChangeIndicator(commissionChange).bg} ${getChangeIndicator(commissionChange).color}`}>
                    {(() => {
                      const Icon = getChangeIndicator(commissionChange).icon;
                      return <Icon className="h-3 w-3" />;
                    })()}
                    {commissionChange > 0 ? '+' : ''}{commissionChange.toFixed(1)}%
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    {commissionChange > 0 ? 'Ganaste más' : commissionChange < 0 ? 'Ganaste menos' : 'Igual'} que en {prevMonthLabel}
                    <br />
                    <span className="text-muted-foreground">
                      Diferencia: {commissionChange > 0 ? '+' : ''}${formatNumber(Math.round(selectedMonthStats.totalCommission - previousMonthStats.totalCommission))}
                    </span>
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </Card>

          {/* Invoice Count Card */}
          <Card className="p-5 space-y-3 stat-card hover-lift hover-glow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-accent-foreground" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">Facturas</span>
              </div>
            </div>
            <p className="text-3xl font-bold animate-count-up">{selectedMonthStats.invoiceCount}</p>
            {previousMonthStats.invoiceCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-help ${getChangeIndicator(invoiceCountChange).bg} ${getChangeIndicator(invoiceCountChange).color}`}>
                    {(() => {
                      const Icon = getChangeIndicator(invoiceCountChange).icon;
                      return <Icon className="h-3 w-3" />;
                    })()}
                    {invoiceCountChange > 0 ? '+' : ''}{invoiceCountChange.toFixed(0)}%
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    {invoiceCountChange > 0 ? 'Más' : invoiceCountChange < 0 ? 'Menos' : 'Igual'} facturas que en {prevMonthLabel}
                    <br />
                    <span className="text-muted-foreground">
                      Mes anterior: {previousMonthStats.invoiceCount} facturas
                    </span>
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </Card>
        </div>

        {/* Advanced Stats Button */}
        <Button 
          variant="outline" 
          className="w-full gap-2 hover-lift"
          onClick={() => setShowAdvanced(true)}
        >
          <BarChart3 className="h-4 w-4" />
          Ver Análisis Detallado
          <ChevronDown className="h-4 w-4 ml-auto" />
        </Button>

        {/* PDF generation button */}
        {selectedMonthStats.invoiceCount > 0 && (
          <Button
            variant="outline" 
            className="w-full gap-2 hover-lift"
            onClick={() => {
              generateMonthlyPDF(selectedMonthStats.invoices, capitalizedMonth);
              toast.success('PDF generado correctamente');
            }}
          >
            <FileText className="h-4 w-4" />
            Generar Reporte PDF ({selectedMonthStats.invoiceCount} facturas)
          </Button>
        )}

        {/* Monthly Progress */}
        <Card className="p-5 hover-lift">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumen de los últimos meses
          </h3>
          
          <div className="space-y-3">
            {availableMonths.slice(0, 6).map((month, index) => {
              const [y, m] = month.split('-').map(Number);
              const monthDate = new Date(y, m - 1, 1);
              const start = startOfMonth(monthDate);
              const end = endOfMonth(monthDate);
              const isSelected = isSameMonth(monthDate, selectedDate);
              
              const monthInvoices = invoices.filter(inv => {
                const date = parseInvoiceDate(inv.invoice_date || inv.created_at);
                return isWithinInterval(date, { start, end });
              });
              
              const totalSales = monthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
              const totalCommission = monthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0);
              const maxSales = Math.max(...availableMonths.slice(0, 6).map(mo => {
                const [yr, mon] = mo.split('-').map(Number);
                const d = new Date(yr, mon - 1, 1);
                const s = startOfMonth(d);
                const e = endOfMonth(d);
                return invoices
                  .filter(inv => {
                    const dt = parseInvoiceDate(inv.invoice_date || inv.created_at);
                    return isWithinInterval(dt, { start: s, end: e });
                  })
                  .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
              }), 1);
              const barWidth = (totalSales / maxSales) * 100;
              const label = format(monthDate, "MMM", { locale: es });
              
              return (
                <button
                  key={month}
                  onClick={() => setSelectedDate(monthDate)}
                  className={`w-full text-left p-3 rounded-xl transition-all hover-lift ${
                    isSelected 
                      ? 'bg-primary/5 ring-1 ring-primary/30' 
                      : 'hover:bg-muted/50'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{monthInvoices.length} fact.</span>
                      <span className="font-semibold text-success">${formatCurrency(totalCommission)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden progress-bar">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isSelected ? 'gradient-primary' : 'bg-muted-foreground/30'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
};
