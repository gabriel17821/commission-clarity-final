import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, DollarSign, TrendingUp, TrendingDown, Minus, 
  Target, Award, ShoppingBag, FileText, ArrowUpRight, ArrowDownRight,
  Calendar, UserCheck, Zap
} from 'lucide-react';
import { parseISO, isWithinInterval, subMonths, startOfMonth, endOfMonth, differenceInDays, format } from 'date-fns';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { formatNumber } from '@/lib/formatters';

interface VentoViewProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  dateRange: { from: Date; to: Date };
}

export function VentoView({ invoices, clients, products, dateRange }: VentoViewProps) {
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

    // Active clients (those with at least one invoice in period)
    const activeClientIds = new Set(filteredInvoices.map(inv => inv.client_id).filter(Boolean));
    const activeClients = activeClientIds.size;

    // Visited clients (same as active for now)
    const visitedClients = activeClients;

    // Total sales closed
    const totalSalesClosed = filteredInvoices.length;

    // Total revenue
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const previousRevenue = previousInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const revenueGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : totalRevenue > 0 ? 100 : 0;

    // Total commission
    const totalCommission = filteredInvoices.reduce((sum, inv) => sum + inv.total_commission, 0);

    // Product analysis
    const productSales = new Map<string, { quantity: number; amount: number }>();
    filteredInvoices.forEach(inv => {
      inv.products?.forEach(prod => {
        const existing = productSales.get(prod.product_name) || { quantity: 0, amount: 0 };
        existing.quantity += (prod.quantity_sold || 1);
        existing.amount += prod.amount;
        productSales.set(prod.product_name, existing);
      });
    });

    const sortedProducts = Array.from(productSales.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount);

    const topProducts = sortedProducts.slice(0, 3);
    const bottomProducts = sortedProducts.filter(p => p.amount > 0).slice(-3).reverse();

    // Ticket promedio
    const avgTicket = totalSalesClosed > 0 ? totalRevenue / totalSalesClosed : 0;

    // Trend
    let trend: 'growth' | 'stable' | 'decline' = 'stable';
    if (revenueGrowth > 5) trend = 'growth';
    else if (revenueGrowth < -5) trend = 'decline';

    return {
      activeClients,
      visitedClients,
      totalSalesClosed,
      totalRevenue,
      totalCommission,
      revenueGrowth,
      topProducts,
      bottomProducts,
      avgTicket,
      trend,
      periodLabel: `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
    };
  }, [invoices, clients, products, dateRange]);

  const renderTrend = () => {
    if (analytics.trend === 'growth') {
      return (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold">Crecimiento</span>
          <span className="text-sm">+{analytics.revenueGrowth.toFixed(1)}%</span>
        </div>
      );
    } else if (analytics.trend === 'decline') {
      return (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/10 text-rose-600">
          <TrendingDown className="h-5 w-5" />
          <span className="font-semibold">Caída</span>
          <span className="text-sm">{analytics.revenueGrowth.toFixed(1)}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground">
        <Minus className="h-5 w-5" />
        <span className="font-semibold">Estable</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            VentoView
          </h2>
          <p className="text-muted-foreground mt-1">Panel ejecutivo del vendedor • {analytics.periodLabel}</p>
        </div>
        {renderTrend()}
      </div>

      {/* Main KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Clients */}
        <Card className="relative overflow-hidden border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Clientes Activos</p>
                <p className="text-3xl font-bold">{analytics.activeClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visited Clients */}
        <Card className="relative overflow-hidden border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Clientes Visitados</p>
                <p className="text-3xl font-bold">{analytics.visitedClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Closed */}
        <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Ventas Cerradas</p>
                <p className="text-3xl font-bold">{analytics.totalSalesClosed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Promedio */}
        <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                <Target className="h-6 w-6 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Ticket Promedio</p>
                <p className="text-3xl font-bold">${formatNumber(analytics.avgTicket)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Commission */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                <DollarSign className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">Ingreso Total Generado</p>
                <p className="text-4xl font-bold mt-1">${formatNumber(analytics.totalRevenue)}</p>
                <div className="flex items-center gap-2 mt-2">
                  {analytics.revenueGrowth > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium">
                      <ArrowUpRight className="h-3 w-3" />
                      +{analytics.revenueGrowth.toFixed(1)}% vs período anterior
                    </span>
                  ) : analytics.revenueGrowth < 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/10 text-rose-600 text-sm font-medium">
                      <ArrowDownRight className="h-3 w-3" />
                      {analytics.revenueGrowth.toFixed(1)}% vs período anterior
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin cambio vs período anterior</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <Award className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">Comisión Generada</p>
                <p className="text-4xl font-bold mt-1 text-emerald-600">${formatNumber(analytics.totalCommission)}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Tu ganancia en el período seleccionado
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top & Bottom Products */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Products */}
        <Card className="border-emerald-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Productos Más Vendidos</p>
                <p className="text-xs text-muted-foreground">Mayor volumen de ventas</p>
              </div>
            </div>
            <div className="space-y-3">
              {analytics.topProducts.length > 0 ? (
                analytics.topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.quantity} unidades</p>
                    </div>
                    <p className="font-semibold text-emerald-600">${formatNumber(product.amount)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sin datos en el período</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Products */}
        <Card className="border-amber-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Productos Menos Vendidos</p>
                <p className="text-xs text-muted-foreground">Oportunidad de impulso</p>
              </div>
            </div>
            <div className="space-y-3">
              {analytics.bottomProducts.length > 0 ? (
                analytics.bottomProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold text-sm">
                      {analytics.bottomProducts.length - index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.quantity} unidades</p>
                    </div>
                    <p className="font-semibold text-amber-600">${formatNumber(product.amount)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sin datos en el período</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
