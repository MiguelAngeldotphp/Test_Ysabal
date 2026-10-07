import pdf from "pdf-parse/lib/pdf-parse.js";

const COLLECTION_URL = "https://www.gob.pe/institucion/midagri/colecciones/4-boletin-diario-de-comercializacion-y-precio-de-aves";

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  setiembre: 8,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

export type MidagriPrice = {
  fechaBoletin: string;
  precioPorKg: number;
  precioGranjaPorKg: number;
  fuenteUrl: string;
};

function normalizeUrl(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/\\\\/g, "/")
    .replace(/["'),]+$/, "");
}

function parsePrice(text: string): number | null {
  const match = text.match(
    /S\/\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:[\d,.]+\s*t\s*)?Precio\s+promedio\s+por\s+kg\s+de\s+pollo\s+al\s+por\s+mayor/i,
  ) ?? text.match(/pollo\s+en\s+pie\s+se\s+vendi[oó]\s+a\s+S\/\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (!match) return null;

  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseFarmPrice(text: string): number | null {
  const row = text.match(/Granja\s*([\s\S]{0,80}?)(?=Mayorista|Consumidor|Peso\s+promedio|Oferta)/i);
  if (!row) return null;

  const prices = [...row[1].matchAll(/\d+[.,]\d{1,2}/g)]
    .map((match) => Number(match[0].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);
  // El boletín muestra tres días y luego la variación porcentual: el tercer importe es el actual.
  const currentPrice = prices[2] ?? prices.at(-1);
  return currentPrice ?? null;
}

function parseDate(text: string): string | null {
  const match = text.match(
    /(?:Lima,\s*|(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),\s*)(\d{1,2})\s+de\s+([a-záéíóú]+)\s+del?\s+(\d{4})/i,
  );
  if (!match) return null;

  const month = MONTHS[match[2].toLocaleLowerCase("es-PE")];
  if (month === undefined) return null;

  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function pdfLinks(html: string): string[] {
  const matches = html.matchAll(/https?:\/\/[^"'\s<>]+?\.pdf(?:\?[^"'\s<>]+)?/gi);
  return [...new Set([...matches].map((match) => normalizeUrl(match[0])))]
    .filter((url) => /aves|avicola|av[ií]cola/i.test(url));
}

function bulletinLinks(html: string): string[] {
  const matches = html.matchAll(/href=["']([^"']*\/institucion\/midagri\/informes-publicaciones\/[^"']*aves[^"']*)["']/gi);
  return [...new Set([...matches].map((match) => new URL(normalizeUrl(match[1]), COLLECTION_URL).href))];
}

async function fetchPdf(url: string): Promise<MidagriPrice | null> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "YSABAL price updater/1.0" },
  });
  if (!response.ok) return null;

  const data = await pdf(Buffer.from(await response.arrayBuffer()));
  const precioPorKg = parsePrice(data.text);
  const precioGranjaPorKg = parseFarmPrice(data.text);
  const fechaBoletin = parseDate(data.text);
  return precioPorKg && precioGranjaPorKg && fechaBoletin
    ? { precioPorKg, precioGranjaPorKg, fechaBoletin, fuenteUrl: url }
    : null;
}

export async function getLatestMidagriPrice(): Promise<MidagriPrice> {
  const configuredUrl = process.env.MIDAGRI_BOLETIN_URL?.trim();
  if (configuredUrl) {
    const result = await fetchPdf(configuredUrl);
    if (!result) throw new Error("No pudimos extraer el precio del PDF configurado de MIDAGRI.");
    return result;
  }

  const response = await fetch(COLLECTION_URL, {
    cache: "no-store",
    headers: { "User-Agent": "YSABAL price updater/1.0" },
  });
  if (!response.ok) throw new Error(`MIDAGRI respondió con estado ${response.status}.`);

  const collectionHtml = await response.text();
  const directCandidates = pdfLinks(collectionHtml);
  for (const url of directCandidates) {
    const result = await fetchPdf(url);
    if (result) return result;
  }

  for (const bulletinUrl of bulletinLinks(collectionHtml).slice(0, 5)) {
    const bulletinResponse = await fetch(bulletinUrl, {
      cache: "no-store",
      headers: { "User-Agent": "YSABAL price updater/1.0" },
    });
    if (!bulletinResponse.ok) continue;

    for (const pdfUrl of pdfLinks(await bulletinResponse.text()).slice(0, 10)) {
      const result = await fetchPdf(pdfUrl);
      if (result) return result;
    }
  }

  throw new Error("No encontramos un boletín de aves con un precio extraíble en MIDAGRI.");
}
