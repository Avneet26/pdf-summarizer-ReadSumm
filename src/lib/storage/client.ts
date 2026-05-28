import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import {
  getR2AccessKeyId,
  getR2Endpoint,
  getR2SecretAccessKey,
} from "@/lib/storage/config";

let client: S3Client | undefined;

export function getR2Client(): S3Client {
  if (client) return client;

  const endpoint = getR2Endpoint();
  const accessKeyId = getR2AccessKeyId();
  const secretAccessKey = getR2SecretAccessKey();

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 is not configured.");
  }

  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Default SDK checksums break browser PUT presigned URLs (403 → "CORS missing").
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return client;
}
