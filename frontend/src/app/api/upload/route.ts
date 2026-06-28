import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/publitio";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  "audio/wav",
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/x-wav",
  "audio/3gpp",
  "video/webm",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Only audio files are allowed" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be smaller than 25MB" }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadFile(buffer, file.name, file.type);

    return NextResponse.json({
      id: uploaded.id,
      previewUrl: uploaded.url_preview,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[upload] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
