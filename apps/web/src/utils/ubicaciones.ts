export interface PaisInfo {
  codigo: string; // ISO 2 letras para bbox de Nominatim
  nombre: string;
}

export const PAISES: PaisInfo[] = [
  { codigo: 'CO', nombre: 'Colombia' },
  { codigo: 'AR', nombre: 'Argentina' },
  { codigo: 'BR', nombre: 'Brasil' },
  { codigo: 'CL', nombre: 'Chile' },
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'PE', nombre: 'Perú' },
  { codigo: 'EC', nombre: 'Ecuador' },
  { codigo: 'VE', nombre: 'Venezuela' },
  { codigo: 'PA', nombre: 'Panamá' },
  { codigo: 'CR', nombre: 'Costa Rica' },
  { codigo: 'ES', nombre: 'España' },
  { codigo: 'US', nombre: 'Estados Unidos' },
];

export const CIUDADES_POR_PAIS: Record<string, string[]> = {
  Colombia: [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga',
    'Pereira', 'Manizales', 'Santa Marta', 'Ibagué', 'Cúcuta', 'Villavicencio',
    'Neiva', 'Pasto', 'Armenia', 'Popayán', 'Sincelejo', 'Tunja', 'Valledupar',
    'Montería', 'Riohacha', 'Quibdó', 'Yopal', 'Mocoa', 'Florencia',
    'San José del Guaviare', 'Mitú', 'Inírida', 'Puerto Carreño', 'Leticia',
    'Soacha', 'Soledad', 'Bello', 'Itagüí', 'Envigado', 'Palmira', 'Buenaventura',
    'Tuluá', 'Floridablanca', 'Girón', 'Piedecuesta',
  ],
  Argentina: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata', 'Tucumán', 'Salta'],
  Brasil: ['São Paulo', 'Río de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus'],
  Chile: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Iquique'],
  México: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Cancún', 'Mérida'],
  Perú: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Iquitos', 'Cusco', 'Huancayo'],
  Ecuador: ['Quito', 'Guayaquil', 'Cuenca', 'Santo Domingo', 'Machala', 'Manta', 'Ambato'],
  Venezuela: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay', 'Ciudad Guayana'],
  Panamá: ['Ciudad de Panamá', 'Colón', 'David', 'Santiago', 'Chitré'],
  'Costa Rica': ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Liberia', 'Puntarenas'],
  España: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Bilbao', 'Granada'],
  'Estados Unidos': ['New York', 'Los Angeles', 'Miami', 'Houston', 'Chicago', 'Dallas', 'Orlando', 'Boston'],
};

export const LOCALIDADES_POR_CIUDAD: Record<string, string[]> = {
  Bogotá: [
    'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
    'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',
    'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
    'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz',
  ],
  Medellín: [
    'Popular', 'Santa Cruz', 'Manrique', 'Aranjuez', 'Castilla', 'Doce de Octubre',
    'Robledo', 'Villa Hermosa', 'Buenos Aires', 'La Candelaria', 'Laureles-Estadio',
    'La América', 'San Javier', 'El Poblado', 'Guayabal', 'Belén',
  ],
  Cali: [
    'Comuna 1', 'Comuna 2', 'Comuna 3', 'Comuna 4', 'Comuna 5', 'Comuna 6',
    'Comuna 7', 'Comuna 8', 'Comuna 9', 'Comuna 10', 'Comuna 11', 'Comuna 12',
    'Comuna 13', 'Comuna 14', 'Comuna 15', 'Comuna 16', 'Comuna 17', 'Comuna 18',
    'Comuna 19', 'Comuna 20', 'Comuna 21', 'Comuna 22',
  ],
  Cartagena: [
    'Histórica y del Caribe Norte', 'Industrial de la Bahía', 'Industrial y Turística',
  ],
  'Buenos Aires': [
    'Palermo', 'Recoleta', 'Belgrano', 'Caballito', 'Almagro', 'Villa Crespo',
    'San Telmo', 'La Boca', 'Puerto Madero', 'Núñez', 'Boedo', 'Flores',
  ],
  Madrid: [
    'Centro', 'Salamanca', 'Chamberí', 'Chamartín', 'Tetuán', 'Retiro',
    'Arganzuela', 'Moncloa-Aravaca', 'Latina', 'Carabanchel', 'Usera',
  ],
};
