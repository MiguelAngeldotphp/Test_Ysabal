import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresa una fecha válida.");
const nonNegativeInteger = z.coerce.number().int().min(0, "No puede ser negativo.");
const positiveInteger = z.coerce.number().int().positive("Debe ser mayor que cero.");
const nonNegativeDecimal = z.coerce.number().min(0, "No puede ser negativo.");
const positiveDecimal = z.coerce.number().positive("Debe ser mayor que cero.");

export const galponSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del galpón.").max(100),
  direccion: z.string().trim().min(3, "Escribe una dirección.").max(200),
});

export const campaignSchema = z.object({
  galponId: z.string().uuid("Selecciona un galpón válido."),
  hembrasIniciales: positiveInteger,
  machosIniciales: positiveInteger,
  fechaInicio: isoDate,
});

export const mortalitySchema = z.object({
  hembrasMuertas: nonNegativeInteger,
  machosMuertos: nonNegativeInteger,
  fechaRegistro: isoDate,
}).refine((value) => value.hembrasMuertas + value.machosMuertos > 0, {
  message: "Registra al menos un ave muerta.",
});

export const weightSchema = z.object({
  pesoHembrasKg: nonNegativeDecimal,
  pesoMachosKg: nonNegativeDecimal,
  fechaRegistro: isoDate,
}).refine((value) => value.pesoHembrasKg + value.pesoMachosKg > 0, {
  message: "Registra al menos un peso mayor a cero.",
});

export const closeCampaignSchema = z.object({
  fechaFin: isoDate,
});

export const saleDetailSchema = z.object({
  sexo: z.enum(["hembra", "macho"]),
  cantidadJavas: positiveInteger,
  pollosPorJava: positiveInteger,
  pesoJavaKg: nonNegativeDecimal,
  pesoJavaConAvesKg: positiveDecimal,
}).refine((value) => value.pesoJavaConAvesKg >= value.pesoJavaKg, {
  message: "El peso con aves no puede ser menor a la tara de la java.",
});

export const saleSchema = z.object({
  cliente: z.string().trim().min(2, "Escribe el nombre del cliente.").max(150),
  fechaVenta: isoDate,
  precioPorKilo: positiveDecimal,
  detalles: z.array(saleDetailSchema).min(1, "Agrega por lo menos un grupo de javas."),
});

export const finishSaleSchema = z.object({
  fechaFin: isoDate,
});

const optionalMoney = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  positiveDecimal.optional(),
);

export const expenseSchema = z.object({
  fecha: isoDate,
  tipo: z.string().trim().min(2, "Ingresa o selecciona el tipo.").max(100),
  descripcion: z.string().trim().min(2, "Ingresa o selecciona la descripción.").max(150),
  observacion: z.string().trim().min(2, "Escribe una observación.").max(500),
  formaPago: z.string().trim().min(2, "Ingresa o selecciona la forma de pago.").max(100),
  bancos: z.array(z.enum(["BCP", "INTERBANK"])).min(1, "Selecciona al menos un banco."),
  egreso: optionalMoney,
  ingreso: optionalMoney,
}).superRefine((value, context) => {
  if ((value.egreso === undefined && value.ingreso === undefined) || (value.egreso !== undefined && value.ingreso !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Registra un monto en egreso o en ingreso, pero no en ambos." });
  }
});

export type GalponInput = z.infer<typeof galponSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type MortalityInput = z.infer<typeof mortalitySchema>;
export type WeightInput = z.infer<typeof weightSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;

export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos ingresados.";
}
