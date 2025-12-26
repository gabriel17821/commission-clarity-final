import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, Award, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, ShoppingBag, Target, BarChart3
} from 'lucide-react';
import { parseISO, isWithinInterval, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
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
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function ProductAnalysis({ invoices, products, dateRange }: ProductAnalysisProps) {
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

    // Build metrics
    const metrics: ProductMetric[] = Array.from(productData.entries()).map(([name, data]) => {
      const prevData = previousProductData.get(name);
      const prevRevenue = prevData?.revenue || 0;
      
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
        color: data.color
      };
    });

    // Sort by revenue
    metrics.sort((a, b) => b.revenue - a.revenue);

    const topByRevenue = metrics[0];
    const topByQuantity = [...metrics].sort((a, b) => b.quantity - a.quantity)[0];
    const lowestByRevenue = metrics.filter(p => p.revenue > 0).slice(-1)[0];
    const growing = metrics.filter(p => p.trend === 'up');
    const declining = metrics.filter(p => p.trend === 'down');

    // Chart data - top 10
    const chartData = metrics.slice(0, 10).map(m => ({
      name: m.name.length > 15 ? m.name.substring(0, 15) + '...' : m.name,
      fullName: m.name,
      quantity: m.quantity,
      revenue: m.revenue,
      color: m.color
    }));

    // Pie data for revenue distribution
    const pieData = metrics.slice(0, 5).map((m, i) => ({
      name: m.name,
      value: m.revenue,
      color: COLORS[i % COLORS.length]
    }));

    return {
      metrics,
      totalRevenue,
      totalQuantity,
      topByRevenue,
      topByQuantity,
      lowestByRevenue,
      growing,
      declining,
      chartData,
      pieData
    };
  }, [invoices, products, dateRange]);

  const renderTrendBadge = (trend: 'up' | 'down' | 'stable', percent: number) => {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
          <ArrowUpRight className="h-3 w-3" />
          +{percent.toFixed(0)}%
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-medium">
          <ArrowDownRight className="h-3 w-3" />
          {percent.toFixed(0)}%
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
      return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Alto rendimiento</span>;
    } else if (status === 'medium') {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Medio</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">Bajo</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Análisis de Productos</h3>
          <p className="text-sm text-muted-foreground">Decisiones basadas en datos reales</p>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Most Revenue */}
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground uppercase">Más Dinero</span>
            </div>
            <p className="font-semibold truncate">{analysis.topByRevenue?.name || 'N/A'}</p>
            <p className="text-lg font-bold text-emerald-600">${formatNumber(analysis.topByRevenue?.revenue || 0)}</p>
          </CardContent>
        </Card>

        {/* Most Quantity */}
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground uppercase">Mayor Volumen</span>
            </div>
            <p className="font-semibold truncate">{analysis.topByQuantity?.name || 'N/A'}</p>
            <p className="text-lg font-bold text-blue-600">{analysis.topByQuantity?.quantity || 0} uds</p>
          </CardContent>
        </Card>

        {/* Growing */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase">Creciendo</span>
            </div>
            <p className="text-2xl font-bold">{analysis.growing.length}</p>
            <p className="text-xs text-muted-foreground">productos en alza</p>
          </CardContent>
        </Card>

        {/* Declining */}
        <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-rose-600" />
              <span className="text-xs text-muted-foreground uppercase">Cayendo</span>
            </div>
            <p className="text-2xl font-bold text-rose-600">{analysis.declining.length}</p>
            <p className="text-xs text-muted-foreground">productos en baja</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Quantity Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Cantidad Vendida por Producto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border rounded-lg p-2 shadow-lg">
                          <p className="font-semibold text-sm">{data.fullName}</p>
                          <p className="text-sm">{data.quantity} unidades</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="quantity" radius={[0, 4, 4, 0]}>
                  {analysis.chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ingreso por Producto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(v) => `$${formatNumber(v)}`} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border rounded-lg p-2 shadow-lg">
                          <p className="font-semibold text-sm">{data.fullName}</p>
                          <p className="text-sm">${formatNumber(data.revenue)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {analysis.chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Comparativo: Cantidad vs Dinero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={analysis.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `${v}`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${formatNumber(v)}`} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-card border rounded-lg p-2 shadow-lg">
                        <p className="font-semibold text-sm">{data.fullName}</p>
                        <p className="text-sm text-blue-600">{data.quantity} unidades</p>
                        <p className="text-sm text-emerald-600">${formatNumber(data.revenue)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar yAxisId="left" dataKey="quantity" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Product Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalle por Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Producto</th>
                  <th className="text-right py-2 font-medium">Cantidad</th>
                  <th className="text-right py-2 font-medium">Ingreso</th>
                  <th className="text-right py-2 font-medium">% del Total</th>
                  <th className="text-right py-2 font-medium">Tendencia</th>
                  <th className="text-right py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {analysis.metrics.slice(0, 15).map(metric => (
                  <tr key={metric.name} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 font-medium">{metric.name}</td>
                    <td className="text-right py-2">{metric.quantity}</td>
                    <td className="text-right py-2">${formatNumber(metric.revenue)}</td>
                    <td className="text-right py-2">{metric.percentOfTotal.toFixed(1)}%</td>
                    <td className="text-right py-2">{renderTrendBadge(metric.trend, metric.trendPercent)}</td>
                    <td className="text-right py-2">{renderStatusBadge(metric.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
