// src/lib/customers.ts
import { prisma } from "@/lib/prisma";

export async function findOrCreateCustomer(params: {
  orgId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
}) {
  const { orgId, fullName, email, phone } = params;

  const trimmedEmail = email?.trim();
  const trimmedPhone = phone?.trim();

  // Si hay email → intentamos reutilizar cliente por (org_id, email)
  if (trimmedEmail) {
    // 1) Buscar si ya existe
    const existing = await prisma.customer.findFirst({
      where: {
        org_id: orgId,
        email: trimmedEmail,
      },
    });

    if (existing) {
      // 2) Actualizar datos básicos y devolver
      return prisma.customer.update({
        where: { id: existing.id },
        data: {
          full_name: fullName,
          phone: trimmedPhone ?? null,
        },
      });
    }

    // 3) No existe → crear
    return prisma.customer.create({
      data: {
        org_id: orgId,
        full_name: fullName,
        email: trimmedEmail,
        phone: trimmedPhone ?? null,
      },
    });
  }

  // Sin email → siempre creamos uno nuevo
  return prisma.customer.create({
    data: {
      org_id: orgId,
      full_name: fullName,
      // email: null,
      phone: trimmedPhone ?? null,
    },
  });
}
