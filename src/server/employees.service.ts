import { prisma } from "@/lib/prisma";
import { user_role } from "@prisma/client";

export async function listEmployees(opts: {
  orgId: string; q?: string; siteId?: string; page?: number; per?: number;
  sort?: "created_at" | "email" | "full_name"; dir?: "asc" | "desc";
}) {
  const { orgId, q = "", siteId, page = 1, per = 10, sort = "created_at", dir = "desc" } = opts;

  const whereBase: any = {
    org_id: orgId,
    is_deleted: false,
    ...(q ? { OR: [
      { email: { contains: q, mode: "insensitive" } },
      { full_name: { contains: q, mode: "insensitive" } },
    ] } : {})
  };

  const where = siteId
    ? { AND: [whereBase, { employee_site: { some: { site_id: siteId, is_deleted: false } } }] }
    : whereBase;

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        employee_site: {
          where: { is_deleted: false },
          include: { site: { select: { id: true, name: true } } },
        },
      },
      orderBy: { [sort]: dir },
      skip: (page - 1) * per,
      take: per,
    }),
  ]);

  const data = rows.map(e => ({
    id: e.id,
    email: e.email,
    full_name: e.full_name,
    role: e.role,
    created_at: e.created_at as unknown as string,
    is_deleted: e.is_deleted ?? false,
    sites: e.employee_site.map(es => es.site),
  }));

  return { total, data };
}

export async function createEmployee(opts: {
  orgId: string; email: string; full_name?: string | null; role: user_role; site_ids?: string[];
}) {
  const { orgId, email, full_name, role, site_ids } = opts;

  const emp = await prisma.employee.create({
    data: { org_id: orgId, email, full_name: full_name ?? null, role },
    select: { id: true },
  });

  if (site_ids?.length) {
    for (const sId of site_ids) {
      const ex = await prisma.employee_site.findFirst({
        where: { employee_id: emp.id, site_id: sId },
        select: { id: true, is_deleted: true },
      });
      if (!ex) {
        await prisma.employee_site.create({ data: { employee_id: emp.id, site_id: sId } });
      } else if (ex.is_deleted) {
        await prisma.employee_site.update({
          where: { id: ex.id },
          data: { is_deleted: false, deleted_at: null },
        });
      }
    }
  }

  return emp.id;
}

export async function updateEmployee(opts: {
  orgId: string; employeeId: string; full_name?: string | null; role?: "OWNER" | "SITE_ADMIN" | "STAFF";
}) {
  const { orgId, employeeId, full_name, role } = opts;
  const exists = await prisma.employee.findFirst({ where: { id: employeeId, org_id: orgId }, select: { id: true } });
  if (!exists) throw new Error("NotFound");

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(full_name !== undefined ? { full_name } : {}),
      ...(role ? { role: role as user_role } : {}),
    },
  });
}

export async function softDeleteEmployee(opts: { orgId: string; employeeId: string }) {
  const { orgId, employeeId } = opts;
  const exists = await prisma.employee.findFirst({ where: { id: employeeId, org_id: orgId, is_deleted: false }, select: { id: true } });
  if (!exists) throw new Error("NotFound");

  await prisma.employee.update({ where: { id: employeeId }, data: { is_deleted: true, deleted_at: new Date() } });
}

export async function restoreEmployee(opts: { orgId: string; employeeId: string }) {
  const { orgId, employeeId } = opts;
  const exists = await prisma.employee.findFirst({ where: { id: employeeId, org_id: orgId, is_deleted: true }, select: { id: true } });
  if (!exists) throw new Error("NotFound");

  await prisma.employee.update({ where: { id: employeeId }, data: { is_deleted: false, deleted_at: null } });
}

export async function assignEmployeeToSite(opts: { orgId: string; siteId: string; employeeId: string }) {
  const { orgId, siteId, employeeId } = opts;

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, org_id: orgId, is_deleted: false }, select: { id: true },
  });
  if (!emp) throw new Error("NotFound");

  const ex = await prisma.employee_site.findFirst({
    where: { employee_id: employeeId, site_id: siteId }, select: { id: true, is_deleted: true },
  });

  const id = ex
    ? (ex.is_deleted
        ? (await prisma.employee_site.update({
            where: { id: ex.id }, data: { is_deleted: false, deleted_at: null }, select: { id: true },
          })).id
        : ex.id)
    : (await prisma.employee_site.create({
        data: { employee_id: employeeId, site_id: siteId }, select: { id: true },
      })).id;

  return id;
}

export async function revokeEmployeeFromSite(opts: { orgId: string; siteId: string; employeeId: string }) {
  const { orgId, siteId, employeeId } = opts;

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, org_id: orgId, is_deleted: false }, select: { id: true },
  });
  if (!emp) throw new Error("NotFound");

  const es = await prisma.employee_site.findFirst({
    where: { employee_id: employeeId, site_id: siteId, is_deleted: false }, select: { id: true },
  });
  if (!es) throw new Error("NotFound");

  await prisma.employee_site.update({
    where: { id: es.id }, data: { is_deleted: true, deleted_at: new Date() },
  });
}
