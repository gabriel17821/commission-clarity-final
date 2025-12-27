import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, ChevronRight, Package, BarChart3, TrendingUp, MapPin } from 'lucide-react';
import { ClientMetrics, ProductStatus } from '@/hooks/useAnalyticsData';
import { formatNumber } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface ClientsAreaProps {
  clientMetrics: ClientMetrics[];
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

export function ClientsArea({ clientMetrics }: ClientsAreaProps) {
  const [selectedClient, setSelectedClient] = useState<ClientMetrics | null>(null);

  const totalRevenue = clientMetrics.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalClients = clientMetrics.length;
  const avgTicket = totalClients > 0 ? totalRevenue / clientMetrics.reduce((sum, c) => sum + c.invoiceCount, 0) : 0;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-violet-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-700">{totalClients}</p>
            <p className="text-xs text-muted-foreground">Clientes Activos</p>
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
            <p className="text-2xl font-bold text-blue-700">RD${formatNumber(avgTicket)}</p>
            <p className="text-xs text-muted-foreground">Ticket Promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 px-4 border-b shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Clientes
            <Badge variant="outline" className="ml-2">{clientMetrics.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium">Cliente</th>
                  <th className="text-right py-3 px-3 font-medium">Ingreso</th>
                  <th className="text-right py-3 px-3 font-medium">Unidades</th>
                  <th className="text-right py-3 px-3 font-medium">Ticket Prom.</th>
                  <th className="text-center py-3 px-3 font-medium">Estado</th>
                  <th className="py-3 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {clientMetrics.map((client) => (
                  <tr 
                    key={client.id} 
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedClient(client)}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium truncate max-w-48">{client.name}</p>
                        {client.province && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {client.province}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">RD${formatNumber(client.totalRevenue)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatNumber(client.totalUnits)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">RD${formatNumber(client.avgTicket)}</td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(client.status)}</td>
                    <td className="py-3 px-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
                {clientMetrics.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No hay clientes en el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Client Detail Sheet */}
      <Sheet open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedClient && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="block">{selectedClient.name}</span>
                    <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                      {selectedClient.province && (
                        <>
                          <MapPin className="h-3 w-3" />
                          {selectedClient.province}
                        </>
                      )}
                    </span>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                    <p className="text-lg font-bold">RD${formatNumber(selectedClient.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Total Comprado</p>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-500/10 text-center">
                    <p className="text-lg font-bold">{selectedClient.invoiceCount}</p>
                    <p className="text-xs text-muted-foreground">Facturas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                    <p className="text-lg font-bold">{formatNumber(selectedClient.totalUnits)}</p>
                    <p className="text-xs text-muted-foreground">Unidades</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                    <p className="text-lg font-bold">RD${formatNumber(selectedClient.avgTicket)}</p>
                    <p className="text-xs text-muted-foreground">Ticket Promedio</p>
                  </div>
                </div>

                {/* Products purchased */}
                {selectedClient.productsData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Productos Comprados
                    </h4>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {selectedClient.productsData.map((prod, i) => (
                          <div 
                            key={prod.name} 
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                              <span className="font-medium text-sm truncate max-w-40">{prod.name}</span>
                            </div>
                            <div className="text-right text-sm">
                              <span className="font-medium">RD${formatNumber(prod.revenue)}</span>
                              <span className="text-muted-foreground ml-2">({formatNumber(prod.quantity)}u)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Monthly Chart */}
                {selectedClient.monthlyData.length > 1 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Evolución de Compras
                    </h4>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedClient.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 10 }} 
                            tickFormatter={(val) => {
                              const [year, month] = val.split('-');
                              return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM', { locale: es });
                            }}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip 
                            formatter={(value: number) => [`RD$${formatNumber(value)}`, 'Ingreso']}
                            labelFormatter={(label) => {
                              const [year, month] = label.split('-');
                              return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
                            }}
                          />
                          <Bar 
                            dataKey="revenue" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
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
