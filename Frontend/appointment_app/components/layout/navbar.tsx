import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="border-b border-border bg-background text-foreground px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold hover:text-primary transition-colors">ZenSchedule</Link>
      <div className="space-x-6 flex items-center">
        <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
        <Link href="/auth/login" className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity">Login</Link>
      </div>
    </nav>
  );
}

