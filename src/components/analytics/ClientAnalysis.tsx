import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Search, ChevronRight, User, DollarSign, Package, Calendar,
  TrendingUp, TrendingDown, Minus, ArrowLeft, ShoppingBag, Target,
  ArrowUpRight, ArrowDownRight, Clock, Award
} from 'lucide-react';
import { parseISO, isWithinInterval, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { formatNumber } from '@/lib/formatters';

interface ClientAnalysisProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  dateRange: { from: Date; to: Date };
  initialClient?: Client | null;
  onClose?: () => void;
}

interface ClientMetrics {
  client: Client;
  totalSales: number;
  totalCommission: number;
  invoiceCount: number;
  avgTicket: number;
  lastInvoiceDate: Date | null;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface ClientProductData {
  name: string;
  quantity: number;
  revenue: number;
  percentOfTotal: number;
  color: string;
}

export function ClientAnalysis({ 
  invoices, 
  clients, 
  products, 
  dateRange, 
  initialClient,
  onClose 
}: ClientAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(initialClient || null);

  // Calculate metrics for all clients
  const clientMetrics = useMemo(() => {
    const periodDays = differenceInDays(dateRange.to, dateRange.from);
    const previousStart = new Date(dateRange.from);
    previousStart.setDate(previousStart.getDate() - periodDays - 1);
    const previousEnd = new Date(dateRange.from);
    previousEnd.setDate(previousEnd.getDate() - 1);

    return clients.map(client => {
      const clientInvoices = invoices.filter(inv => {
        if (inv.client_id !== client.id) return false;
        const invDate = parseISO(inv.invoice_date);
        return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
      });

      const previousInvoices = invoices.filter(inv => {
        if (inv.client_id !== client.id) return false;
        const invDate = parseISO(inv.invoice_date);
        return isWithinInterval(invDate, { start: previousStart, end: previousEnd });
      });

      const totalSales = clientInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const totalCommission = clientInvoices.reduce((sum, inv) => sum + inv.total_commission, 0);
      const invoiceCount = clientInvoices.length;
      const avgTicket = invoiceCount > 0 ? totalSales / invoiceCount : 0;

      const previousSales = previousInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendPercent = 0;
      if (previousSales > 0 && totalSales > 0) {
        trendPercent = ((totalSales - previousSales) / previousSales) * 100;
        trend = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable';
      } else if (totalSales > 0 && previousSales === 0) {
        trend = 'up';
        trendPercent = 100;
      }

      let lastInvoiceDate: Date | null = null;
      if (clientInvoices.length > 0) {
        const dates = clientInvoices.map(inv => parseISO(inv.invoice_date));
        lastInvoiceDate = dates.sort((a, b) => b.getTime() - a.getTime())[0];
      }

      return {
        client,
        totalSales,
        totalCommission,
        invoiceCount,
        avgTicket,
        lastInvoiceDate,
        trend,
        trendPercent
      } as ClientMetrics;
    }).filter(m => m.totalSales > 0 || searchTerm)
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [clients, invoices, dateRange, searchTerm]);

  // Filter by search
  const filteredClients = useMemo(() => {
    if (!searchTerm) return clientMetrics;
    const term = searchTerm.toLowerCase();
    return clientMetrics.filter(m => 
      m.client.name.toLowerCase().includes(term) ||
      m.client.province?.toLowerCase().includes(term)
    );
  }, [clientMetrics, searchTerm]);

  // Selected client details
  const clientDetails = useMemo(() => {
    if (!selectedClient) return null;

    const clientInvoices = invoices.filter(inv => {
      if (inv.client_id !== selectedClient.id) return false;
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });

    // Product breakdown
    const productMap = new Map<string, { quantity: number; revenue: number; color: string }>();
    clientInvoices.forEach(inv => {
      inv.products?.forEach(prod => {
        const existing = productMap.get(prod.product_name) || { quantity: 0, revenue: 0, color: '#6366f1' };
        existing.quantity += (prod.quantity_sold || 1);
        existing.revenue += prod.amount;
        const catalogProduct = products.find(p => p.name === prod.product_name);
        if (catalogProduct) existing.color = catalogProduct.color;
        productMap.set(prod.product_name, existing);
      });
    });

    const totalRevenue = Array.from(productMap.values()).reduce((sum, p) => sum + p.revenue, 0);
    
    const productData: ClientProductData[] = Array.from(productMap.entries())
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue,
        percentOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        color: data.color
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const favoriteProduct = productData[0];

    // Invoice history
    const history = clientInvoices
      .map(inv => ({
        id: inv.id,
        date: parseISO(inv.invoice_date),
        amount: inv.total_amount,
        commission: inv.total_commission,
        products: inv.products?.length || 0
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    // Metrics
    const metrics = clientMetrics.find(m => m.client.id === selectedClient.id);

    return {
      products: productData,
      favoriteProduct,
      history,
      metrics,
      totalRevenue,
      totalQuantity: productData.reduce((sum, p) => sum + p.quantity, 0)
    };
  }, [selectedClient, invoices, products, dateRange, clientMetrics]);

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

  // Client Detail View
  if (selectedClient && clientDetails) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            setSelectedClient(null);
            if (onClose) onClose();
          }}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        {/* Client Header */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{selectedClient.name}</h3>
            <p className="text-sm text-muted-foreground">
              {selectedClient.province || 'Sin provincia'} • {clientDetails.history.length} facturas en período
            </p>
          </div>
          {clientDetails.metrics && renderTrendBadge(clientDetails.metrics.trend, clientDetails.metrics.trendPercent)}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Total Comprado</span>
              </div>
              <p className="text-2xl font-bold">${formatNumber(clientDetails.totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Ticket Promedio</span>
              </div>
              <p className="text-2xl font-bold">${formatNumber(clientDetails.metrics?.avgTicket || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-4 w-4 text-violet-600" />
                <span className="text-xs text-muted-foreground">Unidades</span>
              </div>
              <p className="text-2xl font-bold">{clientDetails.totalQuantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-muted-foreground">Última Compra</span>
              </div>
              <p className="text-lg font-bold">
                {clientDetails.metrics?.lastInvoiceDate 
                  ? format(clientDetails.metrics.lastInvoiceDate, 'dd MMM', { locale: es })
                  : 'N/A'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Favorite Product */}
        {clientDetails.favoriteProduct && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase">Producto Favorito</p>
                  <p className="font-bold text-lg">{clientDetails.favoriteProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {clientDetails.favoriteProduct.quantity} uds • ${formatNumber(clientDetails.favoriteProduct.revenue)} • {clientDetails.favoriteProduct.percentOfTotal.toFixed(1)}% del total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Products Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Productos Comprados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={clientDetails.products.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => `$${formatNumber(v)}`} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.length > 12 ? v.substring(0, 12) + '...' : v}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card border rounded-lg p-2 shadow-lg">
                            <p className="font-semibold text-sm">{data.name}</p>
                            <p className="text-sm">{data.quantity} unidades</p>
                            <p className="text-sm">${formatNumber(data.revenue)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Invoice History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Historial de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {clientDetails.history.length > 0 ? (
                    clientDetails.history.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{format(inv.date, 'dd MMM yyyy', { locale: es })}</p>
                          <p className="text-xs text-muted-foreground">{inv.products} productos</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${formatNumber(inv.amount)}</p>
                          <p className="text-xs text-emerald-600">Com: ${formatNumber(inv.commission)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sin facturas en el período</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Product Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalle de Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Producto</th>
                    <th className="text-right py-2 font-medium">Cantidad</th>
                    <th className="text-right py-2 font-medium">Total</th>
                    <th className="text-right py-2 font-medium">% del Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clientDetails.products.map(prod => (
                    <tr key={prod.name} className="border-b border-border/50">
                      <td className="py-2">{prod.name}</td>
                      <td className="text-right py-2">{prod.quantity}</td>
                      <td className="text-right py-2">${formatNumber(prod.revenue)}</td>
                      <td className="text-right py-2">{prod.percentOfTotal.toFixed(1)}%</td>
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

  // Client List View
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
          <User className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Análisis por Cliente</h3>
          <p className="text-sm text-muted-foreground">Selecciona un cliente para ver su perfil completo</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cliente por nombre o provincia..."
          className="pl-10 h-12"
        />
      </div>

      {/* Client List */}
      <div className="space-y-2">
        {filteredClients.length > 0 ? (
          filteredClients.map(metric => (
            <button
              key={metric.client.id}
              onClick={() => setSelectedClient(metric.client)}
              className="w-full p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">{metric.client.name}</p>
                    {renderTrendBadge(metric.trend, metric.trendPercent)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {metric.client.province || 'Sin provincia'} • {metric.invoiceCount} factura{metric.invoiceCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${formatNumber(metric.totalSales)}</p>
                  <p className="text-xs text-muted-foreground">Ticket: ${formatNumber(metric.avgTicket)}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No se encontraron clientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
