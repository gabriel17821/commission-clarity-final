import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Users, Package, DollarSign, FileText, Download, Upload, Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, Minus, Target, Award, AlertTriangle, UserCheck, Eye, Crown, AlertCircle, ShoppingBag } from 'lucide-react';
import { format, parseISO, subMonths, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import { useRealAnalytics } from '@/hooks/useRealAnalytics';
import { formatNumber, formatCurrency } from '@/lib/formatters';
import { RealPDFGenerator } from './RealPDFGenerator';
import { ExcelImporter } from './ExcelImporter';
import { ClientDetailView } from './ClientDetailView';
import { useAnalytics } from '@/hooks/useAnalytics';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

type PeriodFilter = '1m' | '3m' | '6m' | '1y' | 'all' | 'custom';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface RealAnalyticsDashboardProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  sellers: Seller[];
  activeSeller?: Seller | null;
}

export function RealAnalyticsDashboard({ invoices, clients, products, sellers, activeSeller }: RealAnalyticsDashboardProps) {
  const [showPdfGenerator, setShowPdfGenerator] = useState(false);
  const [showExcelImporter, setShowExcelImporter] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'general'>('personal');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('6m');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  
  const { bulkImport } = useAnalytics();
  
  // Filter invoices by date range
  const filteredInvoices = invoices.filter(inv => {
    const invDate = parseISO(inv.invoice_date);
    const now = new Date();
    
    if (periodFilter === 'custom' && dateRange.from && dateRange.to) {
      return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    }
    
    let startDate: Date;
    switch (periodFilter) {
      case '1m':
        startDate = startOfMonth(subMonths(now, 1));
        break;
      case '3m':
        startDate = startOfMonth(subMonths(now, 3));
        break;
      case '6m':
        startDate = startOfMonth(subMonths(now, 6));
        break;
      case '1y':
        startDate = startOfMonth(subMonths(now, 12));
        break;
      default:
        return true;
    }
    
    return invDate >= startDate;
  });
  
  const analytics = useRealAnalytics(
    filteredInvoices, 
    clients, 
    products, 
    sellers,
    viewMode === 'personal' ? activeSeller?.id : null
  );

  // Bento metrics
  const bestClient = analytics.clientMetrics[0];
  const lowestMovementClient = [...analytics.clientMetrics]
    .filter(c => c.totalSales > 0)
    .sort((a, b) => a.currentMonthSales - b.currentMonthSales)[0];
  const topProducts = analytics.productMetrics.slice(0, 3);

  const renderChangeIndicator = (change: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'text-sm px-2 py-1' : 'text-xs px-1.5 py-0.5';
    if (change > 0) {
      return (
        <span className={`inline-flex items-center gap-0.5 ${sizeClass} rounded-full bg-emerald-500/10 text-emerald-600 font-medium`}>
          <ArrowUpRight className="h-3 w-3" />
          +{change.toFixed(1)}%
        </span>
      );
    } else if (change < 0) {
      return (
        <span className={`inline-flex items-center gap-0.5 ${sizeClass} rounded-full bg-rose-500/10 text-rose-600 font-medium`}>
          <ArrowDownRight className="h-3 w-3" />
          {change.toFixed(1)}%
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

  const handleClientClick = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
    }
  };

  const handlePeriodChange = (value: PeriodFilter) => {
    setPeriodFilter(value);
    if (value !== 'custom') {
      setDateRange({ from: undefined, to: undefined });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centro de Análisis</h2>
          <p className="text-muted-foreground">
            {viewMode === 'personal' && activeSeller 
              ? `Métricas de ${activeSeller.name}` 
              : 'Métricas generales del negocio'
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodFilter} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">Último mes</SelectItem>
              <SelectItem value="3m">Último trimestre</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="1y">Último año</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          
          {periodFilter === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange.from && dateRange.to 
                    ? `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}`
                    : 'Seleccionar fechas'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          )}
          
          <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <SelectTrigger className="w-44">
              <UserCheck className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Mi Desempeño</SelectItem>
              <SelectItem value="general">Negocio General</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setShowExcelImporter(true)} title="Importar CSV/Excel">
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowPdfGenerator(true)} title="Exportar PDF">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bento View - Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Best Client */}
        <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-background cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => bestClient && handleClientClick(bestClient.id)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Mejor Cliente</p>
                <p className="text-lg font-bold truncate mt-0.5">{bestClient?.name || 'Sin datos'}</p>
                {bestClient && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-amber-600">${formatNumber(bestClient.totalSales)}</span>
                    {renderChangeIndicator(bestClient.trend)}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lowest Movement Client */}
        <Card className="relative overflow-hidden border-rose-500/30 bg-gradient-to-br from-rose-500/5 via-background to-background cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => lowestMovementClient && handleClientClick(lowestMovementClient.id)}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                <AlertCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Menor Movimiento</p>
                <p className="text-lg font-bold truncate mt-0.5">{lowestMovementClient?.name || 'Sin datos'}</p>
                {lowestMovementClient && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-rose-600">${formatNumber(lowestMovementClient.currentMonthSales)} este mes</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Productos Más Vendidos</p>
                <div className="mt-1 space-y-1">
                  {topProducts.length > 0 ? topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{i + 1}. {p.name}</span>
                      <span className="text-muted-foreground ml-2">${formatNumber(p.totalSales)}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Sin datos</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Growth Card - Most Important */}
      <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Current Month Sales */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Ventas Este Mes</p>
              <p className="text-4xl font-bold text-foreground">${formatNumber(analytics.currentMonthSales)}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">vs mes anterior:</span>
                {renderChangeIndicator(analytics.monthlyGrowth, 'lg')}
              </div>
              <p className="text-xs text-muted-foreground">
                Mes anterior: ${formatNumber(analytics.previousMonthSales)}
              </p>
            </div>
            
            {/* Current Month Commission */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Comisión Este Mes</p>
              <p className="text-4xl font-bold text-emerald-600">${formatNumber(analytics.currentMonthCommission)}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">vs mes anterior:</span>
                {renderChangeIndicator(analytics.commissionGrowth, 'lg')}
              </div>
              <p className="text-xs text-muted-foreground">
                Mes anterior: ${formatNumber(analytics.previousMonthCommission)}
              </p>
            </div>
            
            {/* Accumulated Totals */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Acumulado Total</p>
              <p className="text-4xl font-bold text-foreground">${formatNumber(analytics.totalSales)}</p>
              <p className="text-lg font-semibold text-emerald-600">
                Comisión: ${formatNumber(analytics.totalCommission)}
              </p>
              <p className="text-xs text-muted-foreground">
                {analytics.invoiceCount} facturas · ${formatNumber(analytics.avgTicket)} promedio
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Facturas</p>
                <p className="text-2xl font-bold">{analytics.invoiceCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Ticket Promedio</p>
                <p className="text-2xl font-bold">${formatNumber(analytics.avgTicket)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Clientes</p>
                <p className="text-2xl font-bold">{analytics.clientMetrics.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Productos</p>
                <p className="text-2xl font-bold">{analytics.productMetrics.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly Trend - MOST IMPORTANT */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolución Mensual (Ventas vs Comisión)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics.last12Months}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="monthLabel" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(16, 185, 129)"
                    fontSize={12}
                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [
                      `$${formatNumber(value)}`,
                      name === 'sales' ? 'Ventas' : 'Comisión'
                    ]}
                  />
                  <Legend formatter={(value) => value === 'sales' ? 'Ventas' : 'Comisión'} />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="sales" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#salesGradient)"
                    strokeWidth={2}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="commission" 
                    stroke="hsl(160, 84%, 39%)" 
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
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
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.productMetrics.slice(0, 5)}
                    dataKey="totalSales"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {analytics.productMetrics.slice(0, 5).map((_, idx) => (
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
              {analytics.productMetrics.slice(0, 5).map((p, idx) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate max-w-[120px]">{p.name}</span>
                  </div>
                  <span className="font-medium">${formatNumber(p.totalSales)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seller Performance (only in general view) */}
      {viewMode === 'general' && analytics.sellerMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Desempeño por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">Vendedor</th>
                    <th className="text-right py-2 px-3 font-medium">Facturas</th>
                    <th className="text-right py-2 px-3 font-medium">Ventas Totales</th>
                    <th className="text-right py-2 px-3 font-medium">Comisión</th>
                    <th className="text-right py-2 px-3 font-medium">Este Mes</th>
                    <th className="text-right py-2 px-3 font-medium">Crecimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.sellerMetrics.map((seller, idx) => (
                    <tr key={seller.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0 ? 'bg-amber-500/20 text-amber-600' :
                          idx === 1 ? 'bg-slate-400/20 text-slate-600' :
                          idx === 2 ? 'bg-orange-500/20 text-orange-600' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {idx + 1}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium">{seller.name}</td>
                      <td className="py-3 px-3 text-right">{seller.invoiceCount}</td>
                      <td className="py-3 px-3 text-right font-medium">${formatNumber(seller.totalSales)}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-medium">${formatNumber(seller.totalCommission)}</td>
                      <td className="py-3 px-3 text-right">${formatNumber(seller.currentMonthSales)}</td>
                      <td className="py-3 px-3 text-right">{renderChangeIndicator(seller.growth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Ranking de Clientes
                <span className="text-sm font-normal text-muted-foreground ml-2">(Clic para ver detalles)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th className="text-left py-2 px-3 font-medium">Cliente</th>
                      <th className="text-right py-2 px-3 font-medium">Facturas</th>
                      <th className="text-right py-2 px-3 font-medium">Productos</th>
                      <th className="text-right py-2 px-3 font-medium">Total</th>
                      <th className="text-right py-2 px-3 font-medium">Comisión</th>
                      <th className="text-right py-2 px-3 font-medium">Este Mes</th>
                      <th className="text-right py-2 px-3 font-medium">Tendencia</th>
                      <th className="text-center py-2 px-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.clientMetrics.slice(0, 15).map((client, idx) => (
                      <tr 
                        key={client.id} 
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleClientClick(client.id)}
                      >
                        <td className="py-3 px-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            idx === 0 ? 'bg-amber-500/20 text-amber-600' :
                            idx === 1 ? 'bg-slate-400/20 text-slate-600' :
                            idx === 2 ? 'bg-orange-500/20 text-orange-600' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium">{client.name}</td>
                        <td className="py-3 px-3 text-right">{client.invoiceCount}</td>
                        <td className="py-3 px-3 text-right">{client.productCount}</td>
                        <td className="py-3 px-3 text-right font-medium">${formatNumber(client.totalSales)}</td>
                        <td className="py-3 px-3 text-right text-emerald-600">${formatNumber(client.totalCommission)}</td>
                        <td className="py-3 px-3 text-right">${formatNumber(client.currentMonthSales)}</td>
                        <td className="py-3 px-3 text-right">{renderChangeIndicator(client.trend)}</td>
                        <td className="py-3 px-3 text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {analytics.clientMetrics.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay datos de clientes disponibles</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
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
                      <th className="text-right py-2 px-3 font-medium">Facturas</th>
                      <th className="text-right py-2 px-3 font-medium">Clientes</th>
                      <th className="text-right py-2 px-3 font-medium">Total Vendido</th>
                      <th className="text-right py-2 px-3 font-medium">Comisión</th>
                      <th className="text-right py-2 px-3 font-medium">Prom/Factura</th>
                      <th className="text-right py-2 px-3 font-medium">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.productMetrics.map(product => (
                      <tr key={product.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-3 font-medium">{product.name}</td>
                        <td className="py-3 px-3 text-right">{product.invoiceCount}</td>
                        <td className="py-3 px-3 text-right">{product.clientCount}</td>
                        <td className="py-3 px-3 text-right font-medium">${formatNumber(product.totalSales)}</td>
                        <td className="py-3 px-3 text-right text-emerald-600">${formatNumber(product.totalCommission)}</td>
                        <td className="py-3 px-3 text-right">${formatNumber(product.avgPerInvoice)}</td>
                        <td className="py-3 px-3 text-right">{renderChangeIndicator(product.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {analytics.productMetrics.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay datos de productos disponibles</p>
              )}
            </CardContent>
          </Card>

          {/* Product Performance Chart */}
          {analytics.productMetrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Comparativa de Productos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.productMetrics.slice(0, 8)} layout="vertical">
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
                      <Bar dataKey="totalSales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Growing Clients */}
            <Card className="border-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                  Clientes en Crecimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.growingClients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay clientes con crecimiento significativo
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.growingClients.map(c => (
                      <div 
                        key={c.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 cursor-pointer hover:bg-emerald-500/10 transition-colors"
                        onClick={() => handleClientClick(c.id)}
                      >
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.invoiceCount} facturas</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <ArrowUpRight className="h-4 w-4" />
                          +{c.trend.toFixed(1)}%
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
                {analytics.decliningClients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay clientes en riesgo significativo
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.decliningClients.map(c => (
                      <div 
                        key={c.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 cursor-pointer hover:bg-amber-500/10 transition-colors"
                        onClick={() => handleClientClick(c.id)}
                      >
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.invoiceCount} facturas</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <ArrowDownRight className="h-4 w-4" />
                          {c.trend.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Growing Products */}
            <Card className="border-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                  Productos en Alza
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.growingProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay productos con crecimiento significativo
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.growingProducts.map(p => (
                      <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.invoiceCount} facturas</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <ArrowUpRight className="h-4 w-4" />
                          +{p.trend.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Declining Products */}
            <Card className="border-rose-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-rose-600">
                  <TrendingDown className="h-5 w-5" />
                  Productos en Declive
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.decliningProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay productos en declive significativo
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.decliningProducts.map(p => (
                      <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.invoiceCount} facturas</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                          <ArrowDownRight className="h-4 w-4" />
                          {p.trend.toFixed(1)}%
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

      {/* PDF Generator */}
      <RealPDFGenerator
        open={showPdfGenerator}
        onOpenChange={setShowPdfGenerator}
        analytics={analytics}
        viewMode={viewMode}
        sellerName={activeSeller?.name}
      />

      {/* Excel Importer */}
      <ExcelImporter
        open={showExcelImporter}
        onOpenChange={setShowExcelImporter}
        onImport={bulkImport}
        clients={clients}
        products={products}
      />

      {/* Client Detail View */}
      {selectedClient && (
        <ClientDetailView
          open={!!selectedClient}
          onOpenChange={(open) => !open && setSelectedClient(null)}
          client={selectedClient}
          invoices={invoices}
        />
      )}
    </div>
  );
}
