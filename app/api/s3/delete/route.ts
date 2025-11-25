import { s3 } from "@/lib/s3Client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    const key = body.key;
    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
    });
    await s3.send(command);
    return NextResponse.json(
      {
        message: "File deleted susccessfully",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({
        error: error.message,
      });
    }
    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
