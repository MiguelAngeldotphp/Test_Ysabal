"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Modal } from "@/components/modal";
import {
  calculateCampaignStats,
  campaignStatusLabel,
  formatDate,
  type Campaign,
  type Galpon,
} from "@/lib/domain";
import {
  createCampaign,
  createGalpon,
  getDashboard,
  getWholesaleChickenPriceHistory,
  refreshWholesaleChickenPrice,
  signOut,
  type DataSource,
  type WholesaleChickenPrice,
} from "@/lib/repository";
import { campaignSchema, galponSchema, validationMessage } from "@/lib/validation";

type DashboardScreenProps = {
  mode: "live" | "demo";
};

type DialogName = "campaign" | "galpon" | "priceHistory" | null;

export function DashboardScreen({ mode }: DashboardScreenProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [galpones, setGalpones] = useState<Galpon[]>([]);
  const [wholesaleChickenPrice, setWholesaleChickenPrice] = useState<WholesaleChickenPrice | null>(null);
  const [priceHistory, setPriceHistory] = useState<WholesaleChickenPrice[]>([]);
  const [priceHistoryStart, setPriceHistoryStart] = useState(() => defaultPriceDateRange().start);
  const [priceHistoryEnd, setPriceHistoryEnd] = useState(() => defaultPriceDateRange().end);
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);
  const [priceMessage, setPriceMessage] = useState<string | null>(null);
  const [refreshingPrice, setRefreshingPrice] = useState(false);
  const [source, setSource] = useState<DataSource>(mode);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDashboard();
    setCampaigns(result.data.campaigns);
    setGalpones(result.data.galpones);
    setWholesaleChickenPrice(result.data.wholesaleChickenPrice);
    setSource(result.source);
    setNotice(result.message ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = mode === "live" && source === "live";

  async function handlePriceRefresh() {
    setRefreshingPrice(true);
    setPriceMessage(null);
    try {
      const updatedPrice = await refreshWholesaleChickenPrice();
      setWholesaleChickenPrice(updatedPrice);
      setPriceMessage(`Precio actualizado con el boletín del ${formatDate(updatedPrice.fechaBoletin)}.`);
    } catch (error) {
      setPriceMessage(error instanceof Error ? error.message : "No se pudo verificar el último boletín.");
    } finally {
      setRefreshingPrice(false);
    }
  }

  async function loadPriceHistory(startDate = priceHistoryStart, endDate = priceHistoryEnd) {
    if (startDate > endDate) {
      setPriceHistoryError("La fecha de inicio debe ser anterior a la fecha final.");
      return;
    }

    setLoadingPriceHistory(true);
    setPriceHistoryError(null);
    try {
      setPriceHistory(await getWholesaleChickenPriceHistory(startDate, endDate));
    } catch (error) {
      setPriceHistoryError(error instanceof Error ? error.message : "No se pudo obtener el historial de precios.");
    } finally {
      setLoadingPriceHistory(false);
    }
  }

  function openPriceHistory() {
    const range = defaultPriceDateRange();
    setPriceHistoryStart(range.start);
    setPriceHistoryEnd(range.end);
    setDialog("priceHistory");
    void loadPriceHistory(range.start, range.end);
  }

  function openDialog(name: Exclude<DialogName, null>) {
    setFormError(null);
    setDialog(name);
  }

  async function handleGalpon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = galponSchema.safeParse({
      nombre: form.get("nombre"),
      direccion: form.get("direccion"),
    });
    if (!parsed.success) {
      setFormError(validationMessage(parsed.error));
      return;
    }

    setBusy(true);
    try {
      await createGalpon(parsed.data);
      setDialog(null);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo crear el galpón.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = campaignSchema.safeParse({
      galponId: form.get("galponId"),
      hembrasIniciales: form.get("hembrasIniciales"),
      machosIniciales: form.get("machosIniciales"),
      fechaInicio: form.get("fechaInicio"),
    });
    if (!parsed.success) {
      setFormError(validationMessage(parsed.error));
      return;
    }

    setBusy(true);
    try {
      const campaignId = await createCampaign(parsed.data);
      window.location.assign(`/campanas/${campaignId}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo iniciar la campaña.");
      setBusy(false);
    }
  }

  return (
    <main className="app-page">
      <section className="page-shell">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Operación avícola</p>
            <h1>Campañas</h1>
            <p>Consulta las campañas activas y las que ya están en venta.</p>
          </div>
          <div className="heading-actions">
            {mode === "live" ? (
              <button className="button button-quiet" onClick={() => void signOut()} type="button">
                Cerrar sesión
              </button>
            ) : null}
            <button className="button button-secondary" disabled={!canEdit} onClick={() => openDialog("galpon")} type="button">
              Galpones
            </button>
            <button className="button button-primary" disabled={!canEdit} onClick={() => openDialog("campaign")} type="button">
              + Nueva campaña
            </button>
          </div>
        </header>

        {source === "demo" ? (
          <section className="notice notice-info">
            <strong>Vista de demostración.</strong> Agrega las variables públicas de Supabase para registrar datos reales.
          </section>
        ) : null}
        {source === "error" ? (
          <section className="notice notice-danger">
            <strong>No pudimos leer tu base de datos.</strong> {notice ?? "Revisa que las migraciones estén ejecutadas."}
          </section>
        ) : null}

        <section className="market-price-card" aria-label="Precio mayorista de pollo">
          <div className="market-price-heading">
            <span className="market-price-bulletin">{wholesaleChickenPrice ? `Boletín: ${formatBulletinDate(wholesaleChickenPrice.fechaBoletin)}` : "Boletín pendiente"}</span>
            <p className="eyebrow">Referencia de mercado</p>
            <h2>Precios x Kg.</h2>
          </div>
          <div className="market-price-values">
            <div className="market-price-value">
              <strong>{wholesaleChickenPrice ? `S/ ${wholesaleChickenPrice.precioPorKg.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</strong>
              <span>Mayorista</span>
            </div>
            <div className="market-price-value">
              <strong>{wholesaleChickenPrice?.precioGranjaPorKg === null || !wholesaleChickenPrice ? "—" : `S/ ${wholesaleChickenPrice.precioGranjaPorKg.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong>
              <span>{wholesaleChickenPrice?.precioGranjaPorKg === null ? "Granja pendiente" : "Granja"}</span>
            </div>
          </div>
          <div className="market-price-actions">
            <button className="button button-secondary market-price-button" disabled={source !== "live"} onClick={openPriceHistory} type="button">
              Ver gráfico
            </button>
            <button className="button button-secondary market-price-button" disabled={!canEdit || refreshingPrice} onClick={() => void handlePriceRefresh()} type="button">
              {refreshingPrice ? "Verificando…" : "Verificar último boletín"}
            </button>
            {wholesaleChickenPrice ? (
              <a className="button button-secondary market-price-button" href={wholesaleChickenPrice.fuenteUrl} rel="noreferrer" target="_blank">
                Ver PDF fuente
              </a>
            ) : <span aria-disabled="true" className="button button-secondary button-disabled market-price-button">Ver PDF fuente</span>}
          </div>
        </section>
        {priceMessage ? <p className="market-price-message" role="status">{priceMessage}</p> : null}

        <section className="panel campaigns-panel">
          <div className="panel-header">
            <div>
              <h2>Campañas registradas</h2>
              <p>{loading ? "Cargando información…" : `${campaigns.length} campaña${campaigns.length === 1 ? "" : "s"} registrada${campaigns.length === 1 ? "" : "s"}.`}</p>
            </div>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : campaigns.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Galpón</th>
                    <th>Estado</th>
                    <th>Aves actuales</th>
                    <th>Mortalidad</th>
                    <th>Inicio</th>
                    <th>Día de campaña</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const stats = calculateCampaignStats(campaign);
                    return (
                      <tr key={campaign.id}>
                        <td>
                          <strong>{campaign.galpon.nombre}</strong>
                          <span className="cell-detail">{campaign.galpon.direccion}</span>
                        </td>
                        <td><StatusPill status={campaign.estado} /></td>
                        <td>
                          <strong>{stats.avesVivas.toLocaleString("es-PE")}</strong>
                          <span className="cell-detail">H {stats.hembrasVivas.toLocaleString("es-PE")} · M {stats.machosVivos.toLocaleString("es-PE")}</span>
                        </td>
                        <td>
                          <strong>{stats.tasaMortalidad.toFixed(2)}%</strong>
                          <span className="cell-detail">{stats.mortalidadTotal.toLocaleString("es-PE")} aves</span>
                        </td>
                        <td>{formatDate(campaign.fechaInicio)}</td>
                        <td>
                          <strong>Día {stats.diasCrianza.toLocaleString("es-PE")}</strong>
                        </td>
                        <td className="action-cell">
                          <Link className="table-link" href={`/campanas/${campaign.id}`}>Ver detalle</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCampaigns onNewCampaign={() => openDialog("campaign")} />
          )}
        </section>
      </section>

      {dialog === "galpon" ? (
        <Modal description="Crea los galpones que usarás para iniciar campañas." onClose={() => setDialog(null)} title="Galpones">
          <div className="modal-body">
            <div className="compact-list">
              {galpones.length ? galpones.map((galpon) => (
                <div className="compact-list-item" key={galpon.id}>
                  <strong>{galpon.nombre}</strong>
                  <span>{galpon.direccion}</span>
                </div>
              )) : <p className="empty-inline">Aún no hay galpones registrados.</p>}
            </div>
            <form className="stack-form form-divider" onSubmit={handleGalpon}>
              <h3>Nuevo galpón</h3>
              <label>
                Nombre
                <input name="nombre" placeholder="Ej. Galpón San José" required />
              </label>
              <label>
                Dirección
                <input name="direccion" placeholder="Ej. Sector San José, Lote 4" required />
              </label>
              <FormError message={formError} />
              <div className="form-actions">
                <button className="button button-secondary" onClick={() => setDialog(null)} type="button">Cancelar</button>
                <button className="button button-primary" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar galpón"}</button>
              </div>
            </form>
          </div>
        </Modal>
      ) : null}

      {dialog === "campaign" ? (
        <Modal description="Registra las aves con las que empieza la nueva crianza." onClose={() => setDialog(null)} title="Nueva campaña">
          <form className="modal-body stack-form" onSubmit={handleCampaign}>
            {!galpones.length ? (
              <section className="notice notice-info">
                Primero registra al menos un galpón desde el botón “Galpones”.
              </section>
            ) : (
              <>
                <label>
                  Galpón
                  <select defaultValue="" name="galponId" required>
                    <option disabled value="">Selecciona un galpón</option>
                    {galpones.map((galpon) => <option key={galpon.id} value={galpon.id}>{galpon.nombre}</option>)}
                  </select>
                </label>
                <div className="two-columns">
                  <label>
                    Pollitas hembra
                    <input min="1" name="hembrasIniciales" required type="number" />
                  </label>
                  <label>
                    Pollitos macho
                    <input min="1" name="machosIniciales" required type="number" />
                  </label>
                </div>
                <label>
                  Fecha de inicio
                  <input defaultValue={new Date().toISOString().slice(0, 10)} name="fechaInicio" required type="date" />
                </label>
              </>
            )}
            <FormError message={formError} />
            <div className="form-actions">
              <button className="button button-secondary" onClick={() => setDialog(null)} type="button">Cancelar</button>
              <button className="button button-primary" disabled={busy || !galpones.length} type="submit">
                {busy ? "Creando…" : "Iniciar campaña"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "priceHistory" ? (
        <Modal description="Compara la evolución diaria del precio mayorista y de granja." onClose={() => setDialog(null)} size="wide" title="Historial de precios de pollo">
          <div className="modal-body price-history-modal">
            <form className="price-history-filters" onSubmit={(event) => { event.preventDefault(); void loadPriceHistory(); }}>
              <label>
                Fecha de inicio
                <input max={priceHistoryEnd} onChange={(event) => setPriceHistoryStart(event.target.value)} required type="date" value={priceHistoryStart} />
              </label>
              <label>
                Fecha de fin
                <input min={priceHistoryStart} onChange={(event) => setPriceHistoryEnd(event.target.value)} required type="date" value={priceHistoryEnd} />
              </label>
              <button className="button button-secondary" disabled={loadingPriceHistory} type="submit">{loadingPriceHistory ? "Actualizando…" : "Aplicar filtro"}</button>
            </form>
            {priceHistoryError ? <p className="form-message" role="alert">{priceHistoryError}</p> : null}
            {loadingPriceHistory ? <p className="empty-inline">Cargando historial…</p> : priceHistory.length ? <PriceHistoryChart prices={priceHistory} /> : <p className="empty-inline">No hay boletines registrados en este rango.</p>}
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

export function StatusPill({ status }: { status: Campaign["estado"] }) {
  return <span className={`status-pill status-${status}`}>{campaignStatusLabel(status)}</span>;
}

function FormError({ message }: { message: string | null }) {
  return message ? <p className="form-message" role="alert">{message}</p> : null;
}

function EmptyCampaigns({ onNewCampaign }: { onNewCampaign: () => void }) {
  return (
    <div className="empty-inline empty-campaigns">
      <h3>Aún no hay campañas</h3>
      <p>Cuando ingreses la primera crianza, aquí podrás seguir su mortalidad, pesos y ventas.</p>
      <button className="button button-primary" onClick={onNewCampaign} type="button">Nueva campaña</button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="skeleton-table" aria-label="Cargando campañas">
      <span /><span /><span /><span />
      <span /><span /><span /><span />
      <span /><span /><span /><span />
    </div>
  );
}

function defaultPriceDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  return { start: dateInputValue(start), end: dateInputValue(end) };
}

function dateInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatBulletinDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("es-PE", { month: "long" }).format(new Date(year, month - 1, 1));
  return `${String(day).padStart(2, "0")} ${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

function PriceHistoryChart({ prices }: { prices: WholesaleChickenPrice[] }) {
  const left = 58;
  const right = 24;
  const chartWidth = Math.max(720, prices.length * 58 + left + right);
  const chartHeight = 330;
  const top = 22;
  const bottom = 76;
  const values = prices.flatMap((price) => [price.precioPorKg, price.precioGranjaPorKg].filter((value): value is number => value !== null));
  const high = Math.max(...values);
  const padding = Math.max(high * 0.12, 0.3);
  const min = 0;
  const max = high + padding;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const groupWidth = plotWidth / prices.length;
  const barWidth = Math.max(10, Math.min(22, (groupWidth - 10) / 2));
  const groupCenter = (index: number) => left + groupWidth * index + groupWidth / 2;
  const y = (value: number) => top + (max - value) / (max - min) * plotHeight;
  const labels = [0, 0.5, 1].map((position) => min + (max - min) * position);
  const baseline = y(0);

  return (
    <div className="price-chart-wrap">
      <div className="price-chart-legend"><span><i className="price-line-majorista" />Mayorista</span><span><i className="price-line-granja" />Granja</span></div>
      <svg aria-label="Gráfico de evolución de precios por kilogramo" className="price-chart" role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {labels.map((value) => <g key={value}><line className="price-chart-grid" x1={left} x2={chartWidth - right} y1={y(value)} y2={y(value)} /><text className="price-chart-axis" textAnchor="end" x={left - 10} y={y(value) + 4}>S/ {value.toFixed(2)}</text></g>)}
        {prices.map((price, index) => {
          const center = groupCenter(index);
          const majoristaY = y(price.precioPorKg);
          const granjaPrice = price.precioGranjaPorKg;
          const majoristaX = center - barWidth - 2;
          const granjaX = center + 2;
          return (
            <g key={price.fechaBoletin}>
              <rect className="price-chart-bar price-chart-bar-majorista" height={baseline - majoristaY} rx="2" width={barWidth} x={majoristaX} y={majoristaY} />
              <text className="price-chart-bar-value" dominantBaseline="middle" textAnchor="middle" transform={`translate(${majoristaX + barWidth / 2} ${majoristaY + (baseline - majoristaY) / 2}) rotate(-90)`}>{price.precioPorKg.toFixed(2)}</text>
              {granjaPrice !== null ? <>
                <rect className="price-chart-bar price-chart-bar-granja" height={baseline - y(granjaPrice)} rx="2" width={barWidth} x={granjaX} y={y(granjaPrice)} />
                <text className="price-chart-bar-value" dominantBaseline="middle" textAnchor="middle" transform={`translate(${granjaX + barWidth / 2} ${y(granjaPrice) + (baseline - y(granjaPrice)) / 2}) rotate(-90)`}>{granjaPrice.toFixed(2)}</text>
              </> : null}
              <text className="price-chart-date" textAnchor="end" transform={`translate(${center + 8} ${chartHeight - 18}) rotate(-48)`}>{shortChartDate(price.fechaBoletin)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function shortChartDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}
