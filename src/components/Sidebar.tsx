"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, MapPin, Users, BadgeDollarSign } from "lucide-react";

const items = [
  { href: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/superadmin/orgs", label: "Organizaciones", icon: Building2 },
  { href: "/superadmin/sites", label: "Sedes", icon: MapPin },
  { href: "/superadmin/users", label: "Usuarios", icon: Users },
  { href: "/superadmin/billing", label: "Facturación", icon: BadgeDollarSign },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-4">
        <Link href="/superadmin" className="block">
          <div className="text-xl font-extrabold tracking-tight">
            ACCROM <span className="text-primary">Admin</span>
          </div>
          <div className="text-sm text-[color:hsl(var(--color-text-weak))]">Super Administrador</div>
        </Link>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={[
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-[color:hsl(var(--color-text))] hover:bg-muted"
              ].join(" ")}
            >
              <Icon className={active ? "opacity-100" : "opacity-70"} size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 text-xs text-[color:hsl(var(--color-text-weak))]">
        v0.1 • Design tokens
      </div>
    </div>
  );
}
