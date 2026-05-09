import { NextRequest, NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { getAdminStorage } from "@/lib/appwrite-server";
import { SPONSOR_ADS_BUCKET_ID } from "@/lib/appwrite";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;

    const urls: string[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const inputFile = InputFile.fromBuffer(Buffer.from(arrayBuffer), file.name);

      const uploaded = await getAdminStorage().createFile(
        SPONSOR_ADS_BUCKET_ID,
        ID.unique(),
        inputFile
      );

      const isVideo = file.type.startsWith("video/");
      const baseUrl = `${endpoint}/storage/buckets/${SPONSOR_ADS_BUCKET_ID}/files/${uploaded.$id}/view?project=${projectId}`;
      urls.push(isVideo ? `${baseUrl}&type=video` : baseUrl);
    }

    return NextResponse.json({ urls });
  } catch (error: unknown) {
    console.error("Error uploading files:", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
