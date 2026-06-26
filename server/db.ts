import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { InsertUser, users, File, InsertFile, Task, InsertTask, Message, InsertMessage, files, tasks, messages } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createFile(file: InsertFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(files).values(file);
  return result;
}

export async function getFilesByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(files).where(eq(files.userId, userId));
}

export async function deleteFile(fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.delete(files).where(eq(files.id, fileId));
}

export async function createTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(tasks).values(task);
}

export async function getTasksByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(tasks).where(eq(tasks.userId, userId));
}

export async function getTaskByTaskId(taskId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(tasks).where(eq(tasks.taskId, taskId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTaskStatus(taskId: string, status: string, result?: string, error?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updates: any = { status };
  if (status === 'running') updates.startedAt = new Date();
  if (status === 'completed' || status === 'failed') updates.completedAt = new Date();
  if (result) updates.result = result;
  if (error) updates.error = error;
  
  return db.update(tasks).set(updates).where(eq(tasks.taskId, taskId));
}

export async function createMessage(message: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(messages).values(message);
}

export async function getMessagesByUserId(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(messages).where(eq(messages.userId, userId)).orderBy(messages.createdAt).limit(limit);
}


