import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";

type StoredPayload = {
  id: string;
  message: string;
  photos: string[];
  music?: string | null;
  createdAt: string;
};

export const runtime = "nodejs";

const uploadsRoot = path.join(process.cwd(), "public", "valentine");
const dataRoot = path.join(process.cwd(), "data", "valentine");

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const safeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 64) || "file";

const saveFile = async (
  id: string,
  file: File,
  subfolder: string,
  fallbackName: string
) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = path.extname(file.name) || "";
  const baseName = safeFileName(path.basename(file.name, ext) || fallbackName);
  const fileName = `${baseName}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const folder = path.join(uploadsRoot, id, subfolder);
  await ensureDir(folder);
  const filePath = path.join(folder, fileName);
  await fs.writeFile(filePath, buffer);
  return `/valentine/${id}/${subfolder}/${fileName}`;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = String(formData.get("message") || "").trim();
    const photoFiles = formData.getAll("photos") as File[];
    const musicFile = formData.get("music") as File | null;

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (!photoFiles || photoFiles.length === 0) {
      return NextResponse.json({ error: "At least one photo is required." }, { status: 400 });
    }

    const id = crypto.randomBytes(10).toString("hex");
    await ensureDir(path.join(uploadsRoot, id));
    await ensureDir(dataRoot);

    const photos: string[] = [];
    for (const file of photoFiles) {
      if (!file || typeof file.arrayBuffer !== "function") continue;
      const url = await saveFile(id, file, "photos", "photo");
      photos.push(url);
    }

    let music: string | null = null;
    if (musicFile && typeof musicFile.arrayBuffer === "function") {
      music = await saveFile(id, musicFile, "music", "song");
    }

    const payload: StoredPayload = {
      id,
      message,
      photos,
      music,
      createdAt: new Date().toISOString(),
    };

    const dataPath = path.join(dataRoot, `${id}.json`);
    await fs.writeFile(dataPath, JSON.stringify(payload, null, 2), "utf8");

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  try {
    const dataPath = path.join(dataRoot, `${id}.json`);
    const raw = await fs.readFile(dataPath, "utf8");
    const payload = JSON.parse(raw) as StoredPayload;
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
