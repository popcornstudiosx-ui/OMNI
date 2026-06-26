import type { Express } from "express";
import { getStoredFile } from "../storage";

export function registerStorageProxy(app: Express) {
  // Handle /api/storage/{key} requests
  app.get("/api/storage/:key", async (req, res) => {
    const key = req.params.key;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const file = getStoredFile(key);
      if (!file) {
        res.status(404).send("File not found");
        return;
      }

      res.set("Content-Type", file.contentType);
      res.set("Cache-Control", "public, max-age=31536000");
      res.send(file.data);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(500).send("Storage proxy error");
    }
  });

  // Keep old /manus-storage/* route for backward compatibility
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const file = getStoredFile(key);
      if (!file) {
        res.status(404).send("File not found");
        return;
      }

      res.set("Content-Type", file.contentType);
      res.set("Cache-Control", "public, max-age=31536000");
      res.send(file.data);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(500).send("Storage proxy error");
    }
  });
}
