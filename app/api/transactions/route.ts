import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { transactionInputSchema, transactionUpdateSchema, type TransactionInput } from "@/lib/validation/transaction"
import { upsertInstrumentPrice } from "@/lib/price"

const positiveTypes = ["buy", "deposit", "dividend", "interest"]

const ensureAccount = async (userEmail: string, accountName: string) => {
  const existingAccount = await sql`
    SELECT name FROM accounts WHERE user_email = ${userEmail} AND name = ${accountName} LIMIT 1
  `
  if (existingAccount.length === 0) {
    await sql`
      INSERT INTO accounts (user_email, name, account_type)
      VALUES (${userEmail}, ${accountName}, 'bank_account')
      ON CONFLICT (user_email, name) DO NOTHING
    `
  }
}

const computeQuantityChange = (type: string, quantity: number) =>
  positiveTypes.includes(type.toLowerCase()) ? quantity : -quantity

const ensureInstrumentPrice = async (input: TransactionInput) => {
  if (input.price !== undefined && Number.isFinite(input.price) && input.price > 0) {
    await upsertInstrumentPrice({
      instrumentCode: input.instrumentCode,
      price: input.price,
      currencyCode: input.currency || "ARS",
      priceDate: input.date,
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userEmail = searchParams.get("userEmail")
    if (!userEmail) {
      return NextResponse.json({ error: "userEmail es requerido" }, { status: 400 })
    }

    const accountName = searchParams.get("accountName")
    const instrumentCode = searchParams.get("instrumentCode")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limitRaw = Number(searchParams.get("limit") ?? "100")
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100

    const transactions = await sql`
      SELECT 
        user_email,
        account_name,
        instrument_code,
        transaction_date,
        transaction_type,
        quantity,
        price,
        total_amount,
        currency_code,
        description,
        created_at
      FROM transactions
      WHERE user_email = ${userEmail}
        ${accountName ? sql`AND account_name = ${accountName}` : sql``}
        ${instrumentCode ? sql`AND instrument_code = ${instrumentCode}` : sql``}
        ${startDate ? sql`AND transaction_date >= ${startDate}` : sql``}
        ${endDate ? sql`AND transaction_date <= ${endDate}` : sql``}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error("[v0] Fetch transactions error:", error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = transactionInputSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().formErrors.join("; ") }, { status: 400 })
    }
    const data = validation.data

    await ensureAccount(data.userEmail, data.accountName)

    const instrumentRes = await sql`SELECT code FROM instruments WHERE code = ${data.instrumentCode} LIMIT 1`
    if (instrumentRes.length === 0) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
    }

    await ensureInstrumentPrice(data)

    const totalAmount = data.total ?? (data.price ? data.price * data.quantity : null)

    await sql`
      INSERT INTO transactions (
        user_email, 
        account_name, 
        instrument_code,
        transaction_date, 
        transaction_type, 
        quantity, 
        price, 
        total_amount,
        currency_code,
        description
      )
      VALUES (
        ${data.userEmail},
        ${data.accountName},
        ${data.instrumentCode},
        ${data.date},
        ${data.type},
        ${data.quantity},
        ${data.price ?? null},
        ${totalAmount},
        ${data.currency || "ARS"},
        ${data.description ?? null}
      )
    `

    const existing = await sql`
      SELECT quantity FROM account_instruments WHERE user_email = ${data.userEmail} AND account_name = ${data.accountName} AND instrument_code = ${data.instrumentCode}
    `

    const qtyChange = computeQuantityChange(data.type, data.quantity)

    if (existing.length === 0) {
      await sql`
        INSERT INTO account_instruments (user_email, account_name, instrument_code, quantity)
        VALUES (${data.userEmail}, ${data.accountName}, ${data.instrumentCode}, ${qtyChange})
      `
    } else {
      await sql`
        UPDATE account_instruments
        SET quantity = quantity + ${qtyChange},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_email = ${data.userEmail} AND account_name = ${data.accountName} AND instrument_code = ${data.instrumentCode}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Create transaction error:", error)
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[DEBUG] PUT body received:', JSON.stringify(body, null, 2))

    const validation = transactionUpdateSchema.safeParse(body)
    if (!validation.success) {
      console.log('[DEBUG] Validation failed:', validation.error)
      return NextResponse.json({ error: validation.error.flatten().formErrors.join("; ") }, { status: 400 })
    }
    const data = validation.data
    console.log('[DEBUG] Validated data:', JSON.stringify(data, null, 2))

    // Use original values to find the transaction, fallback to new values if not provided
    const searchAccountName = data.originalAccountName || data.accountName
    const searchInstrumentCode = data.originalInstrumentCode || data.instrumentCode
    console.log('[DEBUG] Searching with:', { searchAccountName, searchInstrumentCode, createdAt: data.createdAt })

    // Query all matching transactions (PostgreSQL microseconds vs frontend milliseconds)
    const allMatching = await sql`
      SELECT transaction_type, quantity, account_name, instrument_code, created_at
      FROM transactions
      WHERE user_email = ${data.userEmail}
        AND account_name = ${searchAccountName}
        AND instrument_code = ${searchInstrumentCode}
      ORDER BY created_at DESC
      LIMIT 10
    `
    console.log('[DEBUG] All matching results:', JSON.stringify(allMatching, null, 2))

    // Find exact match by comparing timestamps at millisecond precision
    const targetTime = new Date(data.createdAt).getTime()
    const existingTx = allMatching.filter((tx: any) => {
      const txTime = new Date(tx.created_at).getTime()
      return txTime === targetTime
    })
    console.log('[DEBUG] Filtered to exact match:', existingTx.length, existingTx)

    if (existingTx.length === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const current = existingTx[0]

    await ensureAccount(data.userEmail, data.accountName)

    const instrumentRes = await sql`SELECT code FROM instruments WHERE code = ${data.instrumentCode} LIMIT 1`
    if (instrumentRes.length === 0) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 })
    }

    await ensureInstrumentPrice(data)

    // Check if account or instrument changed
    const accountChanged = searchAccountName !== data.accountName
    const instrumentChanged = searchInstrumentCode !== data.instrumentCode

    // If account or instrument changed, we need to update two holdings
    if (accountChanged || instrumentChanged) {
      // Rollback old holding
      const rollbackChange = -computeQuantityChange(current.transaction_type, Number(current.quantity))
      await sql`
        UPDATE account_instruments
        SET quantity = quantity + ${rollbackChange},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_email = ${data.userEmail} AND account_name = ${searchAccountName} AND instrument_code = ${searchInstrumentCode}
      `

      // Add to new holding
      const newChange = computeQuantityChange(data.type, data.quantity)
      const newHolding = await sql`
        SELECT quantity FROM account_instruments
        WHERE user_email = ${data.userEmail} AND account_name = ${data.accountName} AND instrument_code = ${data.instrumentCode}
      `

      if (newHolding.length === 0) {
        await sql`
          INSERT INTO account_instruments (user_email, account_name, instrument_code, quantity)
          VALUES (${data.userEmail}, ${data.accountName}, ${data.instrumentCode}, ${newChange})
        `
      } else {
        await sql`
          UPDATE account_instruments
          SET quantity = quantity + ${newChange},
              updated_at = CURRENT_TIMESTAMP
          WHERE user_email = ${data.userEmail} AND account_name = ${data.accountName} AND instrument_code = ${data.instrumentCode}
        `
      }
    } else {
      // Same holding - just replace the quantity
      const rollbackChange = -computeQuantityChange(current.transaction_type, Number(current.quantity))
      const newChange = computeQuantityChange(data.type, data.quantity)
      const netChange = rollbackChange + newChange

      await sql`
        UPDATE account_instruments
        SET quantity = quantity + ${netChange},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_email = ${data.userEmail} AND account_name = ${data.accountName} AND instrument_code = ${data.instrumentCode}
      `
    }

    const targetCreatedAt = new Date(current.created_at)
    const lowerBound = new Date(targetCreatedAt.getTime() - 1)
    const upperBound = new Date(targetCreatedAt.getTime() + 1)

    const updated = await sql`
      UPDATE transactions
      SET transaction_type = ${data.type},
          quantity = ${data.quantity},
          price = ${data.price ?? null},
          total_amount = ${data.total ?? (data.price ? data.price * data.quantity : null)},
          currency_code = ${data.currency || "ARS"},
          description = ${data.description ?? null},
          transaction_date = ${data.date},
          account_name = ${data.accountName},
          instrument_code = ${data.instrumentCode}
      WHERE user_email = ${data.userEmail}
        AND account_name = ${searchAccountName}
        AND instrument_code = ${searchInstrumentCode}
        AND created_at >= ${lowerBound}
        AND created_at <= ${upperBound}
      RETURNING created_at
    `

    if (updated.length === 0) {
      return NextResponse.json({ error: "Transaction not found for update" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Update transaction error:", error)
    console.error("[v0] Error details:", error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update transaction" }, { status: 500 })
  }
}

// DELETE - Remove a transaction (preferred) or a holding (legacy path)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, accountName, instrumentCode, createdAt } = body

    if (!userEmail || !accountName || !instrumentCode) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // If createdAt is provided, delete the specific transaction and rollback holding quantity
    if (createdAt) {
      // Query all matching transactions (PostgreSQL microseconds vs frontend milliseconds)
      const allMatching = await sql`
        SELECT transaction_type, quantity, created_at FROM transactions
        WHERE user_email = ${userEmail}
          AND account_name = ${accountName}
          AND instrument_code = ${instrumentCode}
        ORDER BY created_at DESC
        LIMIT 10
      `

      // Find exact match by comparing timestamps at millisecond precision
      const targetTime = new Date(createdAt).getTime()
      const txRes = allMatching.filter((tx: any) => {
        const txTime = new Date(tx.created_at).getTime()
        return txTime === targetTime
      })

      if (txRes.length === 0) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
      }

      const transaction = txRes[0]
      const rollbackChange = -computeQuantityChange(transaction.transaction_type, Number(transaction.quantity))
      const txDate = new Date(transaction.created_at)
      const lowerBound = new Date(txDate.getTime() - 1)
      const upperBound = new Date(txDate.getTime() + 1)

      const deleted = await sql`
        DELETE FROM transactions
        WHERE user_email = ${userEmail}
          AND account_name = ${accountName}
          AND instrument_code = ${instrumentCode}
          AND created_at >= ${lowerBound}
          AND created_at <= ${upperBound}
        RETURNING created_at
      `

      if (deleted.length === 0) {
        return NextResponse.json({ error: "Transaction not found for delete" }, { status: 404 })
      }

      const holdingUpdate = await sql`
        UPDATE account_instruments
        SET quantity = quantity + ${rollbackChange}, updated_at = CURRENT_TIMESTAMP
        WHERE user_email = ${userEmail} AND account_name = ${accountName} AND instrument_code = ${instrumentCode}
        RETURNING quantity
      `

      if (holdingUpdate.length === 0) {
        await sql`
          INSERT INTO account_instruments (user_email, account_name, instrument_code, quantity)
          VALUES (${userEmail}, ${accountName}, ${instrumentCode}, ${rollbackChange})
        `
      }

      return NextResponse.json({ success: true })
    }

    // Legacy: remove entire holding
    const result = await sql`
      DELETE FROM account_instruments
      WHERE user_email = ${userEmail} AND account_name = ${accountName} AND instrument_code = ${instrumentCode}
      RETURNING instrument_code
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete transaction/holding error:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
