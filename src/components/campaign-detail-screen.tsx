"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Modal } from "@/components/modal";
import { StatusPill } from "@/components/dashboard-screen";
import {
  birdSexLabel,
  calculateCampaignStats,
  daysSince,
  formatDate,
  formatKg,
  formatShortDate,
  formatSoles,
  saleBirds,
  saleGrossKg,
  saleNetKg,
  todayISO,
  type BirdSex,
  type Campaign,
  type CampaignStats,
  type Expense,
  type MortalityRecord,
  type Sale,
  type SaleDetail,
  type WeightRecord,
} from "@/lib/domain";
import {
  addMortality,
  addWeight,
  closeCampaign,
  createExpense,
  createSale,
  deleteMortality,
  deleteWeight,
  finishSale,
  getCampaign,
  getExpenseCatalog,
  type DataSource,
  updateMortality,
  updateWeight,
} from "@/lib/repository";
import {
  closeCampaignSchema,
  finishSaleSchema,
  expenseSchema,
  mortalitySchema,
  saleDetailSchema,
  saleSchema,
  validationMessage,
  weightSchema,
} from "@/lib/validation";

const WEIGHT_GUIDE = [
  [1, "40–50 g"],
  [7, "160–200 g"],
  [14, "450–500 g"],
  [21, "900–1,000 g"],
  [28, "1,500–1,700 g"],
  [35, "2,100–2,400 g"],
  [42, "2,800–3,200 g"],
  [49, "3,500–3,800 g"],
] as const;

type CampaignDetailScreenProps = {
  campaignId: string;
  mode: "live" | "demo";
};

type Toast = { tone: "success" | "error"; text: string } | null;
type DetailTab = "registros" | "ventas" | "gastos";
type RecordToDelete =
  | { kind: "mortalidad"; record: MortalityRecord }
  | { kind: "peso"; record: WeightRecord };

export function CampaignDetailScreen({ campaignId, mode }: CampaignDetailScreenProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [source, setSource] = useState<DataSource>(mode);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("registros");
  const [showWeightGuide, setShowWeightGuide] = useState(false);
  const [showCloseCampaign, setShowCloseCampaign] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showFinishSale, setShowFinishSale] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingMortality, setEditingMortality] = useState<MortalityRecord | null>(null);
  const [editingWeight, setEditingWeight] = useState<WeightRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<RecordToDelete | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCampaign(campaignId);
      setCampaign(result.data);
      setSource(result.source);
      setNotice(result.message ?? null);
    } catch (error) {
      setCampaign(null);
      setSource("error");
      setNotice(error instanceof Error ? error.message : "No se pudo cargar la campaña.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = mode === "live" && source === "live";

  async function perform(action: () => Promise<void>, success: string) {
    try {
      await action();
      await load();
      setToast({ tone: "success", text: success });
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar el cambio." });
      throw error;
    }
  }

  if (loading) return <DetailLoading />;

  if (!campaign) {
    return (
      <main className="app-page">
        <section className="page-shell">
          <Link className="back-link" href="/">Campañas</Link>
          <section className="empty-state">
            <h1>No encontramos esta campaña</h1>
            <p>{notice ?? "Puede que ya no exista o que no tengas acceso a ella."}</p>
          </section>
        </section>
      </main>
    );
  }

  const stats = calculateCampaignStats(campaign);
  const recordMax = campaign.fechaFin ?? todayISO();

  return (
    <main className="app-page">
      <section className="page-shell detail-shell">
        <header className="detail-heading">
          <div>
            <Link className="back-link" href="/">Volver a campañas</Link>
            <div className="title-row">
              <h1>{campaign.galpon.nombre}</h1>
              <StatusPill status={campaign.estado} />
            </div>
            <p>Campaña iniciada el {formatDate(campaign.fechaInicio)}</p>
          </div>
          <CampaignActions
            campaign={campaign}
            canEdit={canEdit}
            onCloseCampaign={() => setShowCloseCampaign(true)}
            onNewSale={() => setShowSaleForm(true)}
            onNewExpense={() => setShowExpenseForm(true)}
            onFinishSale={() => setShowFinishSale(true)}
          />
        </header>

        {source === "demo" ? (
          <section className="notice notice-info">
            <strong>Vista de demostración.</strong> Conecta Supabase para registrar cambios reales.
          </section>
        ) : null}
        {source === "error" ? (
          <section className="notice notice-danger">
            <strong>No pudimos leer tu base de datos.</strong> {notice ?? "Revisa la configuración y las migraciones."}
          </section>
        ) : null}
        {toast ? <p className={`toast toast-${toast.tone}`} role="status">{toast.text}</p> : null}

        <CampaignMetrics stats={stats} />

        <section className="detail-tabs" aria-label="Secciones de la campaña" role="tablist">
          <button aria-controls="campaign-records" aria-selected={activeTab === "registros"} className={activeTab === "registros" ? "detail-tab detail-tab-active" : "detail-tab"} id="campaign-tab-records" onClick={() => setActiveTab("registros")} role="tab" type="button">Mortalidad y peso</button>
          <button aria-controls="campaign-sales" aria-selected={activeTab === "ventas"} className={activeTab === "ventas" ? "detail-tab detail-tab-active" : "detail-tab"} id="campaign-tab-sales" onClick={() => setActiveTab("ventas")} role="tab" type="button">Ventas</button>
          <button aria-controls="campaign-expenses" aria-selected={activeTab === "gastos"} className={activeTab === "gastos" ? "detail-tab detail-tab-active" : "detail-tab"} id="campaign-tab-expenses" onClick={() => setActiveTab("gastos")} role="tab" type="button">Gastos e ingresos</button>
        </section>

        {activeTab === "registros" ? (
          <section aria-labelledby="campaign-tab-records" id="campaign-records" role="tabpanel">
            <section className="mortality-indicator panel">
              <div><p className="eyebrow">Indicador de mortalidad</p><h2>{stats.tasaMortalidad.toFixed(2)}% de la población inicial</h2></div>
              <div aria-label={`Mortalidad de ${stats.tasaMortalidad.toFixed(2)} por ciento`} className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, stats.tasaMortalidad)}%` }} /></div>
            </section>
            {campaign.estado === "activa" ? (
              <>
                <section className="record-pair"><MortalityHistoryCard campaign={campaign} canEdit={canEdit} onDelete={(record) => setRecordToDelete({ kind: "mortalidad", record })} onEdit={setEditingMortality} /><MortalityForm campaign={campaign} canEdit={canEdit} maxDate={recordMax} onSubmit={async (payload) => { await perform(() => addMortality(campaign.id, payload), "Registro de mortalidad guardado."); }} /></section>
                <section className="record-pair"><WeightHistoryCard campaign={campaign} canEdit={canEdit} onDelete={(record) => setRecordToDelete({ kind: "peso", record })} onEdit={setEditingWeight} /><WeightForm campaign={campaign} canEdit={canEdit} maxDate={recordMax} onGuide={() => setShowWeightGuide(true)} onSubmit={async (payload) => { await perform(() => addWeight(campaign.id, payload), "Registro de peso guardado."); }} /></section>
              </>
            ) : <section className="record-pair records-history-pair"><MortalityHistoryCard campaign={campaign} /><WeightHistoryCard campaign={campaign} /></section>}
          </section>
        ) : null}

        {activeTab === "ventas" ? (
          <section aria-labelledby="campaign-tab-sales" id="campaign-sales" role="tabpanel">
            <SalesSection campaign={campaign} canEdit={canEdit} onDetail={setSelectedSale} onNewSale={() => setShowSaleForm(true)} />
            {campaign.estado === "finalizada" ? <section className="final-loss panel"><div><p className="eyebrow">Pérdida al finalizar venta</p><h2>{stats.perdidasFinales.toLocaleString("es-PE")} aves no vendidas</h2></div><p>H {campaign.perdidaHembras.toLocaleString("es-PE")} · M {campaign.perdidaMachos.toLocaleString("es-PE")}</p></section> : null}
          </section>
        ) : null}

        {activeTab === "gastos" ? <section aria-labelledby="campaign-tab-expenses" id="campaign-expenses" role="tabpanel"><ExpensesSection campaign={campaign} canEdit={canEdit} onNewExpense={() => setShowExpenseForm(true)} /></section> : null}
      </section>

      {showWeightGuide ? (
        <WeightGuideModal currentDay={stats.diasCrianza} onClose={() => setShowWeightGuide(false)} />
      ) : null}
      {showCloseCampaign ? (
        <CloseCampaignModal
          campaign={campaign}
          onClose={() => setShowCloseCampaign(false)}
          onConfirm={async (date) => {
            await perform(() => closeCampaign(campaign.id, date), "La campaña terminó y continúa en venta.");
            setShowCloseCampaign(false);
          }}
        />
      ) : null}
      {showSaleForm ? (
        <SaleFormModal
          campaign={campaign}
          onClose={() => setShowSaleForm(false)}
          onConfirm={async (payload) => {
            await perform(() => createSale(campaign.id, payload), "Venta registrada correctamente.");
            setShowSaleForm(false);
          }}
        />
      ) : null}
      {showExpenseForm ? (
        <ExpenseFormModal
          campaign={campaign}
          onClose={() => setShowExpenseForm(false)}
          onConfirm={async (payload) => {
            await perform(() => createExpense(campaign.id, payload), "Movimiento registrado correctamente.");
            setShowExpenseForm(false);
          }}
        />
      ) : null}
      {showFinishSale ? (
        <FinishSaleModal
          campaign={campaign}
          stats={stats}
          onClose={() => setShowFinishSale(false)}
          onConfirm={async (date) => {
            await perform(() => finishSale(campaign.id, date), "La venta terminó y la campaña quedó finalizada.");
            setShowFinishSale(false);
          }}
        />
      ) : null}
      {selectedSale ? <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} /> : null}
      {editingMortality ? (
        <EditMortalityModal
          campaign={campaign}
          onClose={() => setEditingMortality(null)}
          onConfirm={async (input) => {
            await perform(() => updateMortality(editingMortality.id, campaign.id, input), "Registro de mortalidad actualizado.");
            setEditingMortality(null);
          }}
          record={editingMortality}
        />
      ) : null}
      {editingWeight ? (
        <EditWeightModal
          campaign={campaign}
          onClose={() => setEditingWeight(null)}
          onConfirm={async (input) => {
            await perform(() => updateWeight(editingWeight.id, campaign.id, input), "Registro de peso actualizado.");
            setEditingWeight(null);
          }}
          record={editingWeight}
        />
      ) : null}
      {recordToDelete ? (
        <DeleteRecordModal
          record={recordToDelete}
          onClose={() => setRecordToDelete(null)}
          onConfirm={async () => {
            if (recordToDelete.kind === "mortalidad") {
              await perform(() => deleteMortality(recordToDelete.record.id, campaign.id), "Registro de mortalidad eliminado.");
            } else {
              await perform(() => deleteWeight(recordToDelete.record.id, campaign.id), "Registro de peso eliminado.");
            }
            setRecordToDelete(null);
          }}
        />
      ) : null}
    </main>
  );
}

function CampaignActions({
  campaign,
  canEdit,
  onCloseCampaign,
  onNewSale,
  onNewExpense,
  onFinishSale,
}: {
  campaign: Campaign;
  canEdit: boolean;
  onCloseCampaign: () => void;
  onNewSale: () => void;
  onNewExpense: () => void;
  onFinishSale: () => void;
}) {
  if (campaign.estado === "activa") {
    return (
      <div className="heading-actions">
        <button className="button button-secondary" disabled={!canEdit} onClick={onNewExpense} type="button">Registrar gasto</button>
        <button className="button button-secondary" disabled={!canEdit} onClick={onNewSale} type="button">Registrar venta</button>
        <button className="button button-primary" disabled={!canEdit} onClick={onCloseCampaign} type="button">Terminar campaña</button>
      </div>
    );
  }
  if (campaign.estado === "en_venta") {
    return (
      <div className="heading-actions">
        <button className="button button-secondary" disabled={!canEdit} onClick={onNewExpense} type="button">Registrar gasto</button>
        <button className="button button-secondary" disabled={!canEdit} onClick={onNewSale} type="button">Registrar venta</button>
        <button className="button button-primary" disabled={!canEdit} onClick={onFinishSale} type="button">Terminar venta</button>
      </div>
    );
  }
  return null;
}

function CampaignMetrics({ stats }: { stats: CampaignStats }) {
  return (
    <section className="metric-grid">
      <article className="metric-card">
        <p>Población inicial</p>
        <strong>{stats.poblacionInicial.toLocaleString("es-PE")}</strong>
        <span>aves</span>
      </article>
      <article className="metric-card mortality-metric">
        <p>Mortalidad</p>
        <strong>{stats.mortalidadTotal.toLocaleString("es-PE")}</strong>
        <span>{stats.tasaMortalidad.toFixed(2)}%</span>
        <small>H {stats.hembrasMuertas.toLocaleString("es-PE")} · M {stats.machosMuertos.toLocaleString("es-PE")}</small>
      </article>
      <article className="metric-card">
        <p>Aves vivas estimadas</p>
        <strong>{stats.avesVivas.toLocaleString("es-PE")}</strong>
        <span>aves</span>
      </article>
      <article className="metric-card">
        <p>Días de crianza</p>
        <strong>{stats.diasCrianza.toLocaleString("es-PE")}</strong>
        <span>desde el inicio</span>
      </article>
    </section>
  );
}

function MortalityHistoryCard({
  campaign,
  canEdit = false,
  onEdit,
  onDelete,
}: {
  campaign: Campaign;
  canEdit?: boolean;
  onEdit?: (record: MortalityRecord) => void;
  onDelete?: (record: MortalityRecord) => void;
}) {
  return (
    <article className="panel records-card records-history-card">
      <header className="panel-header">
        <div><h2>Registros de mortalidad</h2><p>Bajas registradas en la campaña.</p></div>
      </header>
      {campaign.mortalidad.length ? (
        <div aria-label="Lista de registros de mortalidad" className="record-list">
          {campaign.mortalidad.map((record) => (
            <div className="record-list-item" key={record.id}>
              <div>
                <strong>{formatShortDate(record.fechaRegistro)}</strong>
                <span className="day-pill">Día {daysSince(campaign.fechaInicio, record.fechaRegistro)}</span>
              </div>
              <div className="record-summary mortality-text">
                <strong>{(record.hembrasMuertas + record.machosMuertos).toLocaleString("es-PE")} aves</strong>
                <span>H {record.hembrasMuertas.toLocaleString("es-PE")} · M {record.machosMuertos.toLocaleString("es-PE")}</span>
              </div>
              {canEdit && onEdit && onDelete ? (
                <div className="record-actions">
                  <button className="table-link" onClick={() => onEdit(record)} type="button">Editar</button>
                  <button className="table-link danger-link" onClick={() => onDelete(record)} type="button">Eliminar</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : <p className="empty-inline">Sin registros.</p>}
    </article>
  );
}

function MortalityForm({
  campaign,
  canEdit,
  maxDate,
  onSubmit,
}: {
  campaign: Campaign;
  canEdit: boolean;
  maxDate: string;
  onSubmit: (payload: { hembrasMuertas: number; machosMuertos: number; fechaRegistro: string }) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = mortalitySchema.safeParse({
      hembrasMuertas: form.get("hembrasMuertas"),
      machosMuertos: form.get("machosMuertos"),
      fechaRegistro: form.get("fechaRegistro"),
    });
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(parsed.data);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel records-card">
      <header className="panel-header">
        <div><h2>Registrar mortalidad</h2><p>Ingresa las bajas del día.</p></div>
      </header>
      <form className="record-form" onSubmit={submit}>
        <div className="two-columns">
          <label>Hembras muertas<input defaultValue="0" min="0" name="hembrasMuertas" required type="number" /></label>
          <label>Machos muertos<input defaultValue="0" min="0" name="machosMuertos" required type="number" /></label>
        </div>
        <label>Fecha<input defaultValue={maxDate} max={maxDate} min={campaign.fechaInicio} name="fechaRegistro" required type="date" /></label>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <button className="button button-primary" disabled={busy || !canEdit} type="submit">{busy ? "Guardando…" : "Guardar registro"}</button>
      </form>
    </article>
  );
}

function WeightHistoryCard({
  campaign,
  canEdit = false,
  onEdit,
  onDelete,
}: {
  campaign: Campaign;
  canEdit?: boolean;
  onEdit?: (record: WeightRecord) => void;
  onDelete?: (record: WeightRecord) => void;
}) {
  return (
    <article className="panel records-card records-history-card">
      <header className="panel-header">
        <div><h2>Registros de peso</h2><p>Pesos promedio registrados en la campaña.</p></div>
      </header>
      {campaign.pesos.length ? (
        <div aria-label="Lista de registros de peso" className="weight-list">
          {campaign.pesos.map((record) => (
            <div className={`weight-list-item ${canEdit && onEdit && onDelete ? "weight-list-item-editable" : ""}`} key={record.id}>
              <div className="weight-date">
                <strong>{formatShortDate(record.fechaRegistro)}</strong>
                <span className="day-pill">Día {daysSince(campaign.fechaInicio, record.fechaRegistro)}</span>
              </div>
              <div className="weight-value"><strong>{formatKg(record.pesoHembrasKg)}</strong><span>Hembras</span></div>
              <div className="weight-value"><strong>{formatKg(record.pesoMachosKg)}</strong><span>Machos</span></div>
              {canEdit && onEdit && onDelete ? (
                <div className="weight-actions">
                  <button className="table-link" onClick={() => onEdit(record)} type="button">Editar</button>
                  <button className="table-link danger-link" onClick={() => onDelete(record)} type="button">Eliminar</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : <p className="empty-inline">Sin registros.</p>}
    </article>
  );
}

function WeightForm({
  campaign,
  canEdit,
  maxDate,
  onGuide,
  onSubmit,
}: {
  campaign: Campaign;
  canEdit: boolean;
  maxDate: string;
  onGuide: () => void;
  onSubmit: (payload: { pesoHembrasKg: number; pesoMachosKg: number; fechaRegistro: string }) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = weightSchema.safeParse({
      pesoHembrasKg: form.get("pesoHembrasKg"),
      pesoMachosKg: form.get("pesoMachosKg"),
      fechaRegistro: form.get("fechaRegistro"),
    });
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(parsed.data);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel records-card">
      <header className="panel-header">
        <div><h2>Registrar peso</h2><p>Ingresa el peso promedio de una muestra.</p></div>
        <button className="text-button" onClick={onGuide} type="button">Guía de peso</button>
      </header>
      <form className="record-form" onSubmit={submit}>
        <div className="two-columns">
          <label>Peso hembras (kg)<input defaultValue="0" min="0" name="pesoHembrasKg" required step="0.01" type="number" /></label>
          <label>Peso machos (kg)<input defaultValue="0" min="0" name="pesoMachosKg" required step="0.01" type="number" /></label>
        </div>
        <label>Fecha<input defaultValue={maxDate} max={maxDate} min={campaign.fechaInicio} name="fechaRegistro" required type="date" /></label>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <button className="button button-primary" disabled={busy || !canEdit} type="submit">{busy ? "Guardando…" : "Guardar registro"}</button>
      </form>
    </article>
  );
}

function EditMortalityModal({
  campaign,
  record,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  record: MortalityRecord;
  onClose: () => void;
  onConfirm: (input: { hembrasMuertas: number; machosMuertos: number; fechaRegistro: string }) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = mortalitySchema.safeParse({
      hembrasMuertas: form.get("hembrasMuertas"),
      machosMuertos: form.get("machosMuertos"),
      fechaRegistro: form.get("fechaRegistro"),
    });
    if (!parsed.success) return setError(validationMessage(parsed.error));

    setBusy(true);
    setError(null);
    try {
      await onConfirm(parsed.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el registro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal description="Corrige las bajas registradas. La campaña debe permanecer activa." onClose={onClose} title="Editar mortalidad">
      <form className="modal-body stack-form" onSubmit={submit}>
        <div className="two-columns">
          <label>Hembras muertas<input defaultValue={record.hembrasMuertas} min="0" name="hembrasMuertas" required type="number" /></label>
          <label>Machos muertos<input defaultValue={record.machosMuertos} min="0" name="machosMuertos" required type="number" /></label>
        </div>
        <label>Fecha<input defaultValue={record.fechaRegistro} max={todayISO()} min={campaign.fechaInicio} name="fechaRegistro" required type="date" /></label>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <div className="form-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancelar</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar cambios"}</button></div>
      </form>
    </Modal>
  );
}

function EditWeightModal({
  campaign,
  record,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  record: WeightRecord;
  onClose: () => void;
  onConfirm: (input: { pesoHembrasKg: number; pesoMachosKg: number; fechaRegistro: string }) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = weightSchema.safeParse({
      pesoHembrasKg: form.get("pesoHembrasKg"),
      pesoMachosKg: form.get("pesoMachosKg"),
      fechaRegistro: form.get("fechaRegistro"),
    });
    if (!parsed.success) return setError(validationMessage(parsed.error));

    setBusy(true);
    setError(null);
    try {
      await onConfirm(parsed.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el registro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal description="Corrige los pesos promedio registrados. La campaña debe permanecer activa." onClose={onClose} title="Editar peso">
      <form className="modal-body stack-form" onSubmit={submit}>
        <div className="two-columns">
          <label>Peso hembras (kg)<input defaultValue={record.pesoHembrasKg} min="0" name="pesoHembrasKg" required step="0.01" type="number" /></label>
          <label>Peso machos (kg)<input defaultValue={record.pesoMachosKg} min="0" name="pesoMachosKg" required step="0.01" type="number" /></label>
        </div>
        <label>Fecha<input defaultValue={record.fechaRegistro} max={todayISO()} min={campaign.fechaInicio} name="fechaRegistro" required type="date" /></label>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <div className="form-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancelar</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar cambios"}</button></div>
      </form>
    </Modal>
  );
}

function DeleteRecordModal({
  record,
  onClose,
  onConfirm,
}: {
  record: RecordToDelete;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = record.kind === "mortalidad" ? "mortalidad" : "peso";

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar el registro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal description={`Eliminarás el registro de ${label} del ${formatDate(record.record.fechaRegistro)}. Esta acción no se puede deshacer.`} onClose={onClose} title={`Eliminar registro de ${label}`}>
      <div className="modal-body stack-form">
        <p className="delete-warning">Confirma únicamente si este registro se ingresó por error.</p>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <div className="form-actions"><button className="button button-secondary" disabled={busy} onClick={onClose} type="button">Cancelar</button><button className="button button-danger" disabled={busy} onClick={() => void remove()} type="button">{busy ? "Eliminando…" : "Eliminar registro"}</button></div>
      </div>
    </Modal>
  );
}

function SalesSection({
  campaign,
  canEdit,
  onDetail,
  onNewSale,
}: {
  campaign: Campaign;
  canEdit: boolean;
  onDetail: (sale: Sale) => void;
  onNewSale: () => void;
}) {
  return (
    <section className="panel sales-panel">
      <header className="panel-header">
        <div><h2>Ventas</h2><p>Cabeceras de las ventas registradas para esta campaña.</p></div>
        {campaign.estado !== "finalizada" ? <button className="button button-primary" disabled={!canEdit} onClick={onNewSale} type="button">+ Registrar venta</button> : null}
      </header>
      {campaign.ventas.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Fecha</th><th>Aves / javas</th><th>Precio bruto</th><th>Precio neto</th><th aria-label="Detalle" /></tr></thead>
            <tbody>
              {campaign.ventas.map((sale) => {
                const summary = saleSummary(sale);
                return (
                  <tr key={sale.id}>
                    <td><strong>{sale.cliente}</strong><span className="cell-detail">{formatSoles(sale.precioPorKilo)} / kg</span></td>
                    <td>{formatDate(sale.fechaVenta)}</td>
                    <td><strong>{summary.birds.toLocaleString("es-PE")} aves</strong><span className="cell-detail">{summary.crates.toLocaleString("es-PE")} javas</span></td>
                    <td>{formatSoles(summary.grossValue)}</td>
                    <td>{formatSoles(summary.netValue)}</td>
                    <td className="action-cell"><button className="table-link" onClick={() => onDetail(sale)} type="button">Ver detalle</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-inline">Aún no hay ventas registradas.</p>}
    </section>
  );
}

function ExpensesSection({
  campaign,
  canEdit,
  onNewExpense,
}: {
  campaign: Campaign;
  canEdit: boolean;
  onNewExpense: () => void;
}) {
  const totalEgresos = campaign.gastos.reduce((total, expense) => total + (expense.egreso ?? 0), 0);
  const totalIngresos = campaign.gastos.reduce((total, expense) => total + (expense.ingreso ?? 0), 0);
  const saldo = totalIngresos - totalEgresos;

  return (
    <section className="panel sales-panel">
      <header className="panel-header expense-panel-header">
        <div><h2>Gastos e ingresos</h2><p>Movimientos económicos registrados para esta campaña.</p></div>
        <div className="expense-summary" aria-label="Resumen económico de la campaña">
          <div><span>Egresos</span><strong className="expense-outflow">{formatSoles(totalEgresos)}</strong></div>
          <div><span>Ingresos</span><strong className="expense-inflow">{formatSoles(totalIngresos)}</strong></div>
          <div className={saldo >= 0 ? "expense-balance-positive" : "expense-balance-negative"}><span>Saldo</span><strong>{formatSoles(saldo)}</strong></div>
        </div>
        {campaign.estado !== "finalizada" ? <button className="button button-primary" disabled={!canEdit} onClick={onNewExpense} type="button">+ Registrar movimiento</button> : null}
      </header>
      {campaign.gastos.length ? (
        <div className="table-wrap">
          <table className="data-table expense-table">
            <thead><tr><th>Fecha</th><th>Tipo / descripción</th><th>Observación</th><th>Pago / banco</th><th>Egreso</th><th>Ingreso</th></tr></thead>
            <tbody>
              {campaign.gastos.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.fecha)}</td>
                  <td><strong>{expense.tipo}</strong><span className="cell-detail">{expense.descripcion}</span></td>
                  <td>{expense.observacion}</td>
                  <td><strong>{expense.formaPago}</strong><span className="cell-detail">{expense.bancos.join(" · ")}</span></td>
                  <td className="expense-outflow">{expense.egreso === null ? "—" : formatSoles(expense.egreso)}</td>
                  <td className="expense-inflow">{expense.ingreso === null ? "—" : formatSoles(expense.ingreso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-inline">Aún no hay gastos ni ingresos registrados.</p>}
    </section>
  );
}

function ExpenseFormModal({
  campaign,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  onClose: () => void;
  onConfirm: (input: {
    fecha: string;
    tipo: string;
    descripcion: string;
    observacion: string;
    formaPago: string;
    bancos: ("BCP" | "INTERBANK")[];
    egreso?: number;
    ingreso?: number;
  }) => Promise<void>;
}) {
  const [catalog, setCatalog] = useState({ tipos: [] as string[], descripciones: [] as string[], formasPago: [] as string[] });
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [egreso, setEgreso] = useState("");
  const [ingreso, setIngreso] = useState("");
  const [bancos, setBancos] = useState<("BCP" | "INTERBANK")[]>([]);

  useEffect(() => {
    void getExpenseCatalog()
      .then(setCatalog)
      .catch((caught) => setCatalogError(caught instanceof Error ? caught.message : "No se pudieron cargar las opciones."));
  }, []);

  function toggleBank(bank: "BCP" | "INTERBANK") {
    setBancos((current) => current.includes(bank) ? current.filter((item) => item !== bank) : [...current, bank]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = expenseSchema.safeParse({
      fecha: form.get("fecha"),
      tipo: form.get("tipo"),
      descripcion: form.get("descripcion"),
      observacion: form.get("observacion"),
      formaPago: form.get("formaPago"),
      bancos,
      egreso,
      ingreso,
    });
    if (!parsed.success) return setError(validationMessage(parsed.error));
    setBusy(true); setError(null);
    try { await onConfirm(parsed.data); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el movimiento."); } finally { setBusy(false); }
  }

  return (
    <Modal description="Registra un egreso o un ingreso. Las opciones nuevas quedarán disponibles para las próximas campañas." onClose={onClose} title="Registrar gasto o ingreso">
      <form className="modal-body stack-form" onSubmit={submit}>
        <label>Fecha<input defaultValue={todayISO()} max={todayISO()} min={campaign.fechaInicio} name="fecha" required type="date" /></label>
        <div className="two-columns">
          <label>Tipo<input list="expense-types" name="tipo" placeholder="Ej. COMIDA" required /></label>
          <label>Descripción<input list="expense-descriptions" name="descripcion" placeholder="Ej. POLLOS" required /></label>
        </div>
        <datalist id="expense-types">{catalog.tipos.map((item) => <option key={item} value={item} />)}</datalist>
        <datalist id="expense-descriptions">{catalog.descripciones.map((item) => <option key={item} value={item} />)}</datalist>
        <label>Observación<textarea name="observacion" placeholder="Detalle del movimiento" required rows={3} /></label>
        <label>Forma de pago<input list="expense-payment-methods" name="formaPago" placeholder="Ej. EFECTIVO" required /></label>
        <datalist id="expense-payment-methods">{catalog.formasPago.map((item) => <option key={item} value={item} />)}</datalist>
        <fieldset className="bank-options"><legend>Banco</legend><p>Selecciona uno o ambos bancos.</p>
          {(["BCP", "INTERBANK"] as const).map((bank) => <label className="check-option" key={bank}><input checked={bancos.includes(bank)} onChange={() => toggleBank(bank)} type="checkbox" />{bank}</label>)}
        </fieldset>
        <div className="two-columns">
          <label>Egreso (S/)<input disabled={Boolean(ingreso)} min="0.01" onChange={(event) => setEgreso(event.target.value)} step="0.01" type="number" value={egreso} /></label>
          <label>Ingreso (S/)<input disabled={Boolean(egreso)} min="0.01" onChange={(event) => setIngreso(event.target.value)} step="0.01" type="number" value={ingreso} /></label>
        </div>
        {catalogError ? <p className="form-message" role="alert">{catalogError}</p> : null}
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <div className="form-actions"><button className="button button-secondary" disabled={busy} onClick={onClose} type="button">Cancelar</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar movimiento"}</button></div>
      </form>
    </Modal>
  );
}

function WeightGuideModal({ currentDay, onClose }: { currentDay: number; onClose: () => void }) {
  return (
    <Modal description="Referencia visual para comparar el crecimiento de las aves." onClose={onClose} title="Guía de peso aproximado">
      <div className="modal-body">
        <div className="weight-guide">
          <div className="weight-guide-row weight-guide-heading"><span>Edad</span><span>Peso aproximado</span></div>
          {WEIGHT_GUIDE.map(([day, range]) => (
            <div className={`weight-guide-row ${day === currentDay ? "weight-guide-current" : ""}`} key={day}>
              <span>Día {day}</span><strong>{range}</strong>
            </div>
          ))}
        </div>
        <div className="form-actions"><button className="button button-secondary" onClick={onClose} type="button">Cerrar</button></div>
      </div>
    </Modal>
  );
}

function CloseCampaignModal({
  campaign,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = closeCampaignSchema.safeParse({ fechaFin: new FormData(event.currentTarget).get("fechaFin") });
    if (!parsed.success) return setError(validationMessage(parsed.error));
    setBusy(true); setError(null);
    try { await onConfirm(parsed.data.fechaFin); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo terminar."); } finally { setBusy(false); }
  }
  return (
    <Modal description="Al terminarla se bloquean los registros de peso y mortalidad; las ventas pueden registrarse desde el inicio." onClose={onClose} title="Terminar campaña">
      <form className="modal-body stack-form" onSubmit={submit}>
        <label>Fecha de término<input defaultValue={todayISO()} max={todayISO()} min={campaign.fechaInicio} name="fechaFin" required type="date" /></label>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <div className="form-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancelar</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Terminando…" : "Terminar campaña"}</button></div>
      </form>
    </Modal>
  );
}

type DraftDetail = SaleDetail & { key: string };

function emptyDraft(): DraftDetail {
  const id = crypto.randomUUID();
  return { id, key: id, sexo: "hembra", cantidadJavas: 1, pollosPorJava: 1, pesoJavaKg: 0, pesoJavaConAvesKg: 0 };
}

function SaleFormModal({
  campaign,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  onClose: () => void;
  onConfirm: (input: { cliente: string; fechaVenta: string; precioPorKilo: number; detalles: Omit<SaleDetail, "id">[] }) => Promise<void>;
}) {
  const stats = calculateCampaignStats(campaign);
  const [cliente, setCliente] = useState("");
  const [fechaVenta, setFechaVenta] = useState(todayISO());
  const [precioPorKilo, setPrecioPorKilo] = useState(0);
  const [groups, setGroups] = useState<DraftDetail[]>([]);
  const [draft, setDraft] = useState<DraftDetail>(emptyDraft);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const grossKg = groups.reduce((sum, group) => sum + saleGrossKg(group), 0);
    const netKg = groups.reduce((sum, group) => sum + saleNetKg(group), 0);
    return {
      birds: groups.reduce((sum, group) => sum + saleBirds(group), 0),
      crates: groups.reduce((sum, group) => sum + group.cantidadJavas, 0),
      grossKg,
      netKg,
      grossValue: grossKg * precioPorKilo,
      netValue: netKg * precioPorKilo,
    };
  }, [groups, precioPorKilo]);

  function updateDraft(field: keyof DraftDetail, value: string | number) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  function saveGroup() {
    const parsed = saleDetailSchema.safeParse({
      sexo: draft.sexo,
      cantidadJavas: draft.cantidadJavas,
      pollosPorJava: draft.pollosPorJava,
      pesoJavaKg: draft.pesoJavaKg,
      pesoJavaConAvesKg: draft.pesoJavaConAvesKg,
    });
    if (!parsed.success) {
      setGroupError(validationMessage(parsed.error));
      return;
    }
    const saved: DraftDetail = { ...parsed.data, id: draft.id, key: editingKey ?? draft.key };
    setGroups((previous) => editingKey ? previous.map((group) => group.key === editingKey ? saved : group) : [...previous, saved]);
    setDraft(emptyDraft());
    setEditingKey(null);
    setGroupError(null);
  }

  function editGroup(group: DraftDetail) {
    setDraft(group);
    setEditingKey(group.key);
    setGroupError(null);
  }

  function removeGroup(key: string) {
    setGroups((previous) => previous.filter((group) => group.key !== key));
    if (editingKey === key) {
      setDraft(emptyDraft());
      setEditingKey(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = saleSchema.safeParse({
      cliente,
      fechaVenta,
      precioPorKilo,
      detalles: groups.map(({ key: _key, id: _id, ...group }) => group),
    });
    if (!parsed.success) {
      setError(validationMessage(parsed.error));
      return;
    }
    setBusy(true); setError(null);
    try {
      await onConfirm(parsed.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar la venta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal description="Registra primero los grupos de javas; al confirmar se crea una sola venta para este cliente." onClose={onClose} size="wide" title="Registrar venta">
      <form className="modal-body sale-modal" onSubmit={submit}>
        <div className="sale-header-fields">
          <label>Cliente<input onChange={(event) => setCliente(event.target.value)} required value={cliente} /></label>
          <label>Fecha<input max={todayISO()} min={campaign.fechaFin ?? campaign.fechaInicio} onChange={(event) => setFechaVenta(event.target.value)} required type="date" value={fechaVenta} /></label>
          <label>Precio por kilo (S/)<input min="0.01" onChange={(event) => setPrecioPorKilo(Number(event.target.value))} required step="0.01" type="number" value={precioPorKilo || ""} /></label>
        </div>
        <div className="sale-stock">
          <span>Disponibles: <strong>H {(stats.hembrasVivas - stats.hembrasVendidas).toLocaleString("es-PE")}</strong> · <strong>M {(stats.machosVivos - stats.machosVendidos).toLocaleString("es-PE")}</strong></span>
          <span>En esta venta: <strong>{totals.birds.toLocaleString("es-PE")} aves</strong> · <strong>{totals.crates.toLocaleString("es-PE")} javas</strong></span>
        </div>

        <div className="sale-workbench">
          <section className="sale-groups">
            <div className="sale-section-heading"><h3>Grupos guardados</h3><p>Cada fila representa un grupo de javas de la misma condición.</p></div>
            {groups.length ? (
              <div className="table-wrap">
                <table className="data-table compact-table">
                  <thead><tr><th>Sexo</th><th>Javas</th><th>Aves</th><th>Tara</th><th>Bruto</th><th aria-label="Acciones" /></tr></thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.key}>
                        <td>{birdSexLabel(group.sexo)}</td>
                        <td>{group.cantidadJavas}</td>
                        <td>{saleBirds(group)} <span className="cell-detail">{group.pollosPorJava} / java</span></td>
                        <td>{formatKg(group.pesoJavaKg)}</td>
                        <td>{formatKg(saleGrossKg(group))}</td>
                        <td className="row-actions"><button className="table-link" onClick={() => editGroup(group)} type="button">Editar</button><button className="table-link danger-link" onClick={() => removeGroup(group.key)} type="button">Eliminar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="empty-inline">Agrega el primer grupo de javas a la derecha.</p>}
            <div className="sale-totals">
              <div><span>Peso bruto</span><strong>{formatKg(totals.grossKg)}</strong></div>
              <div><span>Peso neto</span><strong>{formatKg(totals.netKg)}</strong></div>
              <div><span>Precio bruto</span><strong>{formatSoles(totals.grossValue)}</strong></div>
              <div><span>Precio neto</span><strong>{formatSoles(totals.netValue)}</strong></div>
            </div>
          </section>

          <aside className="group-form-card">
            <div className="sale-section-heading"><h3>{editingKey ? "Editar grupo" : "Grupo de javas"}</h3><p>Los pesos son por cada java.</p></div>
            <label>Sexo<select onChange={(event) => updateDraft("sexo", event.target.value as BirdSex)} value={draft.sexo}><option value="hembra">Hembras</option><option value="macho">Machos</option></select></label>
            <div className="two-columns">
              <label>Javas<input min="1" onChange={(event) => updateDraft("cantidadJavas", Number(event.target.value))} type="number" value={draft.cantidadJavas} /></label>
              <label>Aves por java<input min="1" onChange={(event) => updateDraft("pollosPorJava", Number(event.target.value))} type="number" value={draft.pollosPorJava} /></label>
            </div>
            <label>Tara de una java (kg)<input min="0" onChange={(event) => updateDraft("pesoJavaKg", Number(event.target.value))} step="0.01" type="number" value={draft.pesoJavaKg} /></label>
            <label>Peso java + aves (kg)<input min="0.01" onChange={(event) => updateDraft("pesoJavaConAvesKg", Number(event.target.value))} step="0.01" type="number" value={draft.pesoJavaConAvesKg || ""} /></label>
            {groupError ? <p className="form-message" role="alert">{groupError}</p> : null}
            <div className="group-form-actions">
              {editingKey ? <button className="button button-secondary" onClick={() => { setDraft(emptyDraft()); setEditingKey(null); setGroupError(null); }} type="button">Cancelar edición</button> : null}
              <button className="button button-primary" onClick={saveGroup} type="button">{editingKey ? "Actualizar grupo" : "Agregar grupo"}</button>
            </div>
          </aside>
        </div>

        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <div className="form-actions">
          <button className="button button-secondary" onClick={onClose} type="button">Cancelar</button>
          <button className="button button-primary" disabled={busy || !groups.length} type="submit">{busy ? "Guardando…" : "Guardar venta"}</button>
        </div>
      </form>
    </Modal>
  );
}

function FinishSaleModal({
  campaign,
  stats,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  stats: CampaignStats;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lossH = Math.max(0, stats.hembrasVivas - stats.hembrasVendidas);
  const lossM = Math.max(0, stats.machosVivos - stats.machosVendidos);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = finishSaleSchema.safeParse({ fechaFin: new FormData(event.currentTarget).get("fechaFin") });
    if (!parsed.success) return setError(validationMessage(parsed.error));
    setBusy(true); setError(null);
    try { await onConfirm(parsed.data.fechaFin); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo terminar."); } finally { setBusy(false); }
  }
  return (
    <Modal description="Esta acción finaliza la campaña y guarda las aves que no se vendieron como pérdida." onClose={onClose} title="Terminar venta">
      <form className="modal-body stack-form" onSubmit={submit}>
        <section className="loss-preview"><strong>{(lossH + lossM).toLocaleString("es-PE")} aves no vendidas</strong><span>H {lossH.toLocaleString("es-PE")} · M {lossM.toLocaleString("es-PE")}</span></section>
        <label>Fecha de término<input defaultValue={todayISO()} max={todayISO()} min={campaign.fechaFin ?? campaign.fechaInicio} name="fechaFin" required type="date" /></label>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        <div className="form-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancelar</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Terminando…" : "Terminar venta"}</button></div>
      </form>
    </Modal>
  );
}

function SaleDetailModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const summary = saleSummary(sale);
  return (
    <Modal description={`${sale.cliente} · ${formatDate(sale.fechaVenta)} · ${formatSoles(sale.precioPorKilo)} por kg`} onClose={onClose} size="wide" title="Detalle de venta">
      <div className="modal-body">
        <div className="table-wrap">
          <table className="data-table compact-table">
            <thead><tr><th>Sexo</th><th>Javas</th><th>Aves</th><th>Tara</th><th>Kg bruto</th><th>Kg neto</th><th>Valor bruto</th><th>Valor neto</th></tr></thead>
            <tbody>
              {sale.detalles.map((detail) => (
                <tr key={detail.id}>
                  <td>{birdSexLabel(detail.sexo)}</td>
                  <td>{detail.cantidadJavas}</td>
                  <td>{saleBirds(detail)} <span className="cell-detail">{detail.pollosPorJava} / java</span></td>
                  <td>{formatKg(detail.pesoJavaKg)}</td>
                  <td>{formatKg(saleGrossKg(detail))}</td>
                  <td>{formatKg(saleNetKg(detail))}</td>
                  <td>{formatSoles(saleGrossKg(detail) * sale.precioPorKilo)}</td>
                  <td>{formatSoles(saleNetKg(detail) * sale.precioPorKilo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="receipt-totals">
          <span>{summary.birds.toLocaleString("es-PE")} aves · {summary.crates.toLocaleString("es-PE")} javas</span>
          <strong>Bruto {formatSoles(summary.grossValue)}</strong>
          <strong>Neto {formatSoles(summary.netValue)}</strong>
        </div>
        <div className="form-actions"><button className="button button-secondary" onClick={onClose} type="button">Cerrar</button></div>
      </div>
    </Modal>
  );
}

function saleSummary(sale: Sale) {
  const birds = sale.detalles.reduce((sum, detail) => sum + saleBirds(detail), 0);
  const crates = sale.detalles.reduce((sum, detail) => sum + detail.cantidadJavas, 0);
  const grossFromDetails = sale.detalles.reduce((sum, detail) => sum + saleGrossKg(detail) * sale.precioPorKilo, 0);
  const netFromDetails = sale.detalles.reduce((sum, detail) => sum + saleNetKg(detail) * sale.precioPorKilo, 0);
  return {
    birds,
    crates,
    grossValue: sale.totalBruto || grossFromDetails,
    netValue: sale.totalNeto || netFromDetails,
  };
}

function DetailLoading() {
  return (
    <main className="loading-page">
      <div className="loading-mark" aria-hidden="true" />
      <p>Cargando campaña…</p>
    </main>
  );
}
