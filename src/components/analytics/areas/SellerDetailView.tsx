import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, Users, Package, DollarSign, TrendingUp, 
  Gift, AlertTriangle, BarChart3, Target, Percent
} from 'lucide-react';
import { SellerMetrics, ProductStatus } from '@/hooks/useAnalyticsData';
import { formatNumber } from '@/lib/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

interface SellerDetailViewProps {
  seller: SellerMetrics;
  onBack: () => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(262, 83%, 58%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(199, 89%, 48%)'];

const getStatusBadge = (status: ProductStatus) => {
  switch (status) {
    case 'healthy':
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">🟢 Rendimiento Saludable</Badge>;
    case 'watch':
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">🟡 Monitorear</Badge>;
    case 'danger':
      return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">🔴 Alto Riesgo</Badge>;
  }
};

export function SellerDetailView({ seller, onBack }: SellerDetailViewProps) {
  // Calculate additional metrics
  const totalUnits = seller.soldUnits + seller.giftedUnits;
  const efficiencyRate = totalUnits > 0 ? (seller.soldUnits / totalUnits * 100) : 100;
  const giftValue = seller.productsData.reduce((sum, p) => {
    const avgPrice = p.sold > 0 ? p.revenue / p.sold : 0;
    return sum + (avgPrice * p.gifted);
  }, 0);
  
  // Prepare chart data
  const productChartData = seller.productsData.slice(0, 10).map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
    vendido: p.sold,
    regalado: p.gifted,
    revenue: p.revenue
  }));

  const pieData = seller.productsData.slice(0, 5).map(p => ({
    name: p.name,
    value: p.revenue
  }));

  // Client distribution data
  const clientChartData = seller.clientsServed.slice(0, 10).map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name,
    revenue: c.revenue
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">{seller.name.charAt(0)}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{seller.name}</h1>
            <p className="text-muted-foreground text-sm">
              {seller.clientsServed.length} clientes atendidos
            </p>
          </div>
          {getStatusBadge(seller.status)}
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
                    <p className="text-2xl font-bold">RD${formatNumber(seller.netRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Ingreso Neto Real</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">RD${formatNumber(seller.correctCommission)}</p>
                    <p className="text-xs text-muted-foreground">Comisión Real</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500/10 to-violet-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Package className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(seller.soldUnits)}</p>
                    <p className="text-xs text-muted-foreground">Unidades Vendidas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(seller.giftedUnits)}</p>
                    <p className="text-xs text-muted-foreground">Unidades Regaladas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className={`${seller.giftPercentage > 25 ? 'border-rose-500/50' : 'border-0'}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                  seller.giftPercentage > 25 ? 'bg-rose-500/20' : 
                  seller.giftPercentage > 15 ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                }`}>
                  <Percent className={`h-6 w-6 ${
                    seller.giftPercentage > 25 ? 'text-rose-600' : 
                    seller.giftPercentage > 15 ? 'text-amber-600' : 'text-emerald-600'
                  }`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{seller.giftPercentage.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Porcentaje Regalado</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{efficiencyRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Tasa de Eficiencia</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-rose-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">RD${formatNumber(giftValue)}</p>
                  <p className="text-xs text-muted-foreground">Valor de Regalos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gift Impact Alert */}
          {seller.giftPercentage > 20 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-700">Alerta de Regalos</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      El porcentaje de regalos de este vendedor ({seller.giftPercentage.toFixed(1)}%) está por encima del umbral recomendado (20%).
                      Esto representa un impacto estimado de <strong>RD${formatNumber(giftValue)}</strong> en el margen.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Products Sold vs Gifted */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Vendido vs Regalado por Producto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {productChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="vendido" stackId="a" fill="hsl(var(--primary))" name="Vendido" />
                        <Bar dataKey="regalado" stackId="a" fill="hsl(38, 92%, 50%)" name="Regalado" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Sin datos de productos
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Revenue Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Distribución de Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
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
                          label={({ name, percent }) => `${name.slice(0, 10)}${name.length > 10 ? '..' : ''} (${(percent * 100).toFixed(0)}%)`}
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
                      Sin datos
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
                Productos Vendidos
                <Badge variant="outline" className="ml-2">{seller.productsData.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium">#</th>
                      <th className="text-left py-3 px-4 font-medium">Producto</th>
                      <th className="text-right py-3 px-4 font-medium">Vendidas</th>
                      <th className="text-right py-3 px-4 font-medium">Regaladas</th>
                      <th className="text-right py-3 px-4 font-medium">% Regalo</th>
                      <th className="text-right py-3 px-4 font-medium">Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seller.productsData.map((prod, i) => {
                      const totalProd = prod.sold + prod.gifted;
                      const giftPct = totalProd > 0 ? (prod.gifted / totalProd * 100) : 0;
                      return (
                        <tr key={prod.name} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-3 px-4 font-medium">{prod.name}</td>
                          <td className="py-3 px-4 text-right tabular-nums">{formatNumber(prod.sold)}</td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span className={prod.gifted > 0 ? 'text-amber-600' : ''}>{formatNumber(prod.gifted)}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge variant={giftPct > 30 ? 'destructive' : giftPct > 15 ? 'secondary' : 'outline'}>
                              {giftPct.toFixed(0)}%
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">RD${formatNumber(prod.revenue)}</td>
                        </tr>
                      );
                    })}
                    {seller.productsData.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          Sin productos vendidos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Clients Served */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Clientes Atendidos
                <Badge variant="outline" className="ml-2">{seller.clientsServed.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientChartData.length > 0 && (
                <div className="h-48 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => [`RD$${formatNumber(value)}`, 'Ingreso']} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium">#</th>
                      <th className="text-left py-3 px-4 font-medium">Cliente</th>
                      <th className="text-right py-3 px-4 font-medium">Ingreso</th>
                      <th className="text-right py-3 px-4 font-medium">% del Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seller.clientsServed.map((client, i) => {
                      const pct = seller.netRevenue > 0 ? (client.revenue / seller.netRevenue * 100) : 0;
                      return (
                        <tr key={client.id} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-3 px-4 font-medium">{client.name}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">RD${formatNumber(client.revenue)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full" 
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {seller.clientsServed.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          Sin clientes atendidos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Resumen del Vendedor
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Unidades:</span>
                    <span className="font-medium">{formatNumber(totalUnits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Eficiencia:</span>
                    <span className="font-medium">{efficiencyRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Productos distintos:</span>
                    <span className="font-medium">{seller.productsData.length}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clientes atendidos:</span>
                    <span className="font-medium">{seller.clientsServed.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor regalos:</span>
                    <span className="font-medium text-amber-600">RD${formatNumber(giftValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingreso promedio/cliente:</span>
                    <span className="font-medium">
                      RD${formatNumber(seller.clientsServed.length > 0 ? seller.netRevenue / seller.clientsServed.length : 0)}
                    </span>
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
