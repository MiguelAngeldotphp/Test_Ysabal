import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { updateWholesaleChickenPrice } from "@/lib/update-wholesale-chicken-price";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !publishableKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const authClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    const price = await updateWholesaleChickenPrice();
    return NextResponse.json({ ok: true, ...price });
  } catch (updateError) {
    console.error("No se pudo actualizar manualmente el precio de pollo de MIDAGRI.", updateError);
    return NextResponse.json({ error: "No se pudo actualizar el precio desde MIDAGRI." }, { status: 502 });
  }
}
