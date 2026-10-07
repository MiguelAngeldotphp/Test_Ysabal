"use client";

import type { Session, User } from "@supabase/supabase-js";

import { demoCampaigns, demoGalpones } from "@/lib/demo-data";
import {
  asNumber,
  calculateCampaignStats,
  type Campaign,
  type CampaignStatus,
  type Expense,
  type Galpon,
  type MortalityRecord,
  type Sale,
  type SaleDetail,
  type WeightRecord,
} from "@/lib/domain";
import { getSupabaseBrowser, hasSupabaseConfiguration } from "@/lib/supabase-browser";
import type { CampaignInput, ExpenseInput, GalponInput, MortalityInput, SaleInput, WeightInput } from "@/lib/validation";

export type DataSource = "live" | "demo" | "error";

export type LoadResult<T> = {
  data: T;
  source: DataSource;
  message?: string;
};

export type WholesaleChickenPrice = {
  fechaBoletin: string;
  precioPorKg: number;
  precioGranjaPorKg: number | null;
  fuenteUrl: string;
};

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "AppError";
  }
}

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function asRow(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
  return value && typeof value === "object" ? (value as Row) : null;
}

function mapGalpon(row: Row): Galpon {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? "Galpón sin nombre"),
    direccion: String(row.direccion ?? "Sin dirección"),
  };
}

function mapMortality(row: Row): MortalityRecord {
  return {
    id: String(row.id),
    fechaRegistro: String(row.fecha_registro),
    hembrasMuertas: asNumber(row.hembras_muertas),
    machosMuertos: asNumber(row.machos_muertos),
  };
}

function mapWeight(row: Row): WeightRecord {
  return {
    id: String(row.id),
    fechaRegistro: String(row.fecha_registro),
    pesoHembrasKg: asNumber(row.peso_hembras_kg),
    pesoMachosKg: asNumber(row.peso_machos_kg),
  };
}

function mapSaleDetail(row: Row): SaleDetail {
  return {
    id: String(row.id),
    sexo: row.sexo === "macho" ? "macho" : "hembra",
    cantidadJavas: asNumber(row.cantidad_javas),
    pollosPorJava: asNumber(row.pollos_por_java),
    pesoJavaKg: asNumber(row.peso_java_kg),
    pesoJavaConAvesKg: asNumber(row.peso_java_con_aves_kg),
  };
}

function mapSale(row: Row): Sale {
  return {
    id: String(row.id),
    cliente: String(row.cliente),
    fechaVenta: String(row.fecha_venta),
    precioPorKilo: asNumber(row.precio_por_kilo),
    totalBruto: asNumber(row.total_bruto),
    totalNeto: asNumber(row.total_neto),
    detalles: asRows(row.detalles_venta_javas).map(mapSaleDetail),
  };
}

function mapExpense(row: Row): Expense {
  return {
    id: String(row.id),
    fecha: String(row.fecha),
    tipo: String(asRow(row.tipo)?.nombre ?? "Sin tipo"),
    descripcion: String(asRow(row.descripcion)?.nombre ?? "Sin descripción"),
    observacion: String(row.observacion ?? ""),
    formaPago: String(asRow(row.forma_pago)?.nombre ?? "Sin forma de pago"),
    bancos: Array.isArray(row.bancos) ? row.bancos.map(String) : [],
    egreso: row.egreso === null || row.egreso === undefined ? null : asNumber(row.egreso),
    ingreso: row.ingreso === null || row.ingreso === undefined ? null : asNumber(row.ingreso),
  };
}

function mapWholesaleChickenPrice(row: Row): WholesaleChickenPrice {
  return {
    fechaBoletin: String(row.fecha_boletin),
    precioPorKg: asNumber(row.precio_por_kg),
    precioGranjaPorKg: row.precio_granja_por_kg === null || row.precio_granja_por_kg === undefined
      ? null
      : asNumber(row.precio_granja_por_kg),
    fuenteUrl: String(row.fuente_url),
  };
}

function mapCampaign(row: Row): Campaign {
  const galpon = asRow(row.galpon) ?? asRow(row.galpones) ?? {
    id: row.galpon_id,
    nombre: "Galpón sin nombre",
    direccion: "Sin dirección",
  };

  return {
    id: String(row.id),
    galpon: mapGalpon(galpon),
    fechaInicio: String(row.fecha_inicio),
    fechaFin: row.fecha_fin ? String(row.fecha_fin) : null,
    estado: ["activa", "en_venta", "finalizada"].includes(String(row.estado))
      ? (row.estado as CampaignStatus)
      : "activa",
    hembrasIniciales: asNumber(row.hembras_iniciales),
    machosIniciales: asNumber(row.machos_iniciales),
    perdidaHembras: asNumber(row.perdida_hembras),
    perdidaMachos: asNumber(row.perdida_machos),
    mortalidad: asRows(row.registros_mortalidad)
      .map(mapMortality)
      .sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)),
    pesos: asRows(row.registros_peso)
      .map(mapWeight)
      .sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)),
    ventas: asRows(row.ventas)
      .map(mapSale)
      .sort((a, b) => b.fechaVenta.localeCompare(a.fechaVenta)),
    gastos: asRows(row.gastos_campana)
      .map(mapExpense)
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}

const CAMPAIGN_SELECT = `
  id, galpon_id, fecha_inicio, fecha_fin, estado,
  hembras_iniciales, machos_iniciales, perdida_hembras, perdida_machos,
  galpon:galpones(id, nombre, direccion),
  registros_mortalidad(id, fecha_registro, hembras_muertas, machos_muertos),
  registros_peso(id, fecha_registro, peso_hembras_kg, peso_machos_kg),
  ventas(
    id, cliente, fecha_venta, precio_por_kilo, total_bruto, total_neto,
    detalles_venta_javas(id, sexo, cantidad_javas, pollos_por_java, peso_java_kg, peso_java_con_aves_kg)
  ),
  gastos_campana(
    id, fecha, observacion, bancos, egreso, ingreso,
    tipo:tipos_gasto(nombre),
    descripcion:descripciones_gasto(nombre),
    forma_pago:formas_pago_gasto(nombre)
  )
`;

function configuredClient() {
  const client = getSupabaseBrowser();
  if (!client) {
    throw new AppError("Conecta las variables públicas de Supabase antes de guardar datos.", 503);
  }
  return client;
}

function databaseMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "No se pudo consultar la base de datos.";
}

async function getLiveCampaign(id: string): Promise<Campaign> {
  const client = configuredClient();
  const { data, error } = await client
    .from("campanas")
    .select(CAMPAIGN_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) throw new AppError(databaseMessage(error), error?.code === "PGRST116" ? 404 : 500);
  return mapCampaign(data as Row);
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseBrowser();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw new AppError(error.message, 500);
  return data.session;
}

export async function refreshWholesaleChickenPrice(): Promise<WholesaleChickenPrice> {
  const session = await getSession();
  if (!session) throw new AppError("Inicia sesión para actualizar el precio.", 401);

  const response = await fetch("/api/precio-pollo/actualizar", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const payload = await response.json() as { error?: unknown; fechaBoletin?: unknown; precioPorKg?: unknown; precioGranjaPorKg?: unknown; fuenteUrl?: unknown };
  if (!response.ok || !payload.fechaBoletin || payload.precioPorKg === undefined || payload.precioGranjaPorKg === undefined || !payload.fuenteUrl) {
    throw new AppError(String(payload.error ?? "No se pudo actualizar el precio."), response.status);
  }

  return {
    fechaBoletin: String(payload.fechaBoletin),
    precioPorKg: asNumber(payload.precioPorKg),
    precioGranjaPorKg: asNumber(payload.precioGranjaPorKg),
    fuenteUrl: String(payload.fuenteUrl),
  };
}

export async function getWholesaleChickenPriceHistory(startDate: string, endDate: string): Promise<WholesaleChickenPrice[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];

  const { data, error } = await client
    .from("precios_pollo_mayorista")
    .select("fecha_boletin, precio_por_kg, precio_granja_por_kg, fuente_url")
    .gte("fecha_boletin", startDate)
    .lte("fecha_boletin", endDate)
    .order("fecha_boletin", { ascending: true });

  if (error) throw new AppError(databaseMessage(error), 500);
  return (data as Row[]).map(mapWholesaleChickenPrice);
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const client = getSupabaseBrowser();
  if (!client) return () => undefined;
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<User> {
  const client = configuredClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new AppError(error?.message ?? "No se pudo iniciar sesión.");
  return data.user;
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; confirmationRequired: boolean }> {
  const client = configuredClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new AppError(error.message);
  return { user: data.user, confirmationRequired: !data.session };
}

export async function signOut(): Promise<void> {
  const client = configuredClient();
  const { error } = await client.auth.signOut();
  if (error) throw new AppError(error.message);
}

export async function getDashboard(): Promise<LoadResult<{ campaigns: Campaign[]; galpones: Galpon[]; wholesaleChickenPrice: WholesaleChickenPrice | null }>> {
  const client = getSupabaseBrowser();
  if (!client) {
    return { data: { campaigns: demoCampaigns, galpones: demoGalpones, wholesaleChickenPrice: null }, source: "demo" };
  }

  const [campaignResponse, galponResponse, priceResponse] = await Promise.all([
    client.from("campanas").select(CAMPAIGN_SELECT).order("fecha_inicio", { ascending: false }),
    client.from("galpones").select("id, nombre, direccion").order("nombre"),
    client.from("precios_pollo_mayorista").select("fecha_boletin, precio_por_kg, precio_granja_por_kg, fuente_url").order("fecha_boletin", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (campaignResponse.error || galponResponse.error) {
    return {
      data: { campaigns: demoCampaigns, galpones: demoGalpones, wholesaleChickenPrice: null },
      source: "error",
      message: databaseMessage(campaignResponse.error ?? galponResponse.error),
    };
  }

  return {
    data: {
      campaigns: (campaignResponse.data as Row[]).map(mapCampaign),
      galpones: (galponResponse.data as Row[]).map(mapGalpon),
      wholesaleChickenPrice: priceResponse.data ? mapWholesaleChickenPrice(priceResponse.data as Row) : null,
    },
    source: "live",
  };
}

export async function getCampaign(id: string): Promise<LoadResult<Campaign | null>> {
  const client = getSupabaseBrowser();
  if (!client) {
    return { data: demoCampaigns.find((campaign) => campaign.id === id) ?? null, source: "demo" };
  }

  const { data, error } = await client.from("campanas").select(CAMPAIGN_SELECT).eq("id", id).maybeSingle();
  if (error) {
    return {
      data: demoCampaigns.find((campaign) => campaign.id === id) ?? null,
      source: "error",
      message: databaseMessage(error),
    };
  }

  return { data: data ? mapCampaign(data as Row) : null, source: "live" };
}

export function databaseIsConfigured(): boolean {
  return hasSupabaseConfiguration();
}

export async function createGalpon(input: GalponInput): Promise<Galpon> {
  const client = configuredClient();
  const { data, error } = await client
    .from("galpones")
    .insert({ nombre: input.nombre, direccion: input.direccion })
    .select("id, nombre, direccion")
    .single();
  if (error || !data) throw new AppError(databaseMessage(error), 500);
  return mapGalpon(data as Row);
}

export async function createCampaign(input: CampaignInput): Promise<string> {
  const client = configuredClient();
  const { data: pending, error: pendingError } = await client
    .from("campanas")
    .select("id")
    .eq("galpon_id", input.galponId)
    .in("estado", ["activa", "en_venta"])
    .limit(1);

  if (pendingError) throw new AppError(databaseMessage(pendingError), 500);
  if (pending && pending.length) throw new AppError("Ese galpón ya tiene una campaña activa o en venta.");

  const { data, error } = await client
    .from("campanas")
    .insert({
      galpon_id: input.galponId,
      fecha_inicio: input.fechaInicio,
      hembras_iniciales: input.hembrasIniciales,
      machos_iniciales: input.machosIniciales,
    })
    .select("id")
    .single();
  if (error || !data) throw new AppError(databaseMessage(error), 500);
  return String((data as Row).id);
}

export async function addMortality(campaignId: string, input: MortalityInput): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado !== "activa") throw new AppError("La mortalidad solo se registra en campañas activas.");
  const stats = calculateCampaignStats(campaign);
  if (input.hembrasMuertas > stats.hembrasVivas || input.machosMuertos > stats.machosVivos) {
    throw new AppError("La cantidad registrada supera las aves disponibles.");
  }

  const client = configuredClient();
  const { error } = await client.from("registros_mortalidad").insert({
    campana_id: campaignId,
    fecha_registro: input.fechaRegistro,
    hembras_muertas: input.hembrasMuertas,
    machos_muertos: input.machosMuertos,
  });
  if (error) throw new AppError(databaseMessage(error), 500);
}

export async function updateMortality(recordId: string, campaignId: string, input: MortalityInput): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado !== "activa") throw new AppError("La mortalidad solo se edita en campañas activas.");

  const client = configuredClient();
  const { data, error } = await client
    .from("registros_mortalidad")
    .update({
      fecha_registro: input.fechaRegistro,
      hembras_muertas: input.hembrasMuertas,
      machos_muertos: input.machosMuertos,
    })
    .eq("id", recordId)
    .eq("campana_id", campaignId)
    .select("id")
    .maybeSingle();

  if (error) throw new AppError(databaseMessage(error), 500);
  if (!data) throw new AppError("No encontramos el registro de mortalidad.", 404);
}

export async function deleteMortality(recordId: string, campaignId: string): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado !== "activa") throw new AppError("La mortalidad solo se elimina en campañas activas.");

  const client = configuredClient();
  const { data, error } = await client
    .from("registros_mortalidad")
    .delete()
    .eq("id", recordId)
    .eq("campana_id", campaignId)
    .select("id")
    .maybeSingle();

  if (error) throw new AppError(databaseMessage(error), 500);
  if (!data) throw new AppError("No encontramos el registro de mortalidad.", 404);
}

export async function addWeight(campaignId: string, input: WeightInput): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado !== "activa") throw new AppError("El peso solo se registra en campañas activas.");

  const client = configuredClient();
  const { error } = await client.from("registros_peso").insert({
    campana_id: campaignId,
    fecha_registro: input.fechaRegistro,
    peso_hembras_kg: input.pesoHembrasKg,
    peso_machos_kg: input.pesoMachosKg,
  });
  if (error) throw new AppError(databaseMessage(error), 500);
}

export async function updateWeight(recordId: string, campaignId: string, input: WeightInput): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado !== "activa") throw new AppError("El peso solo se edita en campañas activas.");

  const client = configuredClient();
  const { data, error } = await client
    .from("registros_peso")
    .update({
      fecha_registro: input.fechaRegistro,
      peso_hembras_kg: input.pesoHembrasKg,
      peso_machos_kg: input.pesoMachosKg,
    })
    .eq("id", recordId)
    .eq("campana_id", campaignId)
    .select("id")
    .maybeSingle();

  if (error) throw new AppError(databaseMessage(error), 500);
  if (!data) throw new AppError("No encontramos el registro de peso.", 404);
}

export async function deleteWeight(recordId: string, campaignId: string): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado !== "activa") throw new AppError("El peso solo se elimina en campañas activas.");

  const client = configuredClient();
  const { data, error } = await client
    .from("registros_peso")
    .delete()
    .eq("id", recordId)
    .eq("campana_id", campaignId)
    .select("id")
    .maybeSingle();

  if (error) throw new AppError(databaseMessage(error), 500);
  if (!data) throw new AppError("No encontramos el registro de peso.", 404);
}

export async function closeCampaign(campaignId: string, fechaFin: string): Promise<void> {
  const client = configuredClient();
  const { error } = await client.rpc("terminar_campana", {
    p_campana_id: campaignId,
    p_fecha_fin: fechaFin,
  });
  if (error) throw new AppError(databaseMessage(error), 500);
}

export async function createSale(campaignId: string, input: SaleInput): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado === "finalizada") throw new AppError("No se pueden registrar ventas en una campaña finalizada.");
  const stats = calculateCampaignStats(campaign);
  const newFemaleBirds = input.detalles
    .filter((detail) => detail.sexo === "hembra")
    .reduce((sum, detail) => sum + detail.cantidadJavas * detail.pollosPorJava, 0);
  const newMaleBirds = input.detalles
    .filter((detail) => detail.sexo === "macho")
    .reduce((sum, detail) => sum + detail.cantidadJavas * detail.pollosPorJava, 0);

  if (newFemaleBirds > stats.hembrasVivas - stats.hembrasVendidas) {
    throw new AppError("Esta venta supera las hembras disponibles.");
  }
  if (newMaleBirds > stats.machosVivos - stats.machosVendidos) {
    throw new AppError("Esta venta supera los machos disponibles.");
  }

  const client = configuredClient();
  const { data: sale, error: saleError } = await client
    .from("ventas")
    .insert({
      campana_id: campaignId,
      cliente: input.cliente,
      fecha_venta: input.fechaVenta,
      precio_por_kilo: input.precioPorKilo,
    })
    .select("id")
    .single();

  if (saleError || !sale) throw new AppError(databaseMessage(saleError), 500);
  const saleId = String((sale as Row).id);
  const { error: detailsError } = await client.from("detalles_venta_javas").insert(
    input.detalles.map((detail) => ({
      venta_id: saleId,
      sexo: detail.sexo,
      cantidad_javas: detail.cantidadJavas,
      pollos_por_java: detail.pollosPorJava,
      peso_java_kg: detail.pesoJavaKg,
      peso_java_con_aves_kg: detail.pesoJavaConAvesKg,
    })),
  );

  if (detailsError) {
    await client.from("ventas").delete().eq("id", saleId);
    throw new AppError(databaseMessage(detailsError), 500);
  }
}

export type ExpenseCatalog = {
  tipos: string[];
  descripciones: string[];
  formasPago: string[];
};

function normalizeCatalogValue(value: string): string {
  return value.trim().toLocaleUpperCase("es-PE");
}

async function getOrCreateCatalogValue(
  table: "tipos_gasto" | "descripciones_gasto" | "formas_pago_gasto",
  value: string,
): Promise<string> {
  const client = configuredClient();
  const nombre = normalizeCatalogValue(value);
  const { data: existing, error: existingError } = await client
    .from(table)
    .select("id")
    .eq("nombre", nombre)
    .maybeSingle();
  if (existingError) throw new AppError(databaseMessage(existingError), 500);
  if (existing) return String((existing as Row).id);

  const { data: created, error: createError } = await client
    .from(table)
    .insert({ nombre })
    .select("id")
    .maybeSingle();
  if (created) return String((created as Row).id);

  // Another session may have registered exactly the same value first.
  const { data: afterConflict, error: afterConflictError } = await client
    .from(table)
    .select("id")
    .eq("nombre", nombre)
    .maybeSingle();
  if (afterConflictError || !afterConflict) throw new AppError(databaseMessage(createError ?? afterConflictError), 500);
  return String((afterConflict as Row).id);
}

export async function getExpenseCatalog(): Promise<ExpenseCatalog> {
  const client = configuredClient();
  const [tipos, descripciones, formasPago] = await Promise.all([
    client.from("tipos_gasto").select("nombre").order("nombre"),
    client.from("descripciones_gasto").select("nombre").order("nombre"),
    client.from("formas_pago_gasto").select("nombre").order("nombre"),
  ]);
  if (tipos.error || descripciones.error || formasPago.error) {
    throw new AppError(databaseMessage(tipos.error ?? descripciones.error ?? formasPago.error), 500);
  }
  const names = (rows: unknown) => asRows(rows).map((row) => String(row.nombre));
  return { tipos: names(tipos.data), descripciones: names(descripciones.data), formasPago: names(formasPago.data) };
}

export async function createExpense(campaignId: string, input: ExpenseInput): Promise<void> {
  const campaign = await getLiveCampaign(campaignId);
  if (campaign.estado === "finalizada") throw new AppError("No se pueden registrar gastos en una campaña finalizada.");

  const [tipoGastoId, descripcionGastoId, formaPagoId] = await Promise.all([
    getOrCreateCatalogValue("tipos_gasto", input.tipo),
    getOrCreateCatalogValue("descripciones_gasto", input.descripcion),
    getOrCreateCatalogValue("formas_pago_gasto", input.formaPago),
  ]);
  const client = configuredClient();
  const { error } = await client.from("gastos_campana").insert({
    campana_id: campaignId,
    fecha: input.fecha,
    tipo_gasto_id: tipoGastoId,
    descripcion_gasto_id: descripcionGastoId,
    observacion: input.observacion.trim(),
    forma_pago_id: formaPagoId,
    bancos: input.bancos,
    egreso: input.egreso ?? null,
    ingreso: input.ingreso ?? null,
  });
  if (error) throw new AppError(databaseMessage(error), 500);
}

export async function finishSale(campaignId: string, fechaFin: string): Promise<void> {
  const client = configuredClient();
  const { error } = await client.rpc("terminar_venta", {
    p_campana_id: campaignId,
    p_fecha_fin: fechaFin,
  });
  if (error) throw new AppError(databaseMessage(error), 500);
}
