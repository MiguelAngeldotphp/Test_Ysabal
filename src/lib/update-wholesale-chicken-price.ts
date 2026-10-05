import { createClient } from "@supabase/supabase-js";

import { getLatestMidagriPrice, type MidagriPrice } from "@/lib/midagri-price";

export async function updateWholesaleChickenPrice(): Promise<MidagriPrice> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Falta configurar Supabase para la actualización de precios.");
  }

  const price = await getLatestMidagriPrice();
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("precios_pollo_mayorista").upsert({
    fecha_boletin: price.fechaBoletin,
    precio_por_kg: price.precioPorKg,
    fuente_url: price.fuenteUrl,
    actualizado_en: new Date().toISOString(),
  }, { onConflict: "fecha_boletin" });

  if (error) throw error;
  return price;
}
