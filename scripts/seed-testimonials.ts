/**
 * Siembra en Sanity los testimonios que Marce pasó el 17-ago-2026, para que
 * queden EDITABLES desde el Studio (Contenido del sitio → Testimonios de
 * clientes). Idempotente: usa _id fijos, así correrlo dos veces no duplica.
 *
 *   npm run seed:testimonials
 *
 * Requiere en .env.local: SANITY_API_WRITE_TOKEN.
 */
import { sanityWriteClient } from "../src/lib/sanity";

const testimonials = [
  {
    _id: "testimonial-donata-del-desierto",
    quote:
      "Trabajamos con DC Inc desde hace varios años y siempre recibimos una atención excelente. Destacamos el compromiso del equipo, la calidad de los productos y el cumplimiento en los tiempos de entrega. Es un proveedor confiable, que da respuestas rápidas y nos acompaña con soluciones cuando las necesitamos.",
    name: "Donata del Desierto",
    location: "Rivadavia, San Juan",
    order: 1,
  },
  {
    _id: "testimonial-federal",
    quote:
      "Un placer trabajar con ustedes: respuestas instantáneas de una persona física, algo que hoy es mucho pedir y mucho para apreciar. Entregas siempre a tiempo. ¡Un gusto!",
    name: "Federal",
    location: "CABA",
    order: 2,
  },
  {
    _id: "testimonial-eternal",
    quote:
      "Nuestra experiencia con DC siempre fue muy buena y cordial: cotizaciones rápidas, entregas y cumplimientos según lo acordado, excelente calidad y un chat que valoramos mucho. ¡Las respuestas son rápidas!",
    name: "Eternal",
    location: "Potrero de los Funes, San Luis",
    order: 3,
  },
  {
    _id: "testimonial-bichofeo",
    quote:
      "¡Todo 10 puntos! Ya vinieron varios a ofrecerme y nunca los cambié. Lo que más valoro es la atención personalizada, la agilidad, la respuesta y la calidad general de los productos.",
    name: "Bichofeo",
    location: "Resistencia, Chaco",
    order: 4,
  },
  {
    _id: "testimonial-heredero",
    quote:
      "Hace años trabajamos con DC y siempre tuvimos una muy buena experiencia. Valoramos especialmente la calidad de sus productos, el cumplimiento y la atención cercana con la que nos acompañan en cada proyecto. Es un proveedor en el que confiamos.",
    name: "Heredero",
    location: "Paraná, Entre Ríos",
    order: 5,
  },
];

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("Falta SANITY_API_WRITE_TOKEN en .env.local");
  }
  let ok = 0;
  for (const t of testimonials) {
    await sanityWriteClient.createOrReplace({
      _id: t._id,
      _type: "testimonial",
      quote: t.quote,
      name: t.name,
      location: t.location,
      active: true,
      order: t.order,
    });
    ok += 1;
    console.log(`  ✓ ${t.name}`);
  }
  console.log(`\nSeed OK: ${ok} testimonios cargados/actualizados en Sanity.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
