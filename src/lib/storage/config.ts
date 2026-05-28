export function getR2AccountId(): string | undefined {
  return process.env.R2_ACCOUNT_ID?.trim() || undefined;
}

export function getR2AccessKeyId(): string | undefined {
  return process.env.R2_ACCESS_KEY_ID?.trim() || undefined;
}

export function getR2SecretAccessKey(): string | undefined {
  return process.env.R2_SECRET_ACCESS_KEY?.trim() || undefined;
}

export function getR2BucketName(): string | undefined {
  return process.env.R2_BUCKET_NAME?.trim() || undefined;
}

export function getR2Endpoint(): string | undefined {
  const explicit = process.env.R2_ENDPOINT?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const accountId = getR2AccountId();
  if (!accountId) return undefined;

  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    getR2AccountId() &&
      getR2AccessKeyId() &&
      getR2SecretAccessKey() &&
      getR2BucketName() &&
      getR2Endpoint(),
  );
}
