import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, Users, Package, DollarSign, Calendar, TrendingUp, 
  MapPin, FileText, ShoppingCart, BarChart3, Gift
} from 'lucide-react';
import { ClientMetrics, ProductStatus } from '@/hooks/useAnalyticsData';
import { formatNumber } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

interface ClientDetailViewProps {
  client: ClientMetrics;
  onBack: () => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(262, 83%, 58%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(199, 89%, 48%)'];

const getStatusBadge = (status: ProductStatus) => {
  switch (status) {
    case 'healthy':
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">🟢 Cliente Saludable</Badge>;
    case 'watch':
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">🟡 Requiere Atención</Badge>;
    case 'danger':
      return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">🔴 Cliente en Riesgo</Badge>;
  }
};

export function ClientDetailView({ client, onBack }: ClientDetailViewProps) {
  // Calculate additional metrics
  const totalProducts = client.productsData.length;
  const topProduct = client.productsData[0];
  const avgProductRevenue = totalProducts > 0 ? client.totalRevenue / totalProducts : 0;
  
  // Prepare pie chart data
  const pieData = client.productsData.slice(0, 5).map(p => ({
    name: p.name,
    value: p.revenue
  }));
  
  // Monthly trend
  const revenueGrowth = client.monthlyData.length >= 2 
    ? ((client.monthlyData[client.monthlyData.length - 1]?.revenue || 0) - 
       (client.monthlyData[client.monthlyData.length - 2]?.revenue || 0)) 
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              {client.province && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {client.province}
                </span>
              )}
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {client.invoiceCount} facturas
              </span>
            </div>
          </div>
          {getStatusBadge(client.status)}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="py-6 space-y-6">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">RD${formatNumber(client.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Ingreso Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500/10 to-violet-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(client.totalUnits)}</p>
                    <p className="text-xs text-muted-foreground">Unidades Compradas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">RD${formatNumber(client.avgTicket)}</p>
                    <p className="text-xs text-muted-foreground">Ticket Promedio</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Package className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalProducts}</p>
                    <p className="text-xs text-muted-foreground">Productos Distintos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Revenue Evolution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Evolución de Compras
                  {revenueGrowth !== 0 && (
                    <Badge variant={revenueGrowth > 0 ? 'default' : 'destructive'} className="ml-auto text-xs">
                      {revenueGrowth > 0 ? '+' : ''}{formatNumber(revenueGrowth)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  {client.monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={client.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 11 }} 
                          tickFormatter={(val) => {
                            const [year, month] = val.split('-');
                            return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yy', { locale: es });
                          }}
                        />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip 
                          formatter={(value: number) => [`RD$${formatNumber(value)}`, 'Ingreso']}
                          labelFormatter={(label) => {
                            const [year, month] = label.split('-');
                            return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
                          }}
                        />
                        <Line 
                          type="monotone"
                          dataKey="revenue" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Sin datos de evolución
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Products Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Distribución de Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name.slice(0, 12)}${name.length > 12 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`RD$${formatNumber(value)}`, 'Ingreso']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Sin datos de productos
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Productos Comprados
                <Badge variant="outline" className="ml-2">{client.productsData.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium">#</th>
                      <th className="text-left py-3 px-4 font-medium">Producto</th>
                      <th className="text-right py-3 px-4 font-medium">Cantidad</th>
                      <th className="text-right py-3 px-4 font-medium">Ingreso</th>
                      <th className="text-right py-3 px-4 font-medium">% del Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.productsData.map((prod, i) => {
                      const percentage = client.totalRevenue > 0 ? (prod.revenue / client.totalRevenue * 100) : 0;
                      return (
                        <tr key={prod.name} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-3 px-4 font-medium">{prod.name}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{formatNumber(prod.quantity)}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">RD${formatNumber(prod.revenue)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10">{percentage.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {client.productsData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Este cliente no tiene productos comprados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Breakdown */}
          {client.monthlyData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Desglose Mensual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={client.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 11 }} 
                        tickFormatter={(val) => {
                          const [year, month] = val.split('-');
                          return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yy', { locale: es });
                        }}
                      />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? `RD$${formatNumber(value)}` : formatNumber(value), 
                          name === 'revenue' ? 'Ingreso' : 'Unidades'
                        ]}
                        labelFormatter={(label) => {
                          const [year, month] = label.split('-');
                          return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ingreso" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Insights */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Resumen del Cliente
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Producto más comprado:</span>
                    <span className="font-medium">{topProduct?.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingreso promedio por producto:</span>
                    <span className="font-medium">RD${formatNumber(avgProductRevenue)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de facturas:</span>
                    <span className="font-medium">{client.invoiceCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unidades totales:</span>
                    <span className="font-medium">{formatNumber(client.totalUnits)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
