import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getLatestMidagriPrice } from "@/lib/midagri-price";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Falta configurar Supabase para la tarea programada." }, { status: 500 });
  }

  try {
    const price = await getLatestMidagriPrice();
    const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { error } = await supabase.from("precios_pollo_mayorista").upsert({
      fecha_boletin: price.fechaBoletin,
      precio_por_kg: price.precioPorKg,
      fuente_url: price.fuenteUrl,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: "fecha_boletin" });

    if (error) throw error;
    return NextResponse.json({ ok: true, ...price });
  } catch (error) {
    console.error("No se pudo actualizar el precio de pollo de MIDAGRI.", error);
    return NextResponse.json({ error: "No se pudo actualizar el precio desde MIDAGRI." }, { status: 502 });
  }
}
