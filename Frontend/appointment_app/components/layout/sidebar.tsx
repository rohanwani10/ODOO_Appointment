import Link from 'next/link';

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-border bg-sidebar text-sidebar-foreground p-6 space-y-4 min-h-[calc(100vh-65px)]">
      <nav className="flex flex-col space-y-1">
        <Link href="/dashboard" className="px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors text-sm font-medium">Overview</Link>
        <Link href="/dashboard/bookings" className="px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors text-sm font-medium">Bookings</Link>
        <Link href="/dashboard/availability" className="px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors text-sm font-medium">Availability</Link>
        <Link href="/dashboard/meeting-types" className="px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors text-sm font-medium">Meeting Types</Link>
      </nav>
    </aside>
  );
}

