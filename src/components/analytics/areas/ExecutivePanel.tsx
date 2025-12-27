import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Package, Gift, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';

interface ExecutivePanelProps {
  totalNetRevenue: number;
  totalSoldUnits: number;
  totalGiftedUnits: number;
  totalGiftValue: number;
  anomalies: string[];
}

export function ExecutivePanel({ 
  totalNetRevenue, 
  totalSoldUnits, 
  totalGiftedUnits, 
  totalGiftValue,
  anomalies 
}: ExecutivePanelProps) {
  const giftPercentage = (totalSoldUnits + totalGiftedUnits) > 0 
    ? (totalGiftedUnits / (totalSoldUnits + totalGiftedUnits)) * 100 
    : 0;

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Title */}
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold text-foreground">Panel Ejecutivo</h2>
        <p className="text-muted-foreground">Visión rápida del negocio</p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-emerald-700">RD${formatNumber(totalNetRevenue)}</p>
            <p className="text-sm text-muted-foreground mt-1">Ingreso Neto Real</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5">
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
              <Package className="h-6 w-6 text-violet-600" />
            </div>
            <p className="text-3xl font-bold text-violet-700">{formatNumber(totalSoldUnits)}</p>
            <p className="text-sm text-muted-foreground mt-1">Unidades Vendidas</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5">
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <Gift className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-amber-700">{giftPercentage.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground mt-1">Porcentaje Regalos</p>
            <p className="text-xs text-muted-foreground">{formatNumber(totalGiftedUnits)} unidades</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-rose-500/10 to-rose-500/5">
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="h-6 w-6 text-rose-600" />
            </div>
            <p className="text-3xl font-bold text-rose-700">RD${formatNumber(totalGiftValue)}</p>
            <p className="text-sm text-muted-foreground mt-1">Pérdida por Ofertas</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {anomalies.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5 max-w-2xl mx-auto w-full">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 mb-2">Alertas Críticas</p>
                <div className="space-y-1.5">
                  {anomalies.map((anomaly, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                        !
                      </Badge>
                      <p className="text-sm text-amber-800">{anomaly}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {anomalies.length === 0 && (
        <Card className="border-emerald-500/50 bg-emerald-500/5 max-w-2xl mx-auto w-full">
          <CardContent className="p-4 text-center">
            <p className="text-emerald-700 font-medium">Sin alertas críticas en este período</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
