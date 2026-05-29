import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

/**
 * On-the-fly image processing API.
 *
 * Usage: /api/image?src=/images/parts/blade.webp&removeBg=true&q=80&w=400
 *
 * Params:
 *   src       — local image path (relative to public/)
 *   removeBg  — remove white background (true/false)
 *   threshold — white detection threshold 0-255 (default: 240)
 *   q         — output quality 1-100 (default: 80)
 *   w         — resize width (optional)
 *   h         — resize height (optional)
 *   f         — output format: webp, png, avif (default: webp, png if removeBg for transparency)
 */

const CACHE = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h in-memory
const MAX_CACHE_SIZE = 500;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const src = searchParams.get("src");
  const removeBg = searchParams.get("removeBg") === "true";
  const threshold = Math.min(
    255,
    Math.max(0, parseInt(searchParams.get("threshold") || "240", 10)),
  );
  const quality = Math.min(100, Math.max(1, parseInt(searchParams.get("q") || "80", 10)));
  const width = searchParams.get("w") ? parseInt(searchParams.get("w")!, 10) : undefined;
  const height = searchParams.get("h") ? parseInt(searchParams.get("h")!, 10) : undefined;
  const format = searchParams.get("f") || (removeBg ? "png" : "webp");

  if (!src) {
    return NextResponse.json({ error: "Missing src parameter" }, { status: 400 });
  }

  // Security: block path traversal
  if (src.includes("..") || !src.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Cache key
  const cacheKey = `${src}:${removeBg}:${threshold}:${quality}:${width}:${height}:${format}`;

  // Check in-memory cache
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new NextResponse(new Uint8Array(cached.buffer), {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=2592000, immutable",
        "X-Cache": "HIT",
      },
    });
  }

  // Resolve file path
  const filePath = join(process.cwd(), "public", src);
  if (!(await Bun.file(filePath).exists())) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    const inputBuffer = Buffer.from(await Bun.file(filePath).arrayBuffer());
    let pipeline = sharp(inputBuffer);

    // Resize if requested
    if (width || height) {
      pipeline = pipeline.resize({
        width: width || undefined,
        height: height || undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Remove white background
    if (removeBg) {
      // Get raw pixel data to analyze and create alpha mask
      const { data, info } = await pipeline
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { width: w, height: h, channels } = info;
      const pixels = new Uint8Array(data.buffer, data.byteOffset, data.length);

      // Process pixels: make white/near-white pixels transparent
      for (let i = 0; i < pixels.length; i += channels) {
        const r = pixels[i]!;
        const g = pixels[i + 1]!;
        const b = pixels[i + 2]!;

        // Check if pixel is white/near-white
        if (r >= threshold && g >= threshold && b >= threshold) {
          // Fully transparent
          pixels[i + 3] = 0;
        } else if (r >= threshold - 20 && g >= threshold - 20 && b >= threshold - 20) {
          // Semi-transparent edge (anti-aliasing)
          const avg = (r + g + b) / 3;
          const alpha = Math.max(
            0,
            Math.min(255, Math.round((1 - (avg - (threshold - 20)) / 20) * 255)),
          );
          pixels[i + 3] = Math.min(pixels[i + 3]!, alpha);
        }
      }

      // Rebuild image from processed pixels
      pipeline = sharp(Buffer.from(pixels.buffer), {
        raw: { width: w, height: h, channels },
      });
    }

    // Output format
    let buffer: Buffer;
    let contentType: string;

    switch (format) {
      case "png":
        buffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
        contentType = "image/png";
        break;
      case "avif":
        buffer = await pipeline.avif({ quality }).toBuffer();
        contentType = "image/avif";
        break;
      default:
        // WebP supports transparency too
        buffer = await pipeline.webp({ quality, alphaQuality: 100 }).toBuffer();
        contentType = "image/webp";
        break;
    }

    // Store in cache (evict oldest if full)
    if (CACHE.size >= MAX_CACHE_SIZE) {
      const oldest = [...CACHE.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) CACHE.delete(oldest[0]);
    }
    CACHE.set(cacheKey, { buffer, contentType, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=2592000, immutable",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[/api/image] Error processing image:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
