import { s3 } from "@/lib/s3Client";
import { uploadFileSchema } from "@/lib/uploadFileSchema";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    // Get the data from the body
    const body = await request.json();

    // Validate the body data using zod
    const validation = uploadFileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
        },
        { status: 400 }
      );
    }

    const { contentType, fileName, size } = validation.data;
    const uniqueKey = `${uuidv4()}-{${fileName}}`;

    // Creating object command for S3
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: uniqueKey,
      ContentType: contentType,
      ContentLength: size,
    });

    // Creating the resigned URL
    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 5, // 5 minutes
    });
    const response = { presignedUrl, key: uniqueKey };

    return NextResponse.json(response, { status: 200 });
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
