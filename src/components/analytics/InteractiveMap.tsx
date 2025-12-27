import { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, Users, DollarSign, Package, ChevronRight, X, 
  AlertTriangle, TrendingUp, Phone, Mail, Building
} from 'lucide-react';
import { parseISO, isWithinInterval, subDays } from 'date-fns';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { formatNumber } from '@/lib/formatters';
import { PROVINCES, normalizeProvinceName } from '@/lib/dominicanProvinces';

interface InteractiveMapProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  dateRange: { from: Date; to: Date };
  onClientSelect: (client: Client) => void;
}

interface ProvinceData {
  name: string;
  clientCount: number;
  totalSales: number;
  invoiceCount: number;
  topProducts: { name: string; amount: number; quantity: number }[];
  topClients: { id: string; name: string; sales: number; invoices: number }[];
  inactiveClients: Client[];
}

// Province coordinates for the map (approximate centroids)

// Province coordinates for the map (approximate centroids)
const PROVINCE_COORDS: Record<string, [number, number]> = {
  'Distrito Nacional': [-69.9312, 18.4861],
  'Santo Domingo': [-69.8549, 18.4804],
  'Santiago': [-70.6970, 19.4517],
  'La Vega': [-70.5290, 19.2220],
  'Puerto Plata': [-70.6930, 19.7934],
  'San Cristóbal': [-70.1066, 18.4166],
  'Duarte': [-70.0270, 19.3040],
  'La Romana': [-68.9728, 18.4274],
  'San Pedro de Macorís': [-69.3063, 18.4533],
  'Espaillat': [-70.2785, 19.6282],
  'Azua': [-70.7285, 18.4551],
  'Barahona': [-71.1003, 18.2006],
  'Peravia': [-70.3323, 18.2760],
  'San Juan': [-71.2296, 18.8072],
  'Monseñor Nouel': [-70.4182, 18.9179],
  'Monte Plata': [-69.7840, 18.8076],
  'Sánchez Ramírez': [-70.1520, 19.0570],
  'Valverde': [-71.0828, 19.5870],
  'María Trinidad Sánchez': [-69.8520, 19.3820],
  'Samaná': [-69.3323, 19.2058],
  'La Altagracia': [-68.5241, 18.6168],
  'El Seibo': [-69.0403, 18.7654],
  'Hato Mayor': [-69.2561, 18.7635],
  'Monte Cristi': [-71.6513, 19.8649],
  'Dajabón': [-71.7082, 19.5490],
  'Santiago Rodríguez': [-71.3397, 19.4716],
  'Elías Piña': [-71.7003, 18.8760],
  'Baoruco': [-71.4185, 18.4880],
  'Independencia': [-71.8570, 18.4842],
  'Pedernales': [-71.7451, 18.0370],
  'Hermanas Mirabal': [-70.2108, 19.3727],
  'San José de Ocoa': [-70.5050, 18.5465]
};

export function InteractiveMap({ 
  invoices, 
  clients, 
  products, 
  dateRange,
  onClientSelect 
}: InteractiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Calculate province data
  const provinceData = useMemo(() => {
    const data = new Map<string, ProvinceData>();

    // Initialize all provinces
    Object.keys(PROVINCE_COORDS).forEach(name => {
      data.set(name, {
        name,
        clientCount: 0,
        totalSales: 0,
        invoiceCount: 0,
        topProducts: [],
        topClients: [],
        inactiveClients: []
      });
    });

    // Add "Sin Provincia"
    data.set('Sin Provincia', {
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

    // Filter invoices
    const filteredInvoices = invoices.filter(inv => {
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });

    // Calculate sales per client
    const clientSales = new Map<string, { sales: number; invoices: number; lastInvoice: Date }>();
    const clientProducts = new Map<string, Map<string, { amount: number; quantity: number }>>();

    filteredInvoices.forEach(inv => {
      if (!inv.client_id) return;
      
      const existing = clientSales.get(inv.client_id) || { sales: 0, invoices: 0, lastInvoice: new Date(0) };
      existing.sales += inv.total_amount;
      existing.invoices += 1;
      const invDate = parseISO(inv.invoice_date);
      if (invDate > existing.lastInvoice) existing.lastInvoice = invDate;
      clientSales.set(inv.client_id, existing);

      inv.products?.forEach(prod => {
        const productMap = clientProducts.get(inv.client_id!) || new Map();
        const existing = productMap.get(prod.product_name) || { amount: 0, quantity: 0 };
        existing.amount += prod.amount;
        existing.quantity += (prod.quantity_sold || 1);
        productMap.set(prod.product_name, existing);
        clientProducts.set(inv.client_id!, productMap);
      });
    });

    const inactiveThreshold = subDays(new Date(), 30);

    // Aggregate by province
    clientsByProvince.forEach((provinceClients, provinceName) => {
      const stat = data.get(provinceName);
      if (!stat) return;

      stat.clientCount = provinceClients.length;

      const provinceProducts = new Map<string, { amount: number; quantity: number }>();
      const provinceClientsWithSales: { id: string; name: string; sales: number; invoices: number }[] = [];
      const inactiveClients: Client[] = [];

      provinceClients.forEach(client => {
        const sales = clientSales.get(client.id);
        if (sales) {
          stat.totalSales += sales.sales;
          stat.invoiceCount += sales.invoices;
          provinceClientsWithSales.push({ 
            id: client.id, 
            name: client.name, 
            sales: sales.sales,
            invoices: sales.invoices 
          });

          if (sales.lastInvoice < inactiveThreshold) {
            inactiveClients.push(client);
          }

          const products = clientProducts.get(client.id);
          products?.forEach((data, name) => {
            const existing = provinceProducts.get(name) || { amount: 0, quantity: 0 };
            existing.amount += data.amount;
            existing.quantity += data.quantity;
            provinceProducts.set(name, existing);
          });
        } else {
          inactiveClients.push(client);
        }
      });

      stat.topProducts = Array.from(provinceProducts.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      stat.topClients = provinceClientsWithSales
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      stat.inactiveClients = inactiveClients;
    });

    return data;
  }, [invoices, clients, dateRange]);

  // Get max sales for sizing
  const maxSales = useMemo(() => {
    let max = 0;
    provinceData.forEach(stat => {
      if (stat.totalSales > max) max = stat.totalSales;
    });
    return max || 1;
  }, [provinceData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-70.1627, 18.7357],
      zoom: 7.5,
      minZoom: 6,
      maxZoom: 12,
      pitch: 0,
      bearing: 0
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    map.current.scrollZoom.enable();

    return () => {
      markersRef.current.forEach(m => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add markers when data changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add province markers
    provinceData.forEach((data, provinceName) => {
      if (provinceName === 'Sin Provincia' || !data.clientCount) return;
      
      const coords = PROVINCE_COORDS[provinceName];
      if (!coords) return;

      const intensity = Math.min(data.totalSales / maxSales, 1);
      const size = 24 + (intensity * 36);

      const el = document.createElement('div');
      el.className = 'province-marker';
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, 
          hsl(142, 76%, ${55 - intensity * 20}%), 
          hsl(142, 76%, ${45 - intensity * 15}%));
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 ${data.totalSales > 0 ? '2px' : '0'} rgba(16, 185, 129, 0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: ${Math.max(10, size * 0.35)}px;
        transition: transform 0.2s, box-shadow 0.2s;
      `;
      el.textContent = data.clientCount.toString();
      el.title = `${provinceName}: ${data.clientCount} clientes`;
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.15)';
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25), 0 0 0 3px rgba(16, 185, 129, 0.4)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), 0 0 0 2px rgba(16, 185, 129, 0.2)';
      });
      el.addEventListener('click', () => {
        setSelectedProvince(provinceName);
        setIsPanelOpen(true);
        map.current?.flyTo({
          center: coords,
          zoom: 9,
          duration: 800
        });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [provinceData, maxSales]);

  const selectedData = selectedProvince ? provinceData.get(selectedProvince) : null;

  // Summary stats
  const summaryStats = useMemo(() => {
    let totalClients = 0;
    let totalSales = 0;
    let totalInvoices = 0;
    let provincesWithSales = 0;

    provinceData.forEach(data => {
      totalClients += data.clientCount;
      totalSales += data.totalSales;
      totalInvoices += data.invoiceCount;
      if (data.totalSales > 0) provincesWithSales++;
    });

    return { totalClients, totalSales, totalInvoices, provincesWithSales };
  }, [provinceData]);

  return (
    <div className="relative h-[600px] rounded-xl overflow-hidden border border-border bg-card">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Summary Cards - Top Left */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Card className="bg-card/95 backdrop-blur-sm shadow-lg border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Provincias Activas</p>
                <p className="text-xl font-bold">{summaryStats.provincesWithSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/95 backdrop-blur-sm shadow-lg border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Clientes</p>
                <p className="text-xl font-bold">{summaryStats.totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/95 backdrop-blur-sm shadow-lg border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ventas Totales</p>
                <p className="text-xl font-bold">${formatNumber(summaryStats.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Province Detail Panel */}
      {isPanelOpen && selectedData && (
        <div className="absolute top-4 right-4 bottom-4 w-80 z-10">
          <Card className="h-full bg-card/98 backdrop-blur-md shadow-xl border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedProvince}</h3>
                    <p className="text-xs text-muted-foreground">{selectedData.clientCount} clientes</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => {
                    setIsPanelOpen(false);
                    setSelectedProvince(null);
                    map.current?.flyTo({
                      center: [-70.1627, 18.7357],
                      zoom: 7.5,
                      duration: 800
                    });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[calc(100%-80px)]">
              <div className="p-4 space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <DollarSign className="h-4 w-4 text-emerald-600 mb-1" />
                    <p className="text-lg font-bold">${formatNumber(selectedData.totalSales)}</p>
                    <p className="text-xs text-muted-foreground">Ventas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Package className="h-4 w-4 text-blue-600 mb-1" />
                    <p className="text-lg font-bold">{selectedData.invoiceCount}</p>
                    <p className="text-xs text-muted-foreground">Facturas</p>
                  </div>
                </div>

                {/* Top Products */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Productos Top
                  </h4>
                  <div className="space-y-1">
                    {selectedData.topProducts.length > 0 ? (
                      selectedData.topProducts.map((prod, i) => (
                        <div key={prod.name} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/50">
                          <span className="truncate flex-1">{i + 1}. {prod.name}</span>
                          <div className="text-right">
                            <span className="font-medium">${formatNumber(prod.amount)}</span>
                            <span className="text-xs text-muted-foreground ml-1">({prod.quantity}u)</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">Sin ventas en el período</p>
                    )}
                  </div>
                </div>

                {/* Top Clients */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Mejores Clientes
                  </h4>
                  <div className="space-y-1">
                    {selectedData.topClients.length > 0 ? (
                      selectedData.topClients.map((client, i) => (
                        <button
                          key={client.id}
                          onClick={() => {
                            const fullClient = clients.find(c => c.id === client.id);
                            if (fullClient) onClientSelect(fullClient);
                          }}
                          className="w-full flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                        >
                          <span className="truncate flex-1">{client.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">${formatNumber(client.sales)}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">Sin clientes con ventas</p>
                    )}
                  </div>
                </div>

                {/* Inactive Clients */}
                {selectedData.inactiveClients.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Oportunidad de Visita
                      <Badge variant="outline" className="ml-auto text-amber-600 border-amber-500/30">
                        {selectedData.inactiveClients.length}
                      </Badge>
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedData.inactiveClients.slice(0, 10).map(client => (
                        <button
                          key={client.id}
                          onClick={() => onClientSelect(client)}
                          className="w-full flex items-center justify-between text-sm p-2 rounded-lg hover:bg-amber-500/10 transition-colors text-left group"
                        >
                          <span className="truncate flex-1">{client.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-10">
        <Card className="bg-card/95 backdrop-blur-sm shadow-lg border-border/50">
          <CardContent className="p-3">
            <p className="text-xs font-medium mb-2">Intensidad de ventas</p>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-emerald-200 border border-white"></div>
              <div className="w-4 h-4 rounded-full bg-emerald-400 border border-white"></div>
              <div className="w-4 h-4 rounded-full bg-emerald-600 border border-white"></div>
              <div className="w-4 h-4 rounded-full bg-emerald-800 border border-white"></div>
              <span className="text-xs text-muted-foreground ml-2">Bajo → Alto</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
