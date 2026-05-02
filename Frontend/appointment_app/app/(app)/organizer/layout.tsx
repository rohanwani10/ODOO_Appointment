import { AuthGuard } from "@/components/auth/auth-guard";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard allowedRoles={["ORGANIZER", "ADMIN"]}>{children}</AuthGuard>;
}

