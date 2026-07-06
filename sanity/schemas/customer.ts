import { defineField, defineType } from "sanity";
import { UsersIcon } from "@sanity/icons";

/**
 * Cliente (cuenta de la tienda) — ESPEJO de la cuenta de Clerk.
 *
 * El login real vive en Clerk; este documento es un reflejo para que se pueda
 * ver y gestionar todo desde el Studio sin abrir Clerk. Se sincroniza vía
 * webhook (/api/clerk/webhook) y backfill (scripts/backfill-customers.ts).
 *
 * El _id es determinístico: `customer-<clerkUserId>` → upsert sin duplicados.
 *
 * El ÚNICO campo editable es `estado`: al cambiarlo en el Studio, un webhook de
 * Sanity (/api/sanity/customer-webhook) actualiza el role en Clerk → el cliente
 * pasa (o no) a ver precios mayoristas en la web. El resto es de solo lectura.
 */
export default defineType({
  name: "customer",
  title: "Cliente",
  type: "document",
  icon: UsersIcon,
  // Bloqueamos crear/borrar a mano: estos docs los maneja la sincronización.
  // (El estado sí se edita.)
  fields: [
    defineField({
      name: "estado",
      title: "Estado",
      type: "string",
      description:
        "Cambialo para aprobar/rechazar. 'Mayorista' habilita precios mayoristas en la web (actualiza Clerk solo).",
      options: {
        list: [
          { title: "En revisión", value: "en_revision" },
          { title: "Mayorista (aprobado)", value: "mayorista" },
          { title: "Rechazado", value: "rechazado" },
          { title: "Visitante", value: "visitante" },
          { title: "Admin", value: "admin" },
        ],
        layout: "radio",
      },
    }),
    defineField({ name: "nombre", title: "Nombre", type: "string", readOnly: true }),
    defineField({ name: "empresa", title: "Empresa", type: "string", readOnly: true }),
    defineField({ name: "email", title: "Email", type: "string", readOnly: true }),
    defineField({ name: "cuit", title: "CUIT", type: "string", readOnly: true }),
    defineField({ name: "telefono", title: "Teléfono", type: "string", readOnly: true }),
    defineField({
      name: "clerkUserId",
      title: "ID de usuario (Clerk)",
      type: "string",
      readOnly: true,
    }),
    defineField({
      name: "registeredAt",
      title: "Registrado",
      type: "datetime",
      readOnly: true,
    }),
    defineField({
      name: "lastSyncedAt",
      title: "Última sincronización",
      type: "datetime",
      readOnly: true,
    }),
    defineField({
      name: "mondayItemId",
      title: "Item en Monday (CRM)",
      type: "string",
      readOnly: true,
      hidden: true,
      description: "ID del item creado en el board CRM al notificar el registro.",
    }),
  ],
  orderings: [
    { title: "Más nuevos", name: "registeredDesc", by: [{ field: "registeredAt", direction: "desc" }] },
    { title: "Empresa (A-Z)", name: "empresaAsc", by: [{ field: "empresa", direction: "asc" }] },
  ],
  preview: {
    select: { empresa: "empresa", nombre: "nombre", email: "email", estado: "estado" },
    prepare({ empresa, nombre, email, estado }) {
      const ESTADO: Record<string, string> = {
        en_revision: "En revisión",
        mayorista: "Mayorista",
        rechazado: "Rechazado",
        visitante: "Visitante",
        admin: "Admin",
      };
      return {
        title: empresa || nombre || email || "(Cliente)",
        subtitle: [email, ESTADO[estado as string] ?? estado].filter(Boolean).join(" · "),
      };
    },
  },
});
