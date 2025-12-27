import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, DollarSign, TrendingUp, TrendingDown, Minus, 
  Target, ShoppingBag, ChevronRight, Package, FileText,
  ArrowUpRight, ArrowDownRight, Zap, BarChart3, Eye
} from 'lucide-react';
import { parseISO, isWithinInterval, differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { formatNumber } from '@/lib/formatters';

interface VentoViewProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  dateRange: { from: Date; to: Date };
  onNavigate?: (tab: string, data?: any) => void;
}

type DetailView = 'none' | 'clients' | 'products' | 'invoices';

export function VentoView({ invoices, clients, products, dateRange, onNavigate }: VentoViewProps) {
  const [detailView, setDetailView] = useState<DetailView>('none');

  const analytics = useMemo(() => {
    // Filter invoices by date range
    const filteredInvoices = invoices.filter(inv => {
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });

    // Previous period for comparison
    const periodDays = differenceInDays(dateRange.to, dateRange.from);
    const previousStart = new Date(dateRange.from);
    previousStart.setDate(previousStart.getDate() - periodDays - 1);
    const previousEnd = new Date(dateRange.from);
    previousEnd.setDate(previousEnd.getDate() - 1);

    const previousInvoices = invoices.filter(inv => {
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: previousStart, end: previousEnd });
    });

    // Client metrics
    const activeClientIds = new Set(filteredInvoices.map(inv => inv.client_id).filter(Boolean));
    const activeClients = activeClientIds.size;
    const previousActiveClients = new Set(previousInvoices.map(inv => inv.client_id).filter(Boolean)).size;
    const clientGrowth = previousActiveClients > 0 
      ? ((activeClients - previousActiveClients) / previousActiveClients) * 100 
      : activeClients > 0 ? 100 : 0;

    // Sales metrics
    const totalSalesClosed = filteredInvoices.length;
    const prevSalesClosed = previousInvoices.length;
    const salesGrowth = prevSalesClosed > 0 
      ? ((totalSalesClosed - prevSalesClosed) / prevSalesClosed) * 100 
      : totalSalesClosed > 0 ? 100 : 0;

    // Revenue metrics
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const previousRevenue = previousInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const revenueGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : totalRevenue > 0 ? 100 : 0;

    // Commission
    const totalCommission = filteredInvoices.reduce((sum, inv) => sum + inv.total_commission, 0);

    // Product analysis
    const productSales = new Map<string, { quantity: number; amount: number; prevQuantity: number; prevAmount: number }>();
    
    filteredInvoices.forEach(inv => {
      inv.products?.forEach(prod => {
        const existing = productSales.get(prod.product_name) || { quantity: 0, amount: 0, prevQuantity: 0, prevAmount: 0 };
        existing.quantity += (prod.quantity_sold || 1);
        existing.amount += prod.amount;
        productSales.set(prod.product_name, existing);
      });
    });

    previousInvoices.forEach(inv => {
      inv.products?.forEach(prod => {
        const existing = productSales.get(prod.product_name) || { quantity: 0, amount: 0, prevQuantity: 0, prevAmount: 0 };
        existing.prevQuantity += (prod.quantity_sold || 1);
        existing.prevAmount += prod.amount;
        productSales.set(prod.product_name, existing);
      });
    });

    const sortedProducts = Array.from(productSales.entries())
      .map(([name, data]) => {
        const trend = data.prevAmount > 0 
          ? ((data.amount - data.prevAmount) / data.prevAmount) * 100 
          : data.amount > 0 ? 100 : 0;
        return { name, ...data, trend };
      })
      .sort((a, b) => b.amount - a.amount);

    const topProducts = sortedProducts.slice(0, 5);
    const growingProducts = sortedProducts.filter(p => p.trend > 10);
    const decliningProducts = sortedProducts.filter(p => p.trend < -10);

    // Client breakdown with sales
    const clientSalesMap = new Map<string, { sales: number; invoices: number; lastDate: Date }>();
    filteredInvoices.forEach(inv => {
      if (!inv.client_id) return;
      const existing = clientSalesMap.get(inv.client_id) || { sales: 0, invoices: 0, lastDate: new Date(0) };
      existing.sales += inv.total_amount;
      existing.invoices += 1;
      const invDate = parseISO(inv.invoice_date);
      if (invDate > existing.lastDate) existing.lastDate = invDate;
      clientSalesMap.set(inv.client_id, existing);
    });

    const clientsList = Array.from(clientSalesMap.entries())
      .map(([id, data]) => {
        const client = clients.find(c => c.id === id);
        return { id, name: client?.name || 'Desconocido', ...data };
      })
      .sort((a, b) => b.sales - a.sales);

    // Units sold
    const totalUnits = sortedProducts.reduce((sum, p) => sum + p.quantity, 0);
    const prevTotalUnits = sortedProducts.reduce((sum, p) => sum + p.prevQuantity, 0);
    const unitsGrowth = prevTotalUnits > 0 
      ? ((totalUnits - prevTotalUnits) / prevTotalUnits) * 100 
      : totalUnits > 0 ? 100 : 0;

    // Ticket promedio
    const avgTicket = totalSalesClosed > 0 ? totalRevenue / totalSalesClosed : 0;

    // Trend
    let trend: 'growth' | 'stable' | 'decline' = 'stable';
    if (revenueGrowth > 5) trend = 'growth';
    else if (revenueGrowth < -5) trend = 'decline';

    return {
      activeClients,
      clientGrowth,
      totalSalesClosed,
      salesGrowth,
      totalRevenue,
      revenueGrowth,
      totalCommission,
      topProducts,
      growingProducts,
      decliningProducts,
      clientsList,
      avgTicket,
      trend,
      totalUnits,
      unitsGrowth,
      previousRevenue,
      periodLabel: `${format(dateRange.from, 'dd MMM', { locale: es })} - ${format(dateRange.to, 'dd MMM', { locale: es })}`
    };
  }, [invoices, clients, products, dateRange]);

  const renderGrowthBadge = (growth: number, size: 'sm' | 'md' = 'sm') => {
    const isPositive = growth > 0;
    const isNeutral = Math.abs(growth) <= 2;
    
    if (isNeutral) {
      return (
        <span className={`inline-flex items-center gap-0.5 ${size === 'md' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5'} rounded-full bg-muted text-muted-foreground font-medium`}>
          <Minus className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
          Estable
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-0.5 ${size === 'md' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5'} rounded-full font-medium ${
        isPositive 
          ? 'bg-emerald-500/10 text-emerald-600' 
          : 'bg-rose-500/10 text-rose-600'
      }`}>
        {isPositive ? <ArrowUpRight className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} /> : <ArrowDownRight className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />}
        {isPositive ? '+' : ''}{growth.toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Panel Ejecutivo</h2>
            <p className="text-sm text-muted-foreground">{analytics.periodLabel}</p>
          </div>
        </div>
        
        {/* Trend Indicator */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${
          analytics.trend === 'growth' 
            ? 'bg-emerald-500/10 text-emerald-600' 
            : analytics.trend === 'decline' 
              ? 'bg-rose-500/10 text-rose-600' 
              : 'bg-muted text-muted-foreground'
        }`}>
          {analytics.trend === 'growth' && <TrendingUp className="h-5 w-5" />}
          {analytics.trend === 'decline' && <TrendingDown className="h-5 w-5" />}
          {analytics.trend === 'stable' && <Minus className="h-5 w-5" />}
          <span>
            {analytics.trend === 'growth' ? 'Crecimiento' : analytics.trend === 'decline' ? 'Caída' : 'Estable'}
          </span>
        </div>
      </div>

      {/* Main Revenue Card */}
      <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <CardContent className="pt-6 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium mb-1">Ingreso Total</p>
              <p className="text-5xl font-bold tracking-tight">${formatNumber(analytics.totalRevenue)}</p>
              <div className="flex items-center gap-3 mt-3">
                {renderGrowthBadge(analytics.revenueGrowth, 'md')}
                <span className="text-sm text-muted-foreground">
                  vs anterior: ${formatNumber(analytics.previousRevenue)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Tu Comisión</p>
              <p className="text-3xl font-bold text-emerald-600">${formatNumber(analytics.totalCommission)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - Clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clients Card */}
        <Card 
          className="cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all group"
          onClick={() => setDetailView(detailView === 'clients' ? 'none' : 'clients')}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              {renderGrowthBadge(analytics.clientGrowth)}
            </div>
            <p className="text-3xl font-bold">{analytics.activeClients}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-muted-foreground">Clientes Activos</p>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${detailView === 'clients' ? 'rotate-90' : ''}`} />
            </div>
          </CardContent>
        </Card>

        {/* Sales Card */}
        <Card 
          className="cursor-pointer hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all group"
          onClick={() => setDetailView(detailView === 'invoices' ? 'none' : 'invoices')}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              {renderGrowthBadge(analytics.salesGrowth)}
            </div>
            <p className="text-3xl font-bold">{analytics.totalSalesClosed}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-muted-foreground">Ventas Cerradas</p>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${detailView === 'invoices' ? 'rotate-90' : ''}`} />
            </div>
          </CardContent>
        </Card>

        {/* Units Card */}
        <Card 
          className="cursor-pointer hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 transition-all group"
          onClick={() => setDetailView(detailView === 'products' ? 'none' : 'products')}
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShoppingBag className="h-5 w-5 text-violet-600" />
              </div>
              {renderGrowthBadge(analytics.unitsGrowth)}
            </div>
            <p className="text-3xl font-bold">{analytics.totalUnits}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-muted-foreground">Unidades Vendidas</p>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${detailView === 'products' ? 'rotate-90' : ''}`} />
            </div>
          </CardContent>
        </Card>

        {/* Ticket Card */}
        <Card className="group">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                <Target className="h-5 w-5 text-cyan-600" />
              </div>
            </div>
            <p className="text-3xl font-bold">${formatNumber(analytics.avgTicket)}</p>
            <p className="text-sm text-muted-foreground mt-1">Ticket Promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Expandable Detail Views */}
      {detailView !== 'none' && (
        <Card className="border-2 animate-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {detailView === 'clients' && <><Users className="h-5 w-5 text-blue-600" /> Top Clientes</>}
                {detailView === 'products' && <><Package className="h-5 w-5 text-violet-600" /> Top Productos</>}
                {detailView === 'invoices' && <><FileText className="h-5 w-5 text-amber-600" /> Resumen de Ventas</>}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setDetailView('none')}>
                Cerrar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {detailView === 'clients' && (
                <div className="space-y-2">
                  {analytics.clientsList.slice(0, 10).map((client, i) => (
                    <button
                      key={client.id}
                      onClick={() => onNavigate?.('clients', client)}
                      className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.invoices} facturas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${formatNumber(client.sales)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(client.lastDate, 'dd MMM', { locale: es })}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {detailView === 'products' && (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 font-medium">#</th>
                          <th className="text-left py-2 font-medium">Producto</th>
                          <th className="text-right py-2 font-medium">Cantidad</th>
                          <th className="text-right py-2 font-medium">Ant.</th>
                          <th className="text-right py-2 font-medium">Ingreso</th>
                          <th className="text-center py-2 font-medium">Tendencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topProducts.map((product, i) => (
                          <tr key={product.name} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 font-medium text-muted-foreground">{i + 1}</td>
                            <td className="py-2 font-medium truncate max-w-32">{product.name}</td>
                            <td className="py-2 text-right font-semibold">{product.quantity}</td>
                            <td className="py-2 text-right text-muted-foreground">{product.prevQuantity}</td>
                            <td className="py-2 text-right">${formatNumber(product.amount)}</td>
                            <td className="py-2 text-center">{renderGrowthBadge(product.trend)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {(analytics.growingProducts.length > 0 || analytics.decliningProducts.length > 0) && (
                    <div className="grid md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                      {analytics.growingProducts.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-emerald-600 mb-2 flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" /> En Alza ({analytics.growingProducts.length})
                          </p>
                          <div className="space-y-1">
                            {analytics.growingProducts.slice(0, 3).map(p => (
                              <div key={p.name} className="flex justify-between text-sm">
                                <span className="truncate">{p.name}</span>
                                <span className="text-emerald-600">+{p.trend.toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {analytics.decliningProducts.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-rose-600 mb-2 flex items-center gap-1">
                            <TrendingDown className="h-4 w-4" /> Cayendo ({analytics.decliningProducts.length})
                          </p>
                          <div className="space-y-1">
                            {analytics.decliningProducts.slice(0, 3).map(p => (
                              <div key={p.name} className="flex justify-between text-sm">
                                <span className="truncate">{p.name}</span>
                                <span className="text-rose-600">{p.trend.toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {detailView === 'invoices' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-2xl font-bold">{analytics.totalSalesClosed}</p>
                      <p className="text-sm text-muted-foreground">Total Facturas</p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-500/10 text-center">
                      <p className="text-2xl font-bold text-emerald-600">${formatNumber(analytics.avgTicket)}</p>
                      <p className="text-sm text-muted-foreground">Promedio</p>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/10 text-center">
                      <p className="text-2xl font-bold text-primary">${formatNumber(analytics.totalRevenue)}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Distribución por cliente</p>
                    <div className="space-y-2">
                      {analytics.clientsList.slice(0, 5).map((client, i) => {
                        const percent = analytics.totalRevenue > 0 ? (client.sales / analytics.totalRevenue) * 100 : 0;
                        return (
                          <div key={client.id} className="flex items-center gap-3">
                            <span className="text-sm w-24 truncate">{client.name}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-16 text-right">{percent.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          className="flex-1 gap-2"
          onClick={() => onNavigate?.('products')}
        >
          <BarChart3 className="h-4 w-4" />
          Ver Análisis Productos
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 gap-2"
          onClick={() => onNavigate?.('map')}
        >
          <Eye className="h-4 w-4" />
          Ver Mapa
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 gap-2"
          onClick={() => onNavigate?.('clients')}
        >
          <Users className="h-4 w-4" />
          Ver Clientes
        </Button>
      </div>
    </div>
  );
}
