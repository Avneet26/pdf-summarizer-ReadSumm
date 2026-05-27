import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

const APP_NAME = "pdf-reader";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Firebase is not configured: missing ${name}. Set it in your environment (e.g. Vercel project settings or Cursor secrets).`,
    );
  }
  return value;
}

function normalizePrivateKey(raw: string): string {
  // Service-account private keys are often pasted as a single line with the
  // newlines encoded as the literal string "\n". Restore real newlines so
  // OpenSSL can parse the PEM.
  return raw.replace(/\\n/g, "\n");
}

function buildApp(): App {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(requireEnv("FIREBASE_PRIVATE_KEY"));
  const storageBucket = requireEnv("FIREBASE_STORAGE_BUCKET");

  return initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    },
    APP_NAME,
  );
}

function getOrCreateApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;
  return buildApp();
}

/** Returns the configured upload bucket (creates the Firebase app lazily). */
export function getUploadBucket(): Bucket {
  const app = getOrCreateApp();
  return getStorage(app).bucket();
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_STORAGE_BUCKET,
  );
}
