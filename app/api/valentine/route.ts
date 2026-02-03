import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";

type StoredPayload = {
  id: string;
  message: string;
  photos: string[];
  music?: string | null;
  createdAt: string;
};

export const runtime = "nodejs";

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

const uploadPayloadToCloudinary = async (payload: StoredPayload) => {
  const buffer = Buffer.from(JSON.stringify(payload));
  const folder = `valentine/${payload.id}`;
  const publicId = "payload";

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "raw",
        overwrite: true,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error("Payload upload failed."));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

const loadPayloadFromCloudinary = async (id: string) => {
  const publicId = `valentine/${id}/payload`;
  const resource = await cloudinary.api.resource(publicId, {
    resource_type: "raw",
  });
  if (!resource?.secure_url) {
    throw new Error("Not found.");
  }
  const response = await fetch(resource.secure_url);
  if (!response.ok) {
    throw new Error("Not found.");
  }
  return (await response.json()) as StoredPayload;
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

    await uploadPayloadToCloudinary(payload);

    return NextResponse.json(payload);
  } catch (error) {
    console.log("Upload error:", { error });
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
    ensureCloudinary();
    const payload = await loadPayloadFromCloudinary(id);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
