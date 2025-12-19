import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Users, Package, DollarSign, FileText, Download, Upload, Calendar, ArrowUpRight, ArrowDownRight, Minus, Target, Award, AlertTriangle } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnalyticsData } from '@/hooks/useAnalytics';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { formatNumber, formatCurrency } from '@/lib/formatters';
import { ExcelImporter } from './ExcelImporter';
import { PDFReportGenerator } from './PDFReportGenerator';

interface AnalyticsDashboardProps {
  data: AnalyticsData[];
  clients: Client[];
  products: Product[];
  onImport: (items: any[]) => Promise<{ success: number; failed: number }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function AnalyticsDashboard({ data, clients, products, onImport }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m');
  const [showImporter, setShowImporter] = useState(false);
  const [showPdfGenerator, setShowPdfGenerator] = useState(false);

  const filteredData = useMemo(() => {
    if (dateRange === 'all') return data;
    
    const now = new Date();
    const monthsBack = dateRange === '1m' ? 1 : dateRange === '3m' ? 3 : dateRange === '6m' ? 6 : 12;
    const startDate = subMonths(now, monthsBack);

    return data.filter(d => {
      const date = parseISO(d.sale_date);
      return date >= startDate && date <= now;
    });
  }, [data, dateRange]);

  // Previous period data for comparison
  const previousPeriodData = useMemo(() => {
    const now = new Date();
    const monthsBack = dateRange === '1m' ? 1 : dateRange === '3m' ? 3 : dateRange === '6m' ? 6 : 12;
    const startDate = subMonths(now, monthsBack * 2);
    const endDate = subMonths(now, monthsBack);

    return data.filter(d => {
      const date = parseISO(d.sale_date);
      return date >= startDate && date < endDate;
    });
  }, [data, dateRange]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const currentTotal = filteredData.reduce((sum, d) => sum + Number(d.total_amount), 0);
    const previousTotal = previousPeriodData.reduce((sum, d) => sum + Number(d.total_amount), 0);
    const salesChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    const currentCommission = filteredData.reduce((sum, d) => sum + Number(d.commission_amount), 0);
    const previousCommission = previousPeriodData.reduce((sum, d) => sum + Number(d.commission_amount), 0);
    const commissionChange = previousCommission > 0 ? ((currentCommission - previousCommission) / previousCommission) * 100 : 0;

    const currentUnits = filteredData.reduce((sum, d) => sum + Number(d.quantity), 0);
    const previousUnits = previousPeriodData.reduce((sum, d) => sum + Number(d.quantity), 0);
    const unitsChange = previousUnits > 0 ? ((currentUnits - previousUnits) / previousUnits) * 100 : 0;

    const uniqueClients = new Set(filteredData.map(d => d.client_id).filter(Boolean)).size;
    const previousClients = new Set(previousPeriodData.map(d => d.client_id).filter(Boolean)).size;
    const clientsChange = previousClients > 0 ? ((uniqueClients - previousClients) / previousClients) * 100 : 0;

    return {
      totalSales: currentTotal,
      salesChange,
      totalCommission: currentCommission,
      commissionChange,
      totalUnits: currentUnits,
      unitsChange,
      activeClients: uniqueClients,
      clientsChange,
      avgTicket: filteredData.length > 0 ? currentTotal / filteredData.length : 0,
    };
  }, [filteredData, previousPeriodData]);

  // Client analytics
  const clientAnalytics = useMemo(() => {
    const clientMap = new Map<string, { 
      name: string; 
      total: number; 
      units: number; 
      commission: number;
      transactions: number;
      products: Set<string>;
      trend: number;
    }>();

    filteredData.forEach(d => {
      if (!d.client_id) return;
      const client = clients.find(c => c.id === d.client_id);
      if (!client) return;

      const existing = clientMap.get(d.client_id) || { 
        name: client.name, 
        total: 0, 
        units: 0, 
        commission: 0,
        transactions: 0,
        products: new Set<string>(),
        trend: 0 
      };

      existing.total += Number(d.total_amount);
      existing.units += Number(d.quantity);
      existing.commission += Number(d.commission_amount);
      existing.transactions += 1;
      existing.products.add(d.product_name);

      clientMap.set(d.client_id, existing);
    });

    // Calculate trends
    const prevClientTotals = new Map<string, number>();
    previousPeriodData.forEach(d => {
      if (!d.client_id) return;
      prevClientTotals.set(d.client_id, (prevClientTotals.get(d.client_id) || 0) + Number(d.total_amount));
    });

    clientMap.forEach((value, key) => {
      const prevTotal = prevClientTotals.get(key) || 0;
      value.trend = prevTotal > 0 ? ((value.total - prevTotal) / prevTotal) * 100 : (value.total > 0 ? 100 : 0);
    });

    return Array.from(clientMap.entries())
      .map(([id, data]) => ({ id, ...data, productCount: data.products.size }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData, previousPeriodData, clients]);

  // Product analytics
  const productAnalytics = useMemo(() => {
    const productMap = new Map<string, {
      name: string;
      total: number;
      units: number;
      commission: number;
      avgPrice: number;
      clients: Set<string>;
      trend: number;
    }>();

    filteredData.forEach(d => {
      const existing = productMap.get(d.product_name) || {
        name: d.product_name,
        total: 0,
        units: 0,
        commission: 0,
        avgPrice: 0,
        clients: new Set<string>(),
        trend: 0
      };

      existing.total += Number(d.total_amount);
      existing.units += Number(d.quantity);
      existing.commission += Number(d.commission_amount);
      if (d.client_id) existing.clients.add(d.client_id);

      productMap.set(d.product_name, existing);
    });

    // Calculate avg price and trends
    const prevProductTotals = new Map<string, number>();
    previousPeriodData.forEach(d => {
      prevProductTotals.set(d.product_name, (prevProductTotals.get(d.product_name) || 0) + Number(d.total_amount));
    });

    productMap.forEach((value, key) => {
      value.avgPrice = value.units > 0 ? value.total / value.units : 0;
      const prevTotal = prevProductTotals.get(key) || 0;
      value.trend = prevTotal > 0 ? ((value.total - prevTotal) / prevTotal) * 100 : (value.total > 0 ? 100 : 0);
    });

    return Array.from(productMap.entries())
      .map(([name, data]) => ({ ...data, clientCount: data.clients.size }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData, previousPeriodData]);

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const dayMap = new Map<string, { date: string; sales: number; commission: number; units: number }>();
    
    filteredData.forEach(d => {
      const dateKey = d.sale_date;
      const existing = dayMap.get(dateKey) || { date: dateKey, sales: 0, commission: 0, units: 0 };
      existing.sales += Number(d.total_amount);
      existing.commission += Number(d.commission_amount);
      existing.units += Number(d.quantity);
      dayMap.set(dateKey, existing);
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [filteredData]);

  // Products losing traction
  const decliningProducts = useMemo(() => {
    return productAnalytics.filter(p => p.trend < -10).slice(0, 5);
  }, [productAnalytics]);

  // Clients losing traction
  const decliningClients = useMemo(() => {
    return clientAnalytics.filter(c => c.trend < -10).slice(0, 5);
  }, [clientAnalytics]);

  const renderChangeIndicator = (change: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'text-sm px-2 py-1' : 'text-xs px-1.5 py-0.5';
    if (change > 0) {
      return (
        <span className={`inline-flex items-center gap-0.5 ${sizeClass} rounded-full bg-emerald-500/10 text-emerald-600 font-medium`}>
          <ArrowUpRight className="h-3 w-3" />
          {change.toFixed(1)}%
        </span>
      );
    } else if (change < 0) {
      return (
        <span className={`inline-flex items-center gap-0.5 ${sizeClass} rounded-full bg-rose-500/10 text-rose-600 font-medium`}>
          <ArrowDownRight className="h-3 w-3" />
          {Math.abs(change).toFixed(1)}%
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-0.5 ${sizeClass} rounded-full bg-muted text-muted-foreground font-medium`}>
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centro de Análisis</h2>
          <p className="text-muted-foreground">Métricas detalladas de ventas y rendimiento</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">Último mes</SelectItem>
              <SelectItem value="3m">3 meses</SelectItem>
              <SelectItem value="6m">6 meses</SelectItem>
              <SelectItem value="1y">1 año</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setShowImporter(true)}>
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowPdfGenerator(true)}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Ventas Totales</p>
                <p className="text-2xl font-bold">${formatNumber(kpis.totalSales)}</p>
              </div>
            </div>
            <div className="mt-3">{renderChangeIndicator(kpis.salesChange, 'lg')}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Comisión Total</p>
                <p className="text-2xl font-bold text-emerald-600">${formatNumber(kpis.totalCommission)}</p>
              </div>
            </div>
            <div className="mt-3">{renderChangeIndicator(kpis.commissionChange, 'lg')}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Unidades</p>
                <p className="text-2xl font-bold">{formatNumber(kpis.totalUnits)}</p>
              </div>
            </div>
            <div className="mt-3">{renderChangeIndicator(kpis.unitsChange, 'lg')}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Clientes Activos</p>
                <p className="text-2xl font-bold">{kpis.activeClients}</p>
              </div>
            </div>
            <div className="mt-3">{renderChangeIndicator(kpis.clientsChange, 'lg')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Daily Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Tendencia Diaria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(v) => format(parseISO(v as string), "d 'de' MMMM", { locale: es })}
                    formatter={(value: number, name: string) => [
                      `$${formatNumber(value)}`,
                      name === 'sales' ? 'Ventas' : 'Comisión'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#salesGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Product Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribución por Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productAnalytics.slice(0, 5)}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {productAnalytics.slice(0, 5).map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${formatNumber(value)}`, 'Ventas']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {productAnalytics.slice(0, 5).map((p, idx) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate max-w-[120px]">{p.name}</span>
                  </div>
                  <span className="font-medium">${formatNumber(p.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clients" className="gap-2">
            <Users className="h-4 w-4" />
            Por Cliente
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Por Producto
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          {/* Top Clients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Ranking de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clientAnalytics.slice(0, 10).map((client, idx) => (
                  <div key={client.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-600' :
                      idx === 1 ? 'bg-slate-400/20 text-slate-600' :
                      idx === 2 ? 'bg-orange-500/20 text-orange-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.transactions} transacciones · {client.productCount} productos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${formatNumber(client.total)}</p>
                      <div className="flex items-center justify-end gap-1">
                        {renderChangeIndicator(client.trend)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Client-Product Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Productos por Cliente (Top 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Cliente</th>
                      <th className="text-right py-2 px-3 font-medium">Productos</th>
                      <th className="text-right py-2 px-3 font-medium">Unidades</th>
                      <th className="text-right py-2 px-3 font-medium">Total</th>
                      <th className="text-right py-2 px-3 font-medium">Comisión</th>
                      <th className="text-right py-2 px-3 font-medium">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientAnalytics.slice(0, 5).map(client => (
                      <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-3 font-medium">{client.name}</td>
                        <td className="py-3 px-3 text-right">{client.productCount}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(client.units)}</td>
                        <td className="py-3 px-3 text-right font-medium">${formatNumber(client.total)}</td>
                        <td className="py-3 px-3 text-right text-emerald-600">${formatNumber(client.commission)}</td>
                        <td className="py-3 px-3 text-right">{renderChangeIndicator(client.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Análisis de Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Producto</th>
                      <th className="text-right py-2 px-3 font-medium">Unidades</th>
                      <th className="text-right py-2 px-3 font-medium">Precio Prom.</th>
                      <th className="text-right py-2 px-3 font-medium">Total Vendido</th>
                      <th className="text-right py-2 px-3 font-medium">Comisión DLS</th>
                      <th className="text-right py-2 px-3 font-medium">Clientes</th>
                      <th className="text-right py-2 px-3 font-medium">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productAnalytics.map(product => (
                      <tr key={product.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-3 font-medium">{product.name}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(product.units)}</td>
                        <td className="py-3 px-3 text-right">${formatNumber(product.avgPrice)}</td>
                        <td className="py-3 px-3 text-right font-medium">${formatNumber(product.total)}</td>
                        <td className="py-3 px-3 text-right text-emerald-600">${formatNumber(product.commission)}</td>
                        <td className="py-3 px-3 text-right">{product.clientCount}</td>
                        <td className="py-3 px-3 text-right">{renderChangeIndicator(product.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Product Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparativa de Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productAnalytics.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`$${formatNumber(value)}`, 'Total']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Declining Products */}
            <Card className="border-rose-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-rose-600">
                  <TrendingDown className="h-5 w-5" />
                  Productos en Declive
                </CardTitle>
              </CardHeader>
              <CardContent>
                {decliningProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay productos en declive significativo
                  </p>
                ) : (
                  <div className="space-y-3">
                    {decliningProducts.map(p => (
                      <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.units} unidades vendidas</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                          <ArrowDownRight className="h-4 w-4" />
                          {Math.abs(p.trend).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Declining Clients */}
            <Card className="border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  Clientes en Riesgo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {decliningClients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay clientes en riesgo significativo
                  </p>
                ) : (
                  <div className="space-y-3">
                    {decliningClients.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.transactions} transacciones</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <ArrowDownRight className="h-4 w-4" />
                          {Math.abs(c.trend).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ExcelImporter 
        open={showImporter} 
        onOpenChange={setShowImporter} 
        onImport={onImport}
        clients={clients}
        products={products}
      />
      
      <PDFReportGenerator
        open={showPdfGenerator}
        onOpenChange={setShowPdfGenerator}
        data={filteredData}
        clients={clients}
        products={products}
        kpis={kpis}
        clientAnalytics={clientAnalytics}
        productAnalytics={productAnalytics}
      />
    </div>
  );
}
