import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, 
  ArrowUpRight, ArrowDownRight, Minus, ShoppingBag, ChevronDown, ChevronUp, Table
} from 'lucide-react';
import { parseISO, isWithinInterval, differenceInDays, format } from 'date-fns';
import { Invoice } from '@/hooks/useInvoices';
import { Product } from '@/hooks/useProducts';
import { formatNumber } from '@/lib/formatters';

interface ProductAnalysisProps {
  invoices: Invoice[];
  products: Product[];
  dateRange: { from: Date; to: Date };
}

interface ProductMetric {
  name: string;
  quantity: number;
  revenue: number;
  percentOfTotal: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  status: 'high' | 'medium' | 'low';
  color: string;
  previousQuantity: number;
  previousRevenue: number;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

export function ProductAnalysis({ invoices, products, dateRange }: ProductAnalysisProps) {
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const analysis = useMemo(() => {
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

    // Current period product data
    const productData = new Map<string, { quantity: number; revenue: number; color: string }>();
    filteredInvoices.forEach(inv => {
      inv.products?.forEach(prod => {
        const existing = productData.get(prod.product_name) || { quantity: 0, revenue: 0, color: '#6366f1' };
        existing.quantity += (prod.quantity_sold || 1);
        existing.revenue += prod.amount;
        const catalogProduct = products.find(p => p.name === prod.product_name);
        if (catalogProduct) existing.color = catalogProduct.color;
        productData.set(prod.product_name, existing);
      });
    });

    // Previous period product data
    const previousProductData = new Map<string, { quantity: number; revenue: number }>();
    previousInvoices.forEach(inv => {
      inv.products?.forEach(prod => {
        const existing = previousProductData.get(prod.product_name) || { quantity: 0, revenue: 0 };
        existing.quantity += (prod.quantity_sold || 1);
        existing.revenue += prod.amount;
        previousProductData.set(prod.product_name, existing);
      });
    });

    const totalRevenue = Array.from(productData.values()).reduce((sum, p) => sum + p.revenue, 0);
    const totalQuantity = Array.from(productData.values()).reduce((sum, p) => sum + p.quantity, 0);
    const prevTotalRevenue = Array.from(previousProductData.values()).reduce((sum, p) => sum + p.revenue, 0);
    const prevTotalQuantity = Array.from(previousProductData.values()).reduce((sum, p) => sum + p.quantity, 0);

    // Build metrics
    const metrics: ProductMetric[] = Array.from(productData.entries()).map(([name, data]) => {
      const prevData = previousProductData.get(name);
      const prevRevenue = prevData?.revenue || 0;
      const prevQuantity = prevData?.quantity || 0;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendPercent = 0;
      if (prevRevenue > 0 && data.revenue > 0) {
        trendPercent = ((data.revenue - prevRevenue) / prevRevenue) * 100;
        trend = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable';
      } else if (data.revenue > 0 && prevRevenue === 0) {
        trend = 'up';
        trendPercent = 100;
      } else if (data.revenue === 0 && prevRevenue > 0) {
        trend = 'down';
        trendPercent = -100;
      }

      const percentOfTotal = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
      
      // Status based on percent of total
      let status: 'high' | 'medium' | 'low' = 'low';
      if (percentOfTotal >= 15) status = 'high';
      else if (percentOfTotal >= 5) status = 'medium';

      return {
        name,
        quantity: data.quantity,
        revenue: data.revenue,
        percentOfTotal,
        trend,
        trendPercent,
        status,
        color: data.color,
        previousQuantity: prevQuantity,
        previousRevenue: prevRevenue
      };
    });

    // Sort by revenue
    metrics.sort((a, b) => b.revenue - a.revenue);

    const topByRevenue = metrics[0];
    const topByQuantity = [...metrics].sort((a, b) => b.quantity - a.quantity)[0];
    const lowestByRevenue = metrics.filter(p => p.revenue > 0).slice(-1)[0];
    const growing = metrics.filter(p => p.trend === 'up');
    const declining = metrics.filter(p => p.trend === 'down');

    // Chart data - top 8
    const chartData = metrics.slice(0, 8).map((m, i) => ({
      name: m.name.length > 12 ? m.name.substring(0, 12) + '...' : m.name,
      fullName: m.name,
      quantity: m.quantity,
      revenue: m.revenue,
      prevQuantity: m.previousQuantity,
      prevRevenue: m.previousRevenue,
      color: CHART_COLORS[i % CHART_COLORS.length]
    }));

    return {
      metrics,
      totalRevenue,
      totalQuantity,
      prevTotalRevenue,
      prevTotalQuantity,
      topByRevenue,
      topByQuantity,
      lowestByRevenue,
      growing,
      declining,
      chartData,
      periodLabel: `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`
    };
  }, [invoices, products, dateRange]);

  const renderTrendBadge = (trend: 'up' | 'down' | 'stable', percent: number) => {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
          <ArrowUpRight className="h-3 w-3" />
          +{Math.abs(percent).toFixed(0)}%
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-medium">
          <ArrowDownRight className="h-3 w-3" />
          -{Math.abs(percent).toFixed(0)}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
        <Minus className="h-3 w-3" />
        Estable
      </span>
    );
  };

  const renderStatusBadge = (status: 'high' | 'medium' | 'low') => {
    if (status === 'high') {
      return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Alto</Badge>;
    } else if (status === 'medium') {
      return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Medio</Badge>;
    }
    return <Badge variant="outline" className="text-rose-600">Bajo</Badge>;
  };

  const displayedMetrics = showAllProducts ? analysis.metrics : analysis.metrics.slice(0, 10);

  // Calculate overall trend
  const overallRevenueTrend = analysis.prevTotalRevenue > 0 
    ? ((analysis.totalRevenue - analysis.prevTotalRevenue) / analysis.prevTotalRevenue) * 100 
    : 0;
  const overallQuantityTrend = analysis.prevTotalQuantity > 0 
    ? ((analysis.totalQuantity - analysis.prevTotalQuantity) / analysis.prevTotalQuantity) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Insights Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="border-emerald-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground uppercase">Ingreso Total</span>
              </div>
              {overallRevenueTrend !== 0 && renderTrendBadge(
                overallRevenueTrend > 5 ? 'up' : overallRevenueTrend < -5 ? 'down' : 'stable',
                overallRevenueTrend
              )}
            </div>
            <p className="text-2xl font-bold">${formatNumber(analysis.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Anterior: ${formatNumber(analysis.prevTotalRevenue)}
            </p>
          </CardContent>
        </Card>

        {/* Total Quantity */}
        <Card className="border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground uppercase">Unidades</span>
              </div>
              {overallQuantityTrend !== 0 && renderTrendBadge(
                overallQuantityTrend > 5 ? 'up' : overallQuantityTrend < -5 ? 'down' : 'stable',
                overallQuantityTrend
              )}
            </div>
            <p className="text-2xl font-bold">{analysis.totalQuantity}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Anterior: {analysis.prevTotalQuantity}
            </p>
          </CardContent>
        </Card>

        {/* Growing */}
        <Card className="border-primary/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground uppercase">En Alza</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{analysis.growing.length}</p>
            <p className="text-xs text-muted-foreground mt-1">productos creciendo</p>
          </CardContent>
        </Card>

        {/* Declining */}
        <Card className="border-rose-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-rose-600" />
              <span className="text-xs text-muted-foreground uppercase">Cayendo</span>
            </div>
            <p className="text-2xl font-bold text-rose-600">{analysis.declining.length}</p>
            <p className="text-xs text-muted-foreground mt-1">productos en baja</p>
          </CardContent>
        </Card>
      </div>

      {/* Top/Bottom Products Highlight */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-sm font-medium">Más Dinero Generó</span>
            </div>
            <p className="font-bold text-lg truncate">{analysis.topByRevenue?.name || 'N/A'}</p>
            <p className="text-2xl font-bold text-emerald-600">${formatNumber(analysis.topByRevenue?.revenue || 0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium">Mayor Volumen</span>
            </div>
            <p className="font-bold text-lg truncate">{analysis.topByQuantity?.name || 'N/A'}</p>
            <p className="text-2xl font-bold text-blue-600">{analysis.topByQuantity?.quantity || 0} uds</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/5 to-transparent border-rose-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-rose-600" />
              </div>
              <span className="text-sm font-medium">Menor Rendimiento</span>
            </div>
            <p className="font-bold text-lg truncate">{analysis.lowestByRevenue?.name || 'N/A'}</p>
            <p className="text-2xl font-bold text-rose-600">${formatNumber(analysis.lowestByRevenue?.revenue || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparative Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Top 8 Productos - Período Actual vs Anterior
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analysis.chartData} layout="vertical" barGap={0}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(v) => `$${formatNumber(v)}`} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold text-sm mb-2">{data.fullName}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-emerald-600">Actual:</span>
                            <span className="font-medium">${formatNumber(data.revenue)} ({data.quantity} uds)</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Anterior:</span>
                            <span>${formatNumber(data.prevRevenue)} ({data.prevQuantity} uds)</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="prevRevenue" name="Período Anterior" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="revenue" name="Período Actual" radius={[0, 4, 4, 0]}>
                {analysis.chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Table className="h-4 w-4" />
              Tabla Comparativa Detallada
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
            >
              {viewMode === 'table' ? 'Ver Cards' : 'Ver Tabla'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-2 font-semibold">Producto</th>
                  <th className="text-right py-3 px-2 font-semibold">
                    <div className="flex flex-col items-end">
                      <span>Cantidad</span>
                      <span className="text-xs font-normal text-muted-foreground">Actual / Anterior</span>
                    </div>
                  </th>
                  <th className="text-right py-3 px-2 font-semibold">
                    <div className="flex flex-col items-end">
                      <span>Ingreso</span>
                      <span className="text-xs font-normal text-muted-foreground">Actual / Anterior</span>
                    </div>
                  </th>
                  <th className="text-right py-3 px-2 font-semibold">% Total</th>
                  <th className="text-center py-3 px-2 font-semibold">Tendencia</th>
                  <th className="text-center py-3 px-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {displayedMetrics.map((metric, index) => (
                  <tr 
                    key={metric.name} 
                    className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                      index < 3 ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: metric.color }}
                        />
                        <span className="font-medium">{metric.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold">{metric.quantity}</span>
                        <span className="text-xs text-muted-foreground">{metric.previousQuantity}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold">${formatNumber(metric.revenue)}</span>
                        <span className="text-xs text-muted-foreground">${formatNumber(metric.previousRevenue)}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <span className="font-medium">{metric.percentOfTotal.toFixed(1)}%</span>
                    </td>
                    <td className="text-center py-3 px-2">
                      {renderTrendBadge(metric.trend, metric.trendPercent)}
                    </td>
                    <td className="text-center py-3 px-2">
                      {renderStatusBadge(metric.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {analysis.metrics.length > 10 && (
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="gap-2"
              >
                {showAllProducts ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Ver menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Ver todos ({analysis.metrics.length} productos)
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
