import { auth } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import CreateOrgForm from "./ui/CreateOrgForm";
import OrgTable from "./ui/OrgTable";

export const metadata = { title: "Súper Admin • Organizaciones" };

async function fetchOrgs() {
  const res = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/superadmin/orgs`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudieron cargar organizaciones");
  return res.json() as Promise<Array<{ id: string; name: string; slug: string; created_at: string }>>;
}

export default async function OrgsPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") redirect("/superadmin/login");

  const orgs = await fetchOrgs();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organizaciones</h1>
          <p className="text-text-weak">Crea y administra subdominios/tenants.</p>
        </div>
        <CreateOrgForm />
      </header>

      <OrgTable data={orgs} />
    </div>
  );
}
