import { NextResponse } from "next/server";

import { updateWholesaleChickenPrice } from "@/lib/update-wholesale-chicken-price";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const price = await updateWholesaleChickenPrice();
    return NextResponse.json({ ok: true, ...price });
  } catch (error) {
    console.error("No se pudo actualizar el precio de pollo de MIDAGRI.", error);
    return NextResponse.json({ error: "No se pudo actualizar el precio desde MIDAGRI." }, { status: 502 });
  }
}
