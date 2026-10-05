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
  signOut,
  type DataSource,
} from "@/lib/repository";
import { campaignSchema, galponSchema, validationMessage } from "@/lib/validation";

type DashboardScreenProps = {
  mode: "live" | "demo";
};

type DialogName = "campaign" | "galpon" | null;

export function DashboardScreen({ mode }: DashboardScreenProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [galpones, setGalpones] = useState<Galpon[]>([]);
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
    setSource(result.source);
    setNotice(result.message ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = mode === "live" && source === "live";

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
