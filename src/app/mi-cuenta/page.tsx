import MiCuentaTabs from "@/components/site/MiCuentaTabs";

export const metadata = { title: "Mi cuenta" };

export default function MiCuentaPage() {
  // El middleware ya protege esta ruta. Los datos se leen client-side con Clerk.
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <MiCuentaTabs />
    </div>
  );
}
