import { Client, Databases, Storage } from "node-appwrite";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[appwrite-server] Missing ${name}. Add it to qollaby-admin/.env.local (local) and to your host env (e.g. Vercel) for admin APIs.`
    );
  }
  return v;
}

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client()
      .setEndpoint(requireEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT"))
      .setProject(requireEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID"))
      .setKey(requireEnv("APPWRITE_API_KEY"));
  }
  return client;
}

let databases: Databases | null = null;

/** Appwrite Databases client using APPWRITE_API_KEY (bypasses user document ACL for admin reads). */
export function getAdminDatabases(): Databases {
  if (!databases) {
    databases = new Databases(getClient());
  }
  return databases;
}

let storage: Storage | null = null;

export function getAdminStorage(): Storage {
  if (!storage) {
    storage = new Storage(getClient());
  }
  return storage;
}
