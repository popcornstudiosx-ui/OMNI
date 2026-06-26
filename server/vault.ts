import { nanoid } from "nanoid";
import * as db from "./db";
import { storagePut, storageGet } from "./storage";
import type { InsertFile } from "../drizzle/schema";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { sendFileNotification } from "./websocket";

const s3Client = new S3Client({});

export async function uploadFileToVault(
  userId: number,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ fileKey: string; fileUrl: string }> {
  const fileKey = `vault/${userId}/${nanoid()}`;
  
  const { url } = await storagePut(fileKey, fileBuffer, mimeType);
  
  const fileRecord: InsertFile = {
    userId,
    fileName,
    fileKey,
    fileUrl: url,
    fileSize: fileBuffer.length,
    mimeType,
  };
  
  const result = await db.createFile(fileRecord);
  if ((result as any).insertId) {
    sendFileNotification(userId, Number((result as any).insertId), "created");
  }
  
  return { fileKey, fileUrl: url };
}

export async function getVaultFiles(userId: number) {
  return db.getFilesByUserId(userId);
}

export async function deleteVaultFile(userId: number, fileId: number) {
  const files = await db.getFilesByUserId(userId);
  const file = files.find(f => f.id === fileId);
  
  if (!file) throw new Error("File not found");
  
  // Delete from S3
  try {
    const bucketName = process.env.S3_BUCKET || "manus-storage";
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: file.fileKey,
    }));
  } catch (error) {
    console.error("Failed to delete file from S3:", error);
    // Continue with DB deletion even if S3 fails
  }
  
  // Delete from database
  await db.deleteFile(fileId);
  sendFileNotification(userId, fileId, "deleted");
  return { success: true };
}

export async function getFileContent(userId: number, fileKey: string): Promise<Buffer> {
  const files = await db.getFilesByUserId(userId);
  const file = files.find(f => f.fileKey === fileKey);
  
  if (!file) throw new Error("File not found");
  
  const { url } = await storageGet(fileKey);
  const response = await fetch(url);
  
  if (!response.ok) throw new Error("Failed to fetch file from storage");
  
  return Buffer.from(await response.arrayBuffer());
}

export async function listVaultFilesByName(userId: number): Promise<string[]> {
  const files = await db.getFilesByUserId(userId);
  return files.map(f => f.fileName);
}
