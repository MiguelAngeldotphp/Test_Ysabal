export type CampaignStatus = "activa" | "en_venta" | "finalizada";
export type BirdSex = "hembra" | "macho";

export type Galpon = {
  id: string;
  nombre: string;
  direccion: string;
};

export type MortalityRecord = {
  id: string;
  fechaRegistro: string;
  hembrasMuertas: number;
  machosMuertos: number;
};

export type WeightRecord = {
  id: string;
  fechaRegistro: string;
  pesoHembrasKg: number;
  pesoMachosKg: number;
};

export type SaleDetail = {
  id: string;
  sexo: BirdSex;
  cantidadJavas: number;
  pollosPorJava: number;
  pesoJavaKg: number;
  pesoJavaConAvesKg: number;
};

export type Sale = {
  id: string;
  cliente: string;
  fechaVenta: string;
  precioPorKilo: number;
  totalBruto: number;
  totalNeto: number;
  detalles: SaleDetail[];
};

export type Campaign = {
  id: string;
  galpon: Galpon;
  fechaInicio: string;
  fechaFin: string | null;
  estado: CampaignStatus;
  hembrasIniciales: number;
  machosIniciales: number;
  perdidaHembras: number;
  perdidaMachos: number;
  mortalidad: MortalityRecord[];
  pesos: WeightRecord[];
  ventas: Sale[];
};

export type CampaignStats = {
  poblacionInicial: number;
  hembrasMuertas: number;
  machosMuertos: number;
  mortalidadTotal: number;
  tasaMortalidad: number;
  hembrasVivas: number;
  machosVivos: number;
  avesVivas: number;
  hembrasVendidas: number;
  machosVendidos: number;
  avesVendidas: number;
  javasVendidas: number;
  diasCrianza: number;
  perdidasFinales: number;
};

export function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function dateAtMidnight(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function daysSince(start: string, end = todayISO()): number {
  const difference = dateAtMidnight(end).getTime() - dateAtMidnight(start).getTime();
  return Math.max(0, Math.floor(difference / 86_400_000));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(dateAtMidnight(value))
    .replace(".", "");
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
  })
    .format(dateAtMidnight(value))
    .replace(".", "");
}

export function formatSoles(value: number): string {
  return `S/ ${asNumber(value).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatKg(value: number): string {
  return `${asNumber(value).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

export function saleBirds(detail: SaleDetail): number {
  return detail.cantidadJavas * detail.pollosPorJava;
}

export function saleGrossKg(detail: SaleDetail): number {
  return detail.cantidadJavas * detail.pesoJavaConAvesKg;
}

export function saleNetKg(detail: SaleDetail): number {
  return detail.cantidadJavas * Math.max(0, detail.pesoJavaConAvesKg - detail.pesoJavaKg);
}

export function calculateCampaignStats(campaign: Campaign): CampaignStats {
  const fechaReferencia = campaign.estado === "activa" ? todayISO() : campaign.fechaFin ?? todayISO();
  const hembrasMuertas = campaign.mortalidad.reduce((sum, item) => sum + item.hembrasMuertas, 0);
  const machosMuertos = campaign.mortalidad.reduce((sum, item) => sum + item.machosMuertos, 0);
  const hembrasVendidas = campaign.ventas.flatMap((venta) => venta.detalles)
    .filter((item) => item.sexo === "hembra")
    .reduce((sum, item) => sum + saleBirds(item), 0);
  const machosVendidos = campaign.ventas.flatMap((venta) => venta.detalles)
    .filter((item) => item.sexo === "macho")
    .reduce((sum, item) => sum + saleBirds(item), 0);
  const javasVendidas = campaign.ventas.flatMap((venta) => venta.detalles)
    .reduce((sum, item) => sum + item.cantidadJavas, 0);
  const poblacionInicial = campaign.hembrasIniciales + campaign.machosIniciales;
  const mortalidadTotal = hembrasMuertas + machosMuertos;
  const hembrasVivas = Math.max(0, campaign.hembrasIniciales - hembrasMuertas);
  const machosVivos = Math.max(0, campaign.machosIniciales - machosMuertos);

  return {
    poblacionInicial,
    hembrasMuertas,
    machosMuertos,
    mortalidadTotal,
    tasaMortalidad: poblacionInicial ? (mortalidadTotal / poblacionInicial) * 100 : 0,
    hembrasVivas,
    machosVivos,
    avesVivas: hembrasVivas + machosVivos,
    hembrasVendidas,
    machosVendidos,
    avesVendidas: hembrasVendidas + machosVendidos,
    javasVendidas,
    diasCrianza: daysSince(campaign.fechaInicio, fechaReferencia),
    perdidasFinales: campaign.perdidaHembras + campaign.perdidaMachos,
  };
}

export function campaignStatusLabel(status: CampaignStatus): string {
  return {
    activa: "Activa",
    en_venta: "En venta",
    finalizada: "Finalizada",
  }[status];
}

export function birdSexLabel(sex: BirdSex): string {
  return sex === "hembra" ? "Hembras" : "Machos";
}
