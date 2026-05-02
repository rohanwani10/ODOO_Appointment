import RegisterForm from "@/components/auth/register-form";

export default function OrganizerRegisterPage() {
  return (
    <RegisterForm
      role="ORGANIZER"
      accentColor="violet"
      heading="Create an organizer account"
      subtitle="Manage services, resources, and accept bookings from customers."
    />
  );
}
