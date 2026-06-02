import Link from "next/link";

import { appNavigation } from "@/lib/navigation";

export function AppSidebar() {
  return (
    <aside className="hidden w-64 border-r bg-card lg:block">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="font-semibold">
          CareerOS AI
        </Link>
      </div>
      <nav className="space-y-1 p-3">
        {appNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
