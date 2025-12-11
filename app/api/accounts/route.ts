import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

const accountInputSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").transform(s => s.trim()),
  account_type: z.string().min(1, "El tipo de cuenta es requerido").transform(s => s.trim()),
  bank_name: z.string().optional().transform(s => s && s.trim() ? s.trim() : undefined),
  parent_account_name: z.string().optional().transform(s => s && s.trim() ? s.trim() : undefined),
});

const accountUpdateSchema = z.object({
  name: z.string().min(1),
  account_type: z.string().optional(),
  bank_name: z.string().optional(),
  parent_account_name: z.string().optional(),
});

const accountDeleteSchema = z.object({
  name: z.string().min(1, "Nombre de cuenta requerido"),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log("GET /api/accounts - User email:", user.email);
    const result = await sql`
      SELECT 
        user_email,
        name,
        account_type,
        bank_name,
        parent_account_name,
        created_at,
        updated_at
      FROM accounts
      WHERE user_email = ${user.email}
      ORDER BY name ASC
    `;

    console.log("GET /api/accounts - Cuentas encontradas:", result.length, result);
    return NextResponse.json({ accounts: result });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Error al obtener cuentas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    console.log("POST /api/accounts - Body recibido:", body);
    const validatedData = accountInputSchema.parse(body);
    console.log("POST /api/accounts - Datos validados:", validatedData);
    console.log("POST /api/accounts - User email:", user.email);

    const result = await sql`
      INSERT INTO accounts (user_email, name, account_type, bank_name, parent_account_name)
      VALUES (
        ${user.email},
        ${validatedData.name},
        ${validatedData.account_type},
        ${validatedData.bank_name ?? null},
        ${validatedData.parent_account_name ?? null}
      )
      ON CONFLICT (user_email, name) 
      DO UPDATE SET
        account_type = EXCLUDED.account_type,
        bank_name = EXCLUDED.bank_name,
        parent_account_name = EXCLUDED.parent_account_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    console.log("POST /api/accounts - Resultado INSERT:", result);
    return NextResponse.json({ success: true, account: result[0] });
  } catch (error) {
    console.error("Error creating/updating account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al crear cuenta" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = accountUpdateSchema.parse(body);

    const updateFields: string[] = [];
    const values: any[] = [];
    
    if (validatedData.account_type !== undefined) {
      updateFields.push(`account_type = $${values.length + 1}`);
      values.push(validatedData.account_type);
    }
    if (validatedData.bank_name !== undefined) {
      updateFields.push(`bank_name = $${values.length + 1}`);
      values.push(validatedData.bank_name || null);
    }
    if (validatedData.parent_account_name !== undefined) {
      updateFields.push(`parent_account_name = $${values.length + 1}`);
      values.push(validatedData.parent_account_name || null);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(user.email, validatedData.name);

    await sql.query(
      `UPDATE accounts 
       SET ${updateFields.join(', ')}
       WHERE user_email = $${values.length - 1} AND name = $${values.length}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar cuenta" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = accountDeleteSchema.safeParse({ name: searchParams.get("name") });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().formErrors.join("; ") },
        { status: 400 }
      );
    }
    const { name } = parsed.data;

    // Borrado en cascada manual: primero cuentas hijas, luego la cuenta padre
    await sql`
      DELETE FROM accounts
      WHERE user_email = ${user.email} AND parent_account_name = ${name}
    `;

    await sql`
      DELETE FROM accounts
      WHERE user_email = ${user.email} AND name = ${name}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al eliminar cuenta" },
      { status: 500 }
    );
  }
}
