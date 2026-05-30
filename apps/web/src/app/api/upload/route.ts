import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  storeUploadedImage,
  type UploadScope,
  UploadValidationError,
} from "@/server/services/upload-store";

/** `type` envoyé par les composants → scope de stockage CDN. */
const TYPE_TO_SCOPE: Record<string, UploadScope> = {
  avatar: "avatars",
  banner: "banners",
  deckbox: "deckboxes",
  content: "content",
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const type = (formData.get("type") as string) || "deckbox";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const scope = TYPE_TO_SCOPE[type] ?? "deckboxes";
    const url = await storeUploadedImage(scope, session.user.id, file);

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error uploading file:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to upload file: ${errorMessage}` }, { status: 500 });
  }
}
