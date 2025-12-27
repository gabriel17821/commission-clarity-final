import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, BarChart3 } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import { AnalysisCenterLayout } from './AnalysisCenterLayout';

type DatePreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

interface SalesAnalysisDashboardProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  sellers: Seller[];
}

export function SalesAnalysisDashboard({ invoices, clients, products, sellers }: SalesAnalysisDashboardProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ 
    from: undefined, 
    to: undefined 
  });

  const getDateRange = () => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case '7d':
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case '30d':
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case 'month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'custom':
        if (customRange.from && customRange.to) {
          return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
        }
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      default:
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    }
  };

  const dateRange = getDateRange();

  const handlePresetChange = (value: DatePreset) => {
    setDatePreset(value);
    if (value !== 'custom') {
      setCustomRange({ from: undefined, to: undefined });
    }
  };

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Centro de Análisis</h1>
            <p className="text-xs text-muted-foreground">
              {format(dateRange.from, 'dd MMM', { locale: es })} - {format(dateRange.to, 'dd MMM yyyy', { locale: es })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={datePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-40 h-9">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="month">Mes actual</SelectItem>
              <SelectItem value="lastMonth">Mes anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {customRange.from && customRange.to
                    ? `${format(customRange.from, 'dd/MM/yy')} - ${format(customRange.to, 'dd/MM/yy')}`
                    : 'Fechas'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: customRange.from, to: customRange.to }}
                  onSelect={(range) => setCustomRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </header>

      {/* Analysis Center Layout */}
      <AnalysisCenterLayout
        invoices={invoices}
        clients={clients}
        products={products}
        sellers={sellers}
        dateRange={dateRange}
      />
    </main>
  );
}
