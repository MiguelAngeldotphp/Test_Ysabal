import type { Campaign, Galpon } from "@/lib/domain";
import { todayISO } from "@/lib/domain";

function daysAgo(days: number): string {
  const date = new Date(`${todayISO()}T12:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export const demoGalpones: Galpon[] = [
  { id: "demo-galpon-1", nombre: "Galpón San José", direccion: "Sector San José, Lote 4" },
  { id: "demo-galpon-2", nombre: "Galpón Norte", direccion: "Carretera Central km 12" },
  { id: "demo-galpon-3", nombre: "Galpón El Valle", direccion: "Fundo El Valle, Módulo B" },
];

export const demoCampaigns: Campaign[] = [
  {
    id: "demo-campana-activa",
    galpon: demoGalpones[0],
    fechaInicio: daysAgo(20),
    fechaFin: null,
    estado: "activa",
    hembrasIniciales: 4_000,
    machosIniciales: 4_000,
    perdidaHembras: 0,
    perdidaMachos: 0,
    mortalidad: [
      { id: "mort-1", fechaRegistro: daysAgo(18), hembrasMuertas: 11, machosMuertos: 8 },
      { id: "mort-2", fechaRegistro: daysAgo(14), hembrasMuertas: 8, machosMuertos: 9 },
      { id: "mort-3", fechaRegistro: daysAgo(7), hembrasMuertas: 5, machosMuertos: 4 },
    ],
    pesos: [
      { id: "peso-1", fechaRegistro: daysAgo(13), pesoHembrasKg: 0.48, pesoMachosKg: 0.5 },
      { id: "peso-2", fechaRegistro: daysAgo(6), pesoHembrasKg: 1.02, pesoMachosKg: 1.08 },
    ],
    ventas: [],
  },
  {
    id: "demo-campana-venta",
    galpon: demoGalpones[1],
    fechaInicio: daysAgo(54),
    fechaFin: daysAgo(4),
    estado: "en_venta",
    hembrasIniciales: 3_500,
    machosIniciales: 3_500,
    perdidaHembras: 0,
    perdidaMachos: 0,
    mortalidad: [
      { id: "mort-4", fechaRegistro: daysAgo(46), hembrasMuertas: 12, machosMuertos: 10 },
      { id: "mort-5", fechaRegistro: daysAgo(31), hembrasMuertas: 9, machosMuertos: 11 },
    ],
    pesos: [
      { id: "peso-3", fechaRegistro: daysAgo(33), pesoHembrasKg: 1.52, pesoMachosKg: 1.63 },
      { id: "peso-4", fechaRegistro: daysAgo(12), pesoHembrasKg: 2.89, pesoMachosKg: 3.06 },
    ],
    ventas: [
      {
        id: "venta-1",
        cliente: "Comercial Santa Rosa",
        fechaVenta: daysAgo(2),
        precioPorKilo: 7.8,
        totalBruto: 378.46,
        totalNeto: 324.17,
        detalles: [
          {
            id: "detalle-1",
            sexo: "hembra",
            cantidadJavas: 3,
            pollosPorJava: 7,
            pesoJavaKg: 2.4,
            pesoJavaConAvesKg: 9.3,
          },
          {
            id: "detalle-2",
            sexo: "hembra",
            cantidadJavas: 1,
            pollosPorJava: 6,
            pesoJavaKg: 2.4,
            pesoJavaConAvesKg: 8.7,
          },
        ],
      },
    ],
  },
  {
    id: "demo-campana-finalizada",
    galpon: demoGalpones[2],
    fechaInicio: daysAgo(118),
    fechaFin: daysAgo(70),
    estado: "finalizada",
    hembrasIniciales: 2_500,
    machosIniciales: 2_500,
    perdidaHembras: 22,
    perdidaMachos: 18,
    mortalidad: [
      { id: "mort-6", fechaRegistro: daysAgo(108), hembrasMuertas: 10, machosMuertos: 9 },
      { id: "mort-7", fechaRegistro: daysAgo(88), hembrasMuertas: 7, machosMuertos: 5 },
    ],
    pesos: [
      { id: "peso-5", fechaRegistro: daysAgo(91), pesoHembrasKg: 1.54, pesoMachosKg: 1.66 },
      { id: "peso-6", fechaRegistro: daysAgo(74), pesoHembrasKg: 2.75, pesoMachosKg: 3.02 },
    ],
    ventas: [],
  },
];
