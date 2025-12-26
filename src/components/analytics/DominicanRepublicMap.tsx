import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MapPin, Users, DollarSign, Package, TrendingUp, TrendingDown,
  ChevronRight, ArrowLeft, AlertTriangle, Calendar
} from 'lucide-react';
import { parseISO, isWithinInterval, subDays } from 'date-fns';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { formatNumber } from '@/lib/formatters';
import { PROVINCES, normalizeProvinceName } from '@/lib/dominicanProvinces';

interface DominicanRepublicMapProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  dateRange: { from: Date; to: Date };
  onClientSelect: (client: Client) => void;
}

interface ProvinceStats {
  name: string;
  clientCount: number;
  totalSales: number;
  invoiceCount: number;
  topProducts: { name: string; amount: number }[];
  topClients: { id: string; name: string; sales: number }[];
  inactiveClients: Client[];
}

export function DominicanRepublicMap({ 
  invoices, 
  clients, 
  products, 
  dateRange,
  onClientSelect 
}: DominicanRepublicMapProps) {
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // Calculate stats per province
  const provinceStats = useMemo(() => {
    const stats = new Map<string, ProvinceStats>();

    // Initialize with all provinces
    PROVINCES.forEach(p => {
      stats.set(p.name, {
        name: p.name,
        clientCount: 0,
        totalSales: 0,
        invoiceCount: 0,
        topProducts: [],
        topClients: [],
        inactiveClients: []
      });
    });

    // Add "Sin Provincia" for clients without province
    stats.set('Sin Provincia', {
      name: 'Sin Provincia',
      clientCount: 0,
      totalSales: 0,
      invoiceCount: 0,
      topProducts: [],
      topClients: [],
      inactiveClients: []
    });

    // Group clients by province
    const clientsByProvince = new Map<string, Client[]>();
    clients.forEach(client => {
      const provinceName = client.province ? normalizeProvinceName(client.province) : 'Sin Provincia';
      const list = clientsByProvince.get(provinceName) || [];
      list.push(client);
      clientsByProvince.set(provinceName, list);
    });

    // Filter invoices by date range
    const filteredInvoices = invoices.filter(inv => {
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });

    // Calculate sales and products per client
    const clientSales = new Map<string, { sales: number; invoices: number; lastInvoice: Date }>();
    const clientProducts = new Map<string, Map<string, number>>();

    filteredInvoices.forEach(inv => {
      if (!inv.client_id) return;
      
      const existing = clientSales.get(inv.client_id) || { sales: 0, invoices: 0, lastInvoice: new Date(0) };
      existing.sales += inv.total_amount;
      existing.invoices += 1;
      const invDate = parseISO(inv.invoice_date);
      if (invDate > existing.lastInvoice) existing.lastInvoice = invDate;
      clientSales.set(inv.client_id, existing);

      // Track products
      inv.products?.forEach(prod => {
        const productMap = clientProducts.get(inv.client_id!) || new Map();
        productMap.set(prod.product_name, (productMap.get(prod.product_name) || 0) + prod.amount);
        clientProducts.set(inv.client_id!, productMap);
      });
    });

    // Calculate inactive threshold (30 days without purchase)
    const inactiveThreshold = subDays(new Date(), 30);

    // Aggregate by province
    clientsByProvince.forEach((provinceClients, provinceName) => {
      const stat = stats.get(provinceName);
      if (!stat) return;

      stat.clientCount = provinceClients.length;

      const provinceProducts = new Map<string, number>();
      const provinceClientsWithSales: { id: string; name: string; sales: number }[] = [];
      const inactiveClients: Client[] = [];

      provinceClients.forEach(client => {
        const sales = clientSales.get(client.id);
        if (sales) {
          stat.totalSales += sales.sales;
          stat.invoiceCount += sales.invoices;
          provinceClientsWithSales.push({ id: client.id, name: client.name, sales: sales.sales });

          // Check if inactive
          if (sales.lastInvoice < inactiveThreshold) {
            inactiveClients.push(client);
          }

          // Aggregate products
          const products = clientProducts.get(client.id);
          products?.forEach((amount, name) => {
            provinceProducts.set(name, (provinceProducts.get(name) || 0) + amount);
          });
        } else {
          // Client has no invoices in period - definitely inactive
          inactiveClients.push(client);
        }
      });

      // Sort and get top 5
      stat.topProducts = Array.from(provinceProducts.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      stat.topClients = provinceClientsWithSales
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      stat.inactiveClients = inactiveClients;
    });

    return stats;
  }, [invoices, clients, products, dateRange]);

  // Get max sales for color scale
  const maxSales = useMemo(() => {
    let max = 0;
    provinceStats.forEach(stat => {
      if (stat.totalSales > max) max = stat.totalSales;
    });
    return max || 1;
  }, [provinceStats]);

  // Get color intensity based on sales
  const getProvinceColor = (provinceName: string) => {
    const stat = provinceStats.get(provinceName);
    if (!stat || stat.totalSales === 0) return 'hsl(var(--muted))';
    
    const intensity = Math.min(stat.totalSales / maxSales, 1);
    // From light to dark primary
    const lightness = 90 - (intensity * 50);
    return `hsl(var(--primary) / ${0.2 + intensity * 0.8})`;
  };

  const selectedStats = selectedProvince ? provinceStats.get(selectedProvince) : null;

  if (selectedProvince && selectedStats) {
    // Province Detail View
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setSelectedProvince(null)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al mapa
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold">{selectedProvince}</h3>
            <p className="text-sm text-muted-foreground">{selectedStats.clientCount} clientes • {selectedStats.invoiceCount} facturas</p>
          </div>
        </div>

        {/* Province KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Clientes</span>
              </div>
              <p className="text-2xl font-bold mt-1">{selectedStats.clientCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Ventas</span>
              </div>
              <p className="text-2xl font-bold mt-1">${formatNumber(selectedStats.totalSales)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-600" />
                <span className="text-xs text-muted-foreground">Productos Top</span>
              </div>
              <p className="text-2xl font-bold mt-1">{selectedStats.topProducts.length}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-muted-foreground">Sin Compras Recientes</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-600">{selectedStats.inactiveClients.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Top Products */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Productos Más Vendidos
              </h4>
              <div className="space-y-2">
                {selectedStats.topProducts.length > 0 ? (
                  selectedStats.topProducts.map((prod, i) => (
                    <div key={prod.name} className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1">{i + 1}. {prod.name}</span>
                      <span className="font-medium text-sm">${formatNumber(prod.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin ventas en el período</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Clients */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Clientes con Mayor Volumen
              </h4>
              <div className="space-y-2">
                {selectedStats.topClients.length > 0 ? (
                  selectedStats.topClients.map((client, i) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        const fullClient = clients.find(c => c.id === client.id);
                        if (fullClient) onClientSelect(fullClient);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className="text-sm truncate flex-1">{i + 1}. {client.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">${formatNumber(client.sales)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin clientes con ventas</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inactive Clients - Opportunity */}
        {selectedStats.inactiveClients.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Oportunidad de Visita - Sin compras recientes
              </h4>
              <ScrollArea className="h-40">
                <div className="space-y-2">
                  {selectedStats.inactiveClients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => onClientSelect(client)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-amber-500/10 transition-colors text-left"
                    >
                      <span className="text-sm truncate flex-1">{client.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Map View
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <MapPin className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Mapa de República Dominicana</h3>
          <p className="text-sm text-muted-foreground">Haz clic en una provincia para ver detalles</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Map SVG */}
        <div className="lg:col-span-2">
          <Card className="p-4">
            <svg 
              viewBox="50 50 520 400" 
              className="w-full h-auto"
              style={{ maxHeight: '400px' }}
            >
              {/* Background */}
              <rect x="50" y="50" width="520" height="400" fill="hsl(var(--muted) / 0.3)" rx="8" />
              
              {/* Provinces */}
              {PROVINCES.map(province => {
                const isSelected = selectedProvince === province.name;
                const isHovered = hoveredProvince === province.name;
                const stats = provinceStats.get(province.name);
                const hasClients = stats && stats.clientCount > 0;
                
                return (
                  <g key={province.id}>
                    <path
                      d={province.path}
                      fill={getProvinceColor(province.name)}
                      stroke={isSelected || isHovered ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                      strokeWidth={isSelected || isHovered ? 2 : 1}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                        transformOrigin: `${province.center.x}px ${province.center.y}px`
                      }}
                      onClick={() => setSelectedProvince(province.name)}
                      onMouseEnter={() => setHoveredProvince(province.name)}
                      onMouseLeave={() => setHoveredProvince(null)}
                    />
                    {hasClients && (
                      <circle
                        cx={province.center.x}
                        cy={province.center.y}
                        r={4}
                        fill="hsl(var(--primary))"
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}

              {/* Tooltip */}
              {hoveredProvince && (
                <g>
                  {(() => {
                    const province = PROVINCES.find(p => p.name === hoveredProvince);
                    const stats = provinceStats.get(hoveredProvince);
                    if (!province || !stats) return null;
                    
                    return (
                      <>
                        <rect
                          x={province.center.x - 60}
                          y={province.center.y - 50}
                          width="120"
                          height="40"
                          fill="hsl(var(--card))"
                          stroke="hsl(var(--border))"
                          rx="4"
                          className="pointer-events-none"
                        />
                        <text
                          x={province.center.x}
                          y={province.center.y - 35}
                          textAnchor="middle"
                          className="text-xs font-semibold fill-foreground pointer-events-none"
                        >
                          {province.name}
                        </text>
                        <text
                          x={province.center.x}
                          y={province.center.y - 20}
                          textAnchor="middle"
                          className="text-xs fill-muted-foreground pointer-events-none"
                        >
                          {stats.clientCount} clientes • ${formatNumber(stats.totalSales)}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </svg>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-muted" />
                <span>Sin ventas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary/30" />
                <span>Bajo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary/60" />
                <span>Medio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary" />
                <span>Alto</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Province List */}
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-3">Provincias con Clientes</h4>
            <ScrollArea className="h-[350px]">
              <div className="space-y-1">
                {Array.from(provinceStats.entries())
                  .filter(([_, stats]) => stats.clientCount > 0)
                  .sort((a, b) => b[1].totalSales - a[1].totalSales)
                  .map(([name, stats]) => (
                    <button
                      key={name}
                      onClick={() => setSelectedProvince(name)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">{stats.clientCount} clientes</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">${formatNumber(stats.totalSales)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
