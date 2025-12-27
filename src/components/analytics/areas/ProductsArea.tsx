import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, ChevronRight, Users, BarChart3, AlertTriangle, TrendingDown } from 'lucide-react';
import { ProductMetrics, ProductStatus } from '@/hooks/useAnalyticsData';
import { formatNumber } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface ProductsAreaProps {
  productMetrics: ProductMetrics[];
  totalNetRevenue: number;
  totalSoldUnits: number;
  totalGiftedUnits: number;
  totalGiftValue: number;
}

const getStatusBadge = (status: ProductStatus) => {
  switch (status) {
    case 'healthy':
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-xs">🟢</Badge>;
    case 'watch':
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-xs">🟡</Badge>;
    case 'danger':
      return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-xs">🔴</Badge>;
  }
};

export function ProductsArea({ productMetrics, totalNetRevenue, totalSoldUnits, totalGiftedUnits, totalGiftValue }: ProductsAreaProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductMetrics | null>(null);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">RD${formatNumber(totalNetRevenue)}</p>
            <p className="text-xs text-muted-foreground">Ingreso Neto</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-violet-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-700">{formatNumber(totalSoldUnits)}</p>
            <p className="text-xs text-muted-foreground">Unidades Vendidas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-amber-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{formatNumber(totalGiftedUnits)}</p>
            <p className="text-xs text-muted-foreground">Unidades Regaladas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-rose-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-rose-700">RD${formatNumber(totalGiftValue)}</p>
            <p className="text-xs text-muted-foreground">Pérdida Ofertas</p>
          </CardContent>
        </Card>
      </div>

      {/* Products Table - MAIN ELEMENT */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 px-4 border-b shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Tabla de Productos
            <Badge variant="outline" className="ml-2">{productMetrics.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium">Producto</th>
                  <th className="text-right py-3 px-3 font-medium">Vendidas</th>
                  <th className="text-right py-3 px-3 font-medium">Regaladas</th>
                  <th className="text-right py-3 px-3 font-medium">Ingreso Neto</th>
                  <th className="text-right py-3 px-3 font-medium">Impacto</th>
                  <th className="text-center py-3 px-3 font-medium">Estado</th>
                  <th className="py-3 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {productMetrics.map((product) => (
                  <tr 
                    key={product.name} 
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <td className="py-3 px-4 font-medium truncate max-w-48">{product.name}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatNumber(product.soldUnits)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-amber-600">
                      {product.giftedUnits > 0 ? formatNumber(product.giftedUnits) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">RD${formatNumber(product.netRevenue)}</td>
                    <td className="py-3 px-3 text-right">
                      {product.marginImpact > 0 && (
                        <span className={product.marginImpact > 15 ? 'text-rose-600 font-medium' : 'text-muted-foreground'}>
                          -{product.marginImpact.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(product.status)}</td>
                    <td className="py-3 px-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
                {productMetrics.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No hay productos en el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Product Detail Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedProduct && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="block">{selectedProduct.name}</span>
                    <span className="text-sm font-normal text-muted-foreground">Detalle del producto</span>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                    <p className="text-lg font-bold">{formatNumber(selectedProduct.soldUnits)}</p>
                    <p className="text-xs text-muted-foreground">Vendidas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                    <p className="text-lg font-bold">{formatNumber(selectedProduct.giftedUnits)}</p>
                    <p className="text-xs text-muted-foreground">Regaladas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                    <p className="text-lg font-bold">RD${formatNumber(selectedProduct.netRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Ingreso Neto</p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-500/10 text-center">
                    <p className="text-lg font-bold flex items-center justify-center gap-1">
                      <TrendingDown className="h-4 w-4" />
                      {selectedProduct.marginImpact.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Impacto Margen</p>
                  </div>
                </div>

                {/* Diagnosis */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedProduct.status === 'danger' && <AlertTriangle className="h-4 w-4 text-rose-600" />}
                    <span className="font-medium text-sm">Diagnóstico</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedProduct.status === 'healthy' && 'Este producto tiene un margen saludable y no genera preocupación.'}
                    {selectedProduct.status === 'watch' && 'Este producto requiere vigilancia. El porcentaje de regalos o impacto en margen está elevándose.'}
                    {selectedProduct.status === 'danger' && 'Este producto está afectando significativamente el margen. Se recomienda revisar la política de ofertas.'}
                  </p>
                </div>

                {/* Temporal Chart */}
                {selectedProduct.dailyData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Evolución Temporal
                    </h4>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedProduct.dailyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }} 
                            tickFormatter={(val) => format(new Date(val), 'dd/MM')}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              formatNumber(value),
                              name === 'sold' ? 'Vendidas' : name === 'gifted' ? 'Regaladas' : 'Ingreso'
                            ]}
                            labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy', { locale: es })}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="sold" 
                            stackId="1"
                            stroke="hsl(142, 76%, 36%)" 
                            fill="hsl(142, 76%, 36%)" 
                            fillOpacity={0.6}
                            name="sold"
                          />
                          <Area 
                            type="monotone" 
                            dataKey="gifted" 
                            stackId="1"
                            stroke="hsl(45, 93%, 47%)" 
                            fill="hsl(45, 93%, 47%)" 
                            fillOpacity={0.6}
                            name="gifted"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Clients who bought */}
                {selectedProduct.clients.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes ({selectedProduct.clients.length})
                    </h4>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {selectedProduct.clients.map((client, i) => (
                          <div 
                            key={client.id} 
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                              <span className="font-medium text-sm truncate max-w-40">{client.name}</span>
                            </div>
                            <div className="text-right text-sm">
                              <span className="font-medium">RD${formatNumber(client.revenue)}</span>
                              <span className="text-muted-foreground ml-2">({formatNumber(client.units)}u)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
