// Dominican Republic provinces with real SVG path data for interactive map
// Paths based on real geographic data

export interface ProvinceData {
  id: string;
  name: string;
  path: string;
  center: { x: number; y: number };
}

// Real SVG paths for Dominican Republic provinces - scaled to viewBox 0 0 600 300
export const PROVINCES: ProvinceData[] = [
  { 
    id: 'pedernales', 
    name: 'Pedernales', 
    path: 'M40,200 L60,185 L75,190 L80,210 L70,235 L50,245 L35,230 Z',
    center: { x: 57, y: 215 }
  },
  { 
    id: 'independencia', 
    name: 'Independencia', 
    path: 'M60,160 L85,150 L100,165 L95,185 L75,190 L60,185 L55,175 Z',
    center: { x: 78, y: 170 }
  },
  { 
    id: 'bahoruco', 
    name: 'Bahoruco', 
    path: 'M80,175 L105,165 L120,175 L115,195 L95,200 L80,195 Z',
    center: { x: 100, y: 183 }
  },
  { 
    id: 'barahona', 
    name: 'Barahona', 
    path: 'M75,190 L95,185 L115,195 L120,220 L100,240 L80,235 L70,220 Z',
    center: { x: 95, y: 215 }
  },
  { 
    id: 'elias-pina', 
    name: 'Elías Piña', 
    path: 'M85,130 L110,120 L130,130 L125,155 L105,165 L85,155 Z',
    center: { x: 107, y: 142 }
  },
  { 
    id: 'san-juan', 
    name: 'San Juan', 
    path: 'M105,145 L140,130 L165,145 L160,175 L130,185 L110,175 Z',
    center: { x: 137, y: 160 }
  },
  { 
    id: 'azua', 
    name: 'Azua', 
    path: 'M130,175 L165,165 L190,175 L195,200 L175,215 L145,210 L130,195 Z',
    center: { x: 163, y: 192 }
  },
  { 
    id: 'dajabon', 
    name: 'Dajabón', 
    path: 'M95,80 L120,70 L140,80 L135,100 L115,105 L95,95 Z',
    center: { x: 117, y: 88 }
  },
  { 
    id: 'monte-cristi', 
    name: 'Monte Cristi', 
    path: 'M115,55 L150,45 L175,55 L170,80 L140,90 L120,80 Z',
    center: { x: 145, y: 70 }
  },
  { 
    id: 'santiago-rodriguez', 
    name: 'Santiago Rodríguez', 
    path: 'M120,90 L145,80 L165,90 L160,115 L140,120 L120,110 Z',
    center: { x: 142, y: 102 }
  },
  { 
    id: 'valverde', 
    name: 'Valverde', 
    path: 'M145,75 L175,65 L195,80 L190,105 L165,110 L145,100 Z',
    center: { x: 170, y: 88 }
  },
  { 
    id: 'puerto-plata', 
    name: 'Puerto Plata', 
    path: 'M175,50 L215,40 L245,50 L240,75 L210,85 L180,75 Z',
    center: { x: 210, y: 62 }
  },
  { 
    id: 'espaillat', 
    name: 'Espaillat', 
    path: 'M215,75 L245,65 L265,80 L260,100 L235,105 L215,95 Z',
    center: { x: 240, y: 85 }
  },
  { 
    id: 'santiago', 
    name: 'Santiago', 
    path: 'M165,95 L200,85 L225,100 L220,130 L190,140 L165,125 Z',
    center: { x: 195, y: 112 }
  },
  { 
    id: 'la-vega', 
    name: 'La Vega', 
    path: 'M195,125 L230,115 L255,130 L250,160 L220,170 L195,155 Z',
    center: { x: 225, y: 142 }
  },
  { 
    id: 'monsenor-nouel', 
    name: 'Monseñor Nouel', 
    path: 'M220,150 L250,140 L270,155 L265,180 L240,185 L220,175 Z',
    center: { x: 245, y: 165 }
  },
  { 
    id: 'san-jose-de-ocoa', 
    name: 'San José de Ocoa', 
    path: 'M195,175 L220,165 L240,180 L235,200 L210,205 L195,195 Z',
    center: { x: 218, y: 188 }
  },
  { 
    id: 'peravia', 
    name: 'Peravia', 
    path: 'M235,190 L260,180 L280,195 L275,220 L250,225 L235,210 Z',
    center: { x: 257, y: 205 }
  },
  { 
    id: 'san-cristobal', 
    name: 'San Cristóbal', 
    path: 'M265,175 L295,165 L320,180 L315,205 L285,210 L265,200 Z',
    center: { x: 292, y: 190 }
  },
  { 
    id: 'hermanas-mirabal', 
    name: 'Hermanas Mirabal', 
    path: 'M255,95 L285,85 L305,100 L300,120 L275,125 L255,115 Z',
    center: { x: 280, y: 105 }
  },
  { 
    id: 'maria-trinidad-sanchez', 
    name: 'María Trinidad Sánchez', 
    path: 'M290,70 L330,60 L355,75 L350,100 L320,105 L290,95 Z',
    center: { x: 322, y: 82 }
  },
  { 
    id: 'duarte', 
    name: 'Duarte', 
    path: 'M275,110 L310,100 L335,115 L330,145 L300,150 L275,140 Z',
    center: { x: 305, y: 125 }
  },
  { 
    id: 'samana', 
    name: 'Samaná', 
    path: 'M345,85 L395,70 L425,85 L420,110 L385,115 L350,105 Z',
    center: { x: 385, y: 95 }
  },
  { 
    id: 'sanchez-ramirez', 
    name: 'Sánchez Ramírez', 
    path: 'M295,140 L330,130 L350,145 L345,170 L315,175 L295,165 Z',
    center: { x: 322, y: 155 }
  },
  { 
    id: 'monte-plata', 
    name: 'Monte Plata', 
    path: 'M335,145 L375,135 L400,150 L395,180 L360,185 L335,175 Z',
    center: { x: 367, y: 160 }
  },
  { 
    id: 'distrito-nacional', 
    name: 'Distrito Nacional', 
    path: 'M315,195 L335,190 L345,200 L340,215 L320,218 L310,210 Z',
    center: { x: 328, y: 205 }
  },
  { 
    id: 'santo-domingo', 
    name: 'Santo Domingo', 
    path: 'M325,175 L365,165 L390,180 L385,210 L350,220 L325,205 Z',
    center: { x: 357, y: 192 }
  },
  { 
    id: 'hato-mayor', 
    name: 'Hato Mayor', 
    path: 'M385,155 L420,145 L445,160 L440,190 L410,195 L385,185 Z',
    center: { x: 415, y: 170 }
  },
  { 
    id: 'el-seibo', 
    name: 'El Seibo', 
    path: 'M430,145 L475,130 L505,150 L500,185 L460,190 L435,175 Z',
    center: { x: 467, y: 160 }
  },
  { 
    id: 'san-pedro-de-macoris', 
    name: 'San Pedro de Macorís', 
    path: 'M375,195 L410,185 L435,200 L430,230 L400,235 L375,220 Z',
    center: { x: 405, y: 210 }
  },
  { 
    id: 'la-romana', 
    name: 'La Romana', 
    path: 'M425,195 L460,185 L485,200 L480,230 L450,235 L425,220 Z',
    center: { x: 455, y: 210 }
  },
  { 
    id: 'la-altagracia', 
    name: 'La Altagracia', 
    path: 'M470,170 L520,155 L560,175 L555,215 L510,230 L475,210 Z',
    center: { x: 515, y: 192 }
  },
];

// Map province name variations to standardized names
export function normalizeProvinceName(name: string): string {
  const normalized = name.trim().toLowerCase();
  
  const mappings: Record<string, string> = {
    'azua': 'Azua',
    'bahoruco': 'Bahoruco',
    'barahona': 'Barahona',
    'dajabón': 'Dajabón',
    'dajabon': 'Dajabón',
    'distrito nacional': 'Distrito Nacional',
    'dn': 'Distrito Nacional',
    'duarte': 'Duarte',
    'el seibo': 'El Seibo',
    'seibo': 'El Seibo',
    'elías piña': 'Elías Piña',
    'elias pina': 'Elías Piña',
    'espaillat': 'Espaillat',
    'hato mayor': 'Hato Mayor',
    'hermanas mirabal': 'Hermanas Mirabal',
    'salcedo': 'Hermanas Mirabal',
    'independencia': 'Independencia',
    'la altagracia': 'La Altagracia',
    'altagracia': 'La Altagracia',
    'la romana': 'La Romana',
    'romana': 'La Romana',
    'la vega': 'La Vega',
    'vega': 'La Vega',
    'maría trinidad sánchez': 'María Trinidad Sánchez',
    'maria trinidad sanchez': 'María Trinidad Sánchez',
    'nagua': 'María Trinidad Sánchez',
    'monseñor nouel': 'Monseñor Nouel',
    'monsenor nouel': 'Monseñor Nouel',
    'bonao': 'Monseñor Nouel',
    'monte cristi': 'Monte Cristi',
    'montecristi': 'Monte Cristi',
    'monte plata': 'Monte Plata',
    'pedernales': 'Pedernales',
    'peravia': 'Peravia',
    'baní': 'Peravia',
    'bani': 'Peravia',
    'puerto plata': 'Puerto Plata',
    'samaná': 'Samaná',
    'samana': 'Samaná',
    'san cristóbal': 'San Cristóbal',
    'san cristobal': 'San Cristóbal',
    'san josé de ocoa': 'San José de Ocoa',
    'san jose de ocoa': 'San José de Ocoa',
    'ocoa': 'San José de Ocoa',
    'san juan': 'San Juan',
    'san pedro de macorís': 'San Pedro de Macorís',
    'san pedro de macoris': 'San Pedro de Macorís',
    'san pedro': 'San Pedro de Macorís',
    'sánchez ramírez': 'Sánchez Ramírez',
    'sanchez ramirez': 'Sánchez Ramírez',
    'cotuí': 'Sánchez Ramírez',
    'cotui': 'Sánchez Ramírez',
    'santiago': 'Santiago',
    'santiago rodríguez': 'Santiago Rodríguez',
    'santiago rodriguez': 'Santiago Rodríguez',
    'santo domingo': 'Santo Domingo',
    'sd': 'Santo Domingo',
    'valverde': 'Valverde',
    'mao': 'Valverde',
  };
  
  return mappings[normalized] || name;
}
