import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, ChevronRight, Package, DollarSign, Gift } from 'lucide-react';
import { SellerMetrics, ProductStatus } from '@/hooks/useAnalyticsData';
import { formatNumber } from '@/lib/formatters';

interface SellersAreaProps {
  sellerMetrics: SellerMetrics[];
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

export function SellersArea({ sellerMetrics }: SellersAreaProps) {
  const [selectedSeller, setSelectedSeller] = useState<SellerMetrics | null>(null);

  const totalRevenue = sellerMetrics.reduce((sum, s) => sum + s.netRevenue, 0);
  const totalCommission = sellerMetrics.reduce((sum, s) => sum + s.correctCommission, 0);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-violet-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-700">{sellerMetrics.length}</p>
            <p className="text-xs text-muted-foreground">Vendedores Activos</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">RD${formatNumber(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Ingreso Total</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">RD${formatNumber(totalCommission)}</p>
            <p className="text-xs text-muted-foreground">Comisión Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Sellers Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 px-4 border-b shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vendedores
            <Badge variant="outline" className="ml-2">{sellerMetrics.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium">Vendedor</th>
                  <th className="text-right py-3 px-3 font-medium">Ingreso Real</th>
                  <th className="text-right py-3 px-3 font-medium">% Regalos</th>
                  <th className="text-right py-3 px-3 font-medium">Comisión Real</th>
                  <th className="text-center py-3 px-3 font-medium">Estado</th>
                  <th className="py-3 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sellerMetrics.map((seller) => (
                  <tr 
                    key={seller.id} 
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedSeller(seller)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {seller.name.charAt(0)}
                        </div>
                        <span className="font-medium">{seller.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">RD${formatNumber(seller.netRevenue)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      <span className={seller.giftPercentage > 20 ? 'text-amber-600 font-medium' : ''}>
                        {seller.giftPercentage.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">RD${formatNumber(seller.correctCommission)}</td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(seller.status)}</td>
                    <td className="py-3 px-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
                {sellerMetrics.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No hay vendedores con ventas en el período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Seller Detail Sheet */}
      <Sheet open={!!selectedSeller} onOpenChange={() => setSelectedSeller(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedSeller && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">{selectedSeller.name.charAt(0)}</span>
                  </div>
                  <div>
                    <span className="block">{selectedSeller.name}</span>
                    <span className="text-sm font-normal text-muted-foreground">Detalle del vendedor</span>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                    <DollarSign className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
                    <p className="text-lg font-bold">RD${formatNumber(selectedSeller.netRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Ingreso Real</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                    <DollarSign className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                    <p className="text-lg font-bold">RD${formatNumber(selectedSeller.correctCommission)}</p>
                    <p className="text-xs text-muted-foreground">Comisión Real</p>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-500/10 text-center">
                    <Package className="h-4 w-4 mx-auto text-violet-600 mb-1" />
                    <p className="text-lg font-bold">{formatNumber(selectedSeller.soldUnits)}</p>
                    <p className="text-xs text-muted-foreground">Unidades Vendidas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                    <Gift className="h-4 w-4 mx-auto text-amber-600 mb-1" />
                    <p className="text-lg font-bold">{formatNumber(selectedSeller.giftedUnits)}</p>
                    <p className="text-xs text-muted-foreground">Unidades Regaladas</p>
                  </div>
                </div>

                {/* Gift Impact */}
                <div className={`p-4 rounded-lg border ${selectedSeller.giftPercentage > 25 ? 'border-rose-500/50 bg-rose-500/5' : 'bg-muted/30'}`}>
                  <p className="font-medium text-sm mb-1">Impacto en Margen</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSeller.giftPercentage > 25 
                      ? `Este vendedor tiene un alto porcentaje de regalos (${selectedSeller.giftPercentage.toFixed(0)}%). Esto puede estar afectando el margen del negocio.`
                      : selectedSeller.giftPercentage > 15
                      ? `El porcentaje de regalos está en un nivel moderado (${selectedSeller.giftPercentage.toFixed(0)}%). Se recomienda monitorear.`
                      : `El porcentaje de regalos está controlado (${selectedSeller.giftPercentage.toFixed(0)}%). Buen desempeño.`
                    }
                  </p>
                </div>

                {/* Products sold */}
                {selectedSeller.productsData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Productos Vendidos
                    </h4>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {selectedSeller.productsData.map((prod) => (
                          <div 
                            key={prod.name} 
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                          >
                            <span className="font-medium text-sm truncate flex-1">{prod.name}</span>
                            <div className="text-right text-sm flex items-center gap-3">
                              <span className="text-muted-foreground">{formatNumber(prod.sold)}v / {formatNumber(prod.gifted)}r</span>
                              <span className="font-medium">RD${formatNumber(prod.revenue)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Clients served */}
                {selectedSeller.clientsServed.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes Atendidos ({selectedSeller.clientsServed.length})
                    </h4>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {selectedSeller.clientsServed.map((client, i) => (
                          <div 
                            key={client.id} 
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                              <span className="font-medium text-sm truncate max-w-40">{client.name}</span>
                            </div>
                            <span className="font-medium text-sm">RD${formatNumber(client.revenue)}</span>
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
