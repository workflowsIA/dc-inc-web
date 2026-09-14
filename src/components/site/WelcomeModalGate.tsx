import { getWelcomeModal } from "@/lib/sanity-data";
import WelcomeModal from "./WelcomeModal";

/**
 * Lee la configuración del cartel en el servidor (cacheada 5 minutos, igual que
 * la config de envíos) y lo monta. Si Marce lo apagó desde el Studio no
 * renderiza nada, así el HTML ni siquiera lo lleva.
 */
export default async function WelcomeModalGate() {
  const data = await getWelcomeModal();
  if (!data) return null;
  return <WelcomeModal data={data} />;
}
