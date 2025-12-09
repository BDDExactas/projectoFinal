import { z } from "zod"

export const allowedTransactionTypes = ["buy", "sell", "deposit", "withdrawal", "dividend", "interest"] as const

const normalizeDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "string") return value.trim()
  return ""
}

const toNumber = (val: unknown) => {
  if (val === "" || val === null || val === undefined) return undefined
  const num = Number(val)
  return Number.isFinite(num) ? num : val
}

export const transactionInputSchema = z.object({
  userEmail: z.string().email(),
  accountName: z.string().trim().min(1, "accountName es requerido"),
  instrumentCode: z.string().trim().min(1, "instrumentCode es requerido"),
  type: z
    .string()
    .trim()
    .transform((val) => val.toLowerCase())
    .refine((val) => allowedTransactionTypes.includes(val as (typeof allowedTransactionTypes)[number]), {
      message: `type debe ser uno de: ${allowedTransactionTypes.join(", ")}`,
    }),
  quantity: z
    .preprocess(toNumber, z.number({ invalid_type_error: "quantity debe ser numérico" }).positive("quantity debe ser > 0"))
    .transform((val) => Number(val)),
  price: z
    .preprocess(toNumber, z.number({ invalid_type_error: "price debe ser numérico" }).positive("price debe ser > 0").optional())
    .optional(),
  total: z
    .preprocess(toNumber, z.number({ invalid_type_error: "total debe ser numérico" }).positive("total debe ser > 0").optional())
    .optional(),
  date: z
    .preprocess(normalizeDate, z.string())
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date debe estar en formato YYYY-MM-DD"))
    .default(() => new Date().toISOString().slice(0, 10)),
  currency: z.string().trim().min(1, "currency es requerido").default("ARS"),
  description: z.preprocess((val) => (val === undefined ? undefined : String(val)), z.string().optional()),
})

export const transactionUpdateSchema = transactionInputSchema.extend({
  createdAt: z.string().min(1, "createdAt es requerido para editar"),
})

export type TransactionInput = z.infer<typeof transactionInputSchema>
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>
