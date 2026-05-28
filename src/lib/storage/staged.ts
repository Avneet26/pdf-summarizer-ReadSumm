import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getR2Client } from "@/lib/storage/client";
import { getR2BucketName } from "@/lib/storage/config";

const SIGNED_UPLOAD_TTL_SEC = 15 * 60;

function bucketName(): string {
  const bucket = getR2BucketName();
  if (!bucket) {
    throw new Error("Cloudflare R2 bucket is not configured.");
  }
  return bucket;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Could not read the uploaded file from storage.");
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray === "function"
  ) {
    return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray());
  }

  const stream = body as AsyncIterable<Uint8Array>;
  const parts: Buffer[] = [];
  let totalLength = 0;

  for await (const chunk of stream) {
    const buf = Buffer.from(chunk);
    parts.push(buf);
    totalLength += buf.length;
  }

  return Buffer.concat(parts, totalLength);
}

export async function createSignedUploadUrl(
  objectPath: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: objectPath,
    ContentType: contentType,
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn: SIGNED_UPLOAD_TTL_SEC,
  });
}

export async function stagedFileExists(objectPath: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({
        Bucket: bucketName(),
        Key: objectPath,
      }),
    );
    return true;
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: string }).name)
        : "";
    if (name === "NotFound" || name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

export async function downloadStagedFile(objectPath: string): Promise<Buffer> {
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: objectPath,
    }),
  );

  return streamToBuffer(response.Body);
}

export async function deleteStagedFile(objectPath: string): Promise<void> {
  try {
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: bucketName(),
        Key: objectPath,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Storage] Failed to delete staged file: ${message}`);
  }
}
