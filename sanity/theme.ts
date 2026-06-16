import { buildLegacyTheme } from "sanity";

/**
 * Tema de marca DC Inc para el Studio.
 *
 * Sanity 5 expone `buildLegacyTheme` (re-exportado desde "sanity") como la vía
 * soportada para pintar el shell del Studio con colores propios. Toma un set
 * fijo de "tokens" tipo CSS-var (--brand-primary, --main-navigation-color, etc.)
 * y deriva de ahí toda la paleta interna.
 *
 * IMPORTANTE / límites (ver reporte): esto NO es un rediseño libre. Solo se
 * pueden cambiar colores base, no la tipografía, el layout ni los componentes.
 * El "shell" (navbar, paneles, botones) sigue siendo el de Sanity, ahora teñido
 * con la marca en vez del gris default.
 */

// Paleta DC
const props = {
  // Anclas neutras: charcoal como "negro" de marca, blanco hueso de fondo.
  "--black": "#1F1F21", // texto fuerte / sombras
  "--white": "#FFFFFF",

  // Gris base del que Sanity deriva bordes, fondos de panel y texto secundario.
  // Un gris cálido/charcoal en vez del gris azulado default.
  "--gray": "#6E6E6B",
  "--gray-base": "#6E6E6B",

  // Color de marca: amber DC. Tiñe links, estados activos y acentos.
  "--brand-primary": "#E8B53D",

  // Barra de navegación superior: charcoal con texto claro → look "propio".
  "--main-navigation-color": "#2A2A2C",
  "--main-navigation-color--inverted": "#FFFFFF",

  // Color de foco (anillos al tabular / inputs activos): amber de marca.
  "--focus-color": "#E8B53D",

  // Componentes (inputs, cards) sobre fondo claro.
  "--component-bg": "#FFFFFF",
  "--component-text-color": "#2A2A2C",

  // Botón por defecto = acción primaria de marca (Publicar, etc.).
  "--default-button-color": "#2A2A2C",
  "--default-button-primary-color": "#E8B53D",
  "--default-button-success-color": "#16A34A",
  "--default-button-warning-color": "#D97706",
  "--default-button-danger-color": "#DC2626",

  // Estados (badges de validación, toasts).
  "--state-info-color": "#2563EB",
  "--state-success-color": "#16A34A",
  "--state-warning-color": "#D97706",
  "--state-danger-color": "#DC2626",
};

export const dcTheme = buildLegacyTheme(props);
