import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, ChevronRight } from 'lucide-react';
import { SellerMetrics, ProductStatus } from '@/hooks/useAnalyticsData';
import { formatNumber } from '@/lib/formatters';
import { SellerDetailView } from './SellerDetailView';

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

  // If a seller is selected, show the full detail view
  if (selectedSeller) {
    return <SellerDetailView seller={selectedSeller} onBack={() => setSelectedSeller(null)} />;
  }

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
    </div>
  );
}
