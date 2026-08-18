import { NextResponse } from "next/server";
import { sanityWriteClient } from "@/lib/sanity";
import { guard, LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/upload-logo — sube el archivo de arte/logo del formulario de
 * decorado a Sanity (asset) y devuelve su URL pública. Best effort: si algo
 * falla, el formulario sigue igual (el cliente puede mandar el arte por
 * WhatsApp). Server-side con SANITY_API_WRITE_TOKEN; el token no se expone.
 */
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const limited = await guard(req, LIMITS.lead);
  if (limited) return limited;

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "missing_write_token" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "bad_size" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const asset = await sanityWriteClient.assets.upload("file", buf, {
      filename: file.name || "logo",
      contentType: file.type || undefined,
    });
    return NextResponse.json({ ok: true, url: asset.url, assetId: asset._id });
  } catch (err) {
    console.error("[/api/upload-logo] error subiendo asset a Sanity:", err);
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }
}
