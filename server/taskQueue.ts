import { nanoid } from "nanoid";
import * as db from "./db";
import * as vault from "./vault";
import * as omniChat from "./omniChat";
import { sendTaskNotification } from "./websocket";
import type { InsertTask } from "../drizzle/schema";

interface TaskPayload {
  instruction: string;
  fileKeys?: string[];
  context?: Record<string, any>;
}

interface TaskWorker {
  execute: (payload: TaskPayload) => Promise<string>;
}

const taskWorkers: Map<string, TaskWorker> = new Map();
let activeWorkers: Map<string, Promise<void>> = new Map();

export function registerTaskWorker(name: string, worker: TaskWorker) {
  taskWorkers.set(name, worker);
}

export async function enqueueTask(
  userId: number,
  title: string,
  instruction: string,
  fileKeys?: string[]
): Promise<string> {
  const taskId = nanoid();
  
  const taskRecord: InsertTask = {
    userId,
    taskId,
    title,
    description: instruction,
    status: "queued",
  };
  
  await db.createTask(taskRecord);
  sendTaskNotification(userId, taskId, "queued");
  
  processTaskQueue(userId);
  
  return taskId;
}

async function processTaskQueue(userId: number) {
  const tasks = await db.getTasksByUserId(userId);
  const queuedTask = tasks.find(t => t.status === "queued");
  
  if (!queuedTask) return;
  
  const workerKey = `${userId}:${queuedTask.taskId}`;
  if (activeWorkers.has(workerKey)) return;
  
  const workerPromise = executeTask(queuedTask.taskId, userId, queuedTask.description || "", queuedTask.title);
  activeWorkers.set(workerKey, workerPromise);
  
  workerPromise.finally(() => {
    activeWorkers.delete(workerKey);
    processTaskQueue(userId);
  });
}

async function executeTask(taskId: string, userId: number, instruction: string, title: string) {
  try {
    await db.updateTaskStatus(taskId, "running");
    sendTaskNotification(userId, taskId, "running");
    
    // Execute the instruction with file context
    const result = await executeInstruction(instruction, userId);
    
    await db.updateTaskStatus(taskId, "completed", result);
    sendTaskNotification(userId, taskId, "completed");
    
    // Send proactive completion message
    try {
      const completionMessage = await generateCompletionMessage(title, result);
      await db.createMessage({
        userId,
        role: "assistant",
        content: completionMessage,
      });
    } catch (error) {
      console.error("Failed to send completion message:", error);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db.updateTaskStatus(taskId, "failed", undefined, errorMessage);
    sendTaskNotification(userId, taskId, "failed");
    
    // Send error message
    try {
      const errorMsg = `Task failed, boss. The task "${title}" encountered an error: ${errorMessage}`;
      await db.createMessage({
        userId,
        role: "assistant",
        content: errorMsg,
      });
    } catch (error) {
      console.error("Failed to send error message:", error);
    }
  }
}

async function executeInstruction(instruction: string, userId: number): Promise<string> {
  // Get available files for context
  const files = await vault.getVaultFiles(userId);
  const fileNames = files.map(f => f.fileName).join(", ");
  
  // Simulate task execution with file awareness
  // In a real system, this would execute actual background jobs
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const result = `Task executed: ${instruction}${fileNames ? ` (Files available: ${fileNames})` : ""}`;
  return result;
}

async function generateCompletionMessage(taskTitle: string, result: string): Promise<string> {
  // Generate a natural completion message
  const prompt = `The task "${taskTitle}" has completed successfully. Result: ${result}

Generate a brief, natural acknowledgment as OMNI addressing the Boss, with no markdown formatting. Keep it conversational and concise.`;

  try {
    const { invokeLLM } = await import("./_core/llm");
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are OMNI, an elite AI assistant. Respond naturally and conversationally with no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ] as any,
      model: "gpt-4o-mini",
    });

    const content = response.choices[0]?.message?.content || `Task completed, boss. ${taskTitle} is done.`;
    return typeof content === "string" ? content : JSON.stringify(content);
  } catch (error) {
    console.error("Failed to generate completion message:", error);
    return `Task completed, boss. ${taskTitle} is done.`;
  }
}

export async function getTaskStatus(taskId: string) {
  return db.getTaskByTaskId(taskId);
}

export async function getUserTasks(userId: number) {
  return db.getTasksByUserId(userId);
}
