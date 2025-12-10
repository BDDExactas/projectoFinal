// Shared date helpers to keep ISO date formatting consistent across the app.
export const normalizeDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "string") return value.trim()
  return ""
}

export const todayIsoDate = () => new Date().toISOString().slice(0, 10)

export const toIsoDateString = (value: string | Date) =>
  typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10)
