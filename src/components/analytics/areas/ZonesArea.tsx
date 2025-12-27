import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Users, Package, DollarSign, RotateCcw, ChevronRight, Gift } from 'lucide-react';
import { ProvinceMetrics } from '@/hooks/useAnalyticsData';
import { formatNumber } from '@/lib/formatters';

interface ZonesAreaProps {
  provinceMetrics: Map<string, ProvinceMetrics>;
  onSelectProvince: (province: string | null) => void;
  selectedProvince: string | null;
}

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

export function ZonesArea({ provinceMetrics, onSelectProvince, selectedProvince }: ZonesAreaProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const selectedProvinceData = selectedProvince ? provinceMetrics.get(selectedProvince) : null;

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-70.1627, 18.7357],
      zoom: 7.5,
      minZoom: 6,
      maxZoom: 10,
      pitch: 0,
      bearing: 0
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    return () => {
      markersRef.current.forEach(m => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!map.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const maxSales = Math.max(...Array.from(provinceMetrics.values()).map(p => p.sales), 1);

    provinceMetrics.forEach((data, provinceName) => {
      if (!data.clientCount) return;
      const coords = PROVINCE_COORDS[provinceName];
      if (!coords) return;

      const intensity = Math.min(data.sales / maxSales, 1);
      const size = 24 + (intensity * 28);
      const isSelected = selectedProvince === provinceName;

      const el = document.createElement('div');
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background: ${isSelected 
          ? 'linear-gradient(135deg, hsl(262, 83%, 58%), hsl(262, 83%, 48%))' 
          : `linear-gradient(135deg, hsl(142, 76%, ${55 - intensity * 20}%), hsl(142, 76%, ${45 - intensity * 15}%))`};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
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
      el.title = `${provinceName}: ${data.clientCount} clientes, RD$${formatNumber(data.sales)}`;
      
      el.addEventListener('mouseenter', () => { 
        el.style.transform = 'scale(1.15)'; 
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
      });
      el.addEventListener('mouseleave', () => { 
        el.style.transform = 'scale(1)'; 
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectProvince(selectedProvince === provinceName ? null : provinceName);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [provinceMetrics, selectedProvince, onSelectProvince]);

  // Fly to selected province
  useEffect(() => {
    if (!map.current) return;
    if (selectedProvince && PROVINCE_COORDS[selectedProvince]) {
      map.current.flyTo({
        center: PROVINCE_COORDS[selectedProvince],
        zoom: 9,
        duration: 800
      });
    } else {
      map.current.flyTo({
        center: [-70.1627, 18.7357],
        zoom: 7.5,
        duration: 600
      });
    }
  }, [selectedProvince]);

  const handleReset = () => {
    onSelectProvince(null);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      {/* Map - PROTAGONIST */}
      <div className="flex-1 lg:flex-[2] min-h-[400px] lg:min-h-0">
        <Card className="h-full overflow-hidden">
          <CardHeader className="py-3 px-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Mapa de Zonas
              </CardTitle>
              {selectedProvince && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 h-8">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-53px)]">
            <div ref={mapContainer} className="h-full w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Side Panel */}
      <div className="lg:flex-1 lg:max-w-sm">
        <Card className="h-full">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-base">
              {selectedProvince ? (
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedProvince}</Badge>
                </span>
              ) : (
                'Resumen por Zona'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100%-53px)]">
              {selectedProvinceData ? (
                <div className="p-4 space-y-4">
                  {/* Province Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                      <DollarSign className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
                      <p className="text-lg font-bold">RD${formatNumber(selectedProvinceData.sales)}</p>
                      <p className="text-xs text-muted-foreground">Ingresos</p>
                    </div>
                    <div className="p-3 rounded-lg bg-violet-500/10 text-center">
                      <Users className="h-4 w-4 mx-auto text-violet-600 mb-1" />
                      <p className="text-lg font-bold">{selectedProvinceData.clientCount}</p>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                      <Package className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                      <p className="text-lg font-bold">{formatNumber(selectedProvinceData.units)}</p>
                      <p className="text-xs text-muted-foreground">Unidades</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                      <Gift className="h-4 w-4 mx-auto text-amber-600 mb-1" />
                      <p className="text-lg font-bold">{selectedProvinceData.giftPercentage.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Regalos</p>
                    </div>
                  </div>

                  {/* Top Products */}
                  {selectedProvinceData.topProducts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Productos más vendidos
                      </h4>
                      <div className="space-y-1.5">
                        {selectedProvinceData.topProducts.map((prod, i) => (
                          <div key={prod.name} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                            <span className="truncate flex-1">{i + 1}. {prod.name}</span>
                            <span className="font-medium ml-2">RD${formatNumber(prod.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Clients */}
                  {selectedProvinceData.topClients.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Clientes principales
                      </h4>
                      <div className="space-y-1.5">
                        {selectedProvinceData.topClients.map((client, i) => (
                          <div key={client.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                            <span className="truncate flex-1">{i + 1}. {client.name}</span>
                            <span className="font-medium ml-2">RD${formatNumber(client.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {Array.from(provinceMetrics.entries())
                    .sort((a, b) => b[1].sales - a[1].sales)
                    .map(([name, data]) => (
                      <div 
                        key={name}
                        onClick={() => onSelectProvince(name)}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {data.clientCount}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{name}</p>
                            <p className="text-xs text-muted-foreground">{data.clientCount} clientes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">RD${formatNumber(data.sales)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))
                  }
                  {provinceMetrics.size === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No hay datos de zonas en el período
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
