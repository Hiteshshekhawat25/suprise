import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { kv } from "@vercel/kv";

type StoredPayload = {
  id: string;
  message: string;
  photos: string[];
  music?: string | null;
  createdAt: string;
};

export const runtime = "nodejs";

const dataRoot = path.join(process.cwd(), "data", "valentine");
const kvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const ensureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured.");
  }
  

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
};

const uploadToCloudinary = async (
  id: string,
  file: File,
  subfolder: "photos" | "music"
) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const folder = `valentine/${id}/${subfolder}`;
  const resourceType = subfolder === "music" ? "video" : "image";

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error("Upload failed."));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

const savePayload = async (payload: StoredPayload) => {
  if (kvConfigured) {
    await kv.set(`valentine:${payload.id}`, payload);
    return;
  }
  await ensureDir(dataRoot);
  const dataPath = path.join(dataRoot, `${payload.id}.json`);
  await fs.writeFile(dataPath, JSON.stringify(payload, null, 2), "utf8");
};

const loadPayload = async (id: string) => {
  if (kvConfigured) {
    const payload = await kv.get<StoredPayload>(`valentine:${id}`);
    if (!payload) throw new Error("Not found.");
    return payload;
  }
  const dataPath = path.join(dataRoot, `${id}.json`);
  const raw = await fs.readFile(dataPath, "utf8");
  return JSON.parse(raw) as StoredPayload;
};

export async function POST(request: NextRequest) {
  try {
    ensureCloudinary();
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
    const photos: string[] = [];
    for (const file of photoFiles) {
      if (!file || typeof file.arrayBuffer !== "function") continue;
      const url = await uploadToCloudinary(id, file, "photos");
      photos.push(url);
    }

    let music: string | null = null;
    if (musicFile && typeof musicFile.arrayBuffer === "function") {
      music = await uploadToCloudinary(id, musicFile, "music");
    }

    const payload: StoredPayload = {
      id,
      message,
      photos,
      music,
      createdAt: new Date().toISOString(),
    };

    await savePayload(payload);

    return NextResponse.json(payload);
  } catch (error) {
    console.log("Upload error:", { error });
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  try {
    const payload = await loadPayload(id);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
