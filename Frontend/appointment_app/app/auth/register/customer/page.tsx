import RegisterForm from "@/components/auth/register-form";

export default function CustomerRegisterPage() {
  return (
    <RegisterForm
      role="CUSTOMER"
      accentColor="sky"
      heading="Create a customer account"
      subtitle="Book appointments with service providers near you."
    />
  );
}
