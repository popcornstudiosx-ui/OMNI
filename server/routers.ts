import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as vault from "./vault";
import * as taskQueue from "./taskQueue";
import * as omniChat from "./omniChat";
import * as voiceService from "./voiceService";

// Single-user workspace - always use userId 1
const WORKSPACE_USER_ID = 1;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  files: router({
    list: publicProcedure.query(async () => {
      try {
        return await db.getFilesByUserId(WORKSPACE_USER_ID);
      } catch (error) {
        console.error("Error listing files:", error);
        throw new Error(`Failed to list files: ${(error as Error).message}`);
      }
    }),
    upload: publicProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.fileData, "base64");
          return await vault.uploadFileToVault(WORKSPACE_USER_ID, input.fileName, buffer, input.mimeType);
        } catch (error) {
          console.error("Error uploading file:", error);
          throw new Error(`Failed to upload file: ${(error as Error).message}`);
        }
      }),
    delete: publicProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await vault.deleteVaultFile(WORKSPACE_USER_ID, input.fileId);
        } catch (error) {
          console.error("Error deleting file:", error);
          throw new Error(`Failed to delete file: ${(error as Error).message}`);
        }
      }),
  }),

  tasks: router({
    list: publicProcedure.query(async () => {
      try {
        return await db.getTasksByUserId(WORKSPACE_USER_ID);
      } catch (error) {
        console.error("Error listing tasks:", error);
        throw new Error(`Failed to list tasks: ${(error as Error).message}`);
      }
    }),
    create: publicProcedure
      .input(z.object({
        title: z.string(),
        instruction: z.string(),
        fileKeys: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const taskId = await taskQueue.enqueueTask(
            WORKSPACE_USER_ID,
            input.title,
            input.instruction,
            input.fileKeys
          );
          return { taskId };
        } catch (error) {
          console.error("Error creating task:", error);
          throw new Error(`Failed to create task: ${(error as Error).message}`);
        }
      }),
    getById: publicProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await db.getTaskByTaskId(input.taskId);
        } catch (error) {
          console.error("Error getting task by ID:", error);
          throw new Error(`Failed to get task: ${(error as Error).message}`);
        }
      }),
  }),

  messages: router({
    list: publicProcedure.query(async () => {
      try {
        return await db.getMessagesByUserId(WORKSPACE_USER_ID, 100);
      } catch (error) {
        console.error("Error listing messages:", error);
        throw new Error(`Failed to list messages: ${(error as Error).message}`);
      }
    }),
    create: publicProcedure
      .input(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await db.createMessage({
            userId: WORKSPACE_USER_ID,
            role: input.role,
            content: input.content,
          });
        } catch (error) {
          console.error("Error creating message:", error);
          throw new Error(`Failed to create message: ${(error as Error).message}`);
        }
      }),
  }),

  omni: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string(),
        fileKeys: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        // Store user message
        await db.createMessage({
          userId: WORKSPACE_USER_ID,
          role: "user",
          content: input.message,
        });

        // Get OMNI response
        try {
          const response = await omniChat.chatWithOMNI(
            WORKSPACE_USER_ID,
            input.message,
            input.fileKeys
          );
          return { response };
        } catch (error) {
          console.error("Error in omni.chat tRPC mutation:", error);
          return { response: `I encountered an error processing your request, boss: ${(error as Error).message}` };
        }
      }),
    
    // Get vault files for OMNI context
    getVaultFiles: publicProcedure.query(async () => {
      try {
        return await vault.getVaultFiles(WORKSPACE_USER_ID);
      } catch (error) {
        console.error("Error getting vault files for OMNI context:", error);
        throw new Error(`Failed to get vault files: ${(error as Error).message}`);
      }
    }),

    // Get file content by key
    getFileContent: publicProcedure
      .input(z.object({
        fileKey: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          const buffer = await vault.getFileContent(WORKSPACE_USER_ID, input.fileKey);
          return { content: buffer.toString("utf-8") };
        } catch (error) {
          console.error("Error getting file content:", error);
          throw new Error(`Failed to get file content: ${(error as Error).message}`);
        }
      }),

    // Get all tasks for monitoring
    getTasks: publicProcedure.query(async () => {
      try {
        return await db.getTasksByUserId(WORKSPACE_USER_ID);
      } catch (error) {
        console.error("Error getting tasks for monitoring:", error);
        throw new Error(`Failed to get tasks: ${(error as Error).message}`);
      }
    }),

    // Create a task from OMNI
    createTask: publicProcedure
      .input(z.object({
        title: z.string(),
        instruction: z.string(),
        fileKeys: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const taskId = await taskQueue.enqueueTask(
            WORKSPACE_USER_ID,
            input.title,
            input.instruction,
            input.fileKeys
          );
          return { taskId };
        } catch (error) {
          console.error("Error creating task from OMNI:", error);
          throw new Error(`Failed to create task: ${(error as Error).message}`);
        }
      }),

    // Delete a file from vault
    deleteFile: publicProcedure
      .input(z.object({
        fileId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await vault.deleteVaultFile(WORKSPACE_USER_ID, input.fileId);
        } catch (error) {
          console.error("Error deleting file from vault:", error);
          throw new Error(`Failed to delete file: ${(error as Error).message}`);
        }
      }),

    // Add a file from URL
    addFileFromUrl: publicProcedure
      .input(z.object({
        url: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch(input.url);
          if (!response.ok) throw new Error("Failed to fetch file from URL");
          const buffer = Buffer.from(await response.arrayBuffer());
          const mimeType = response.headers.get("content-type") || "application/octet-stream";
          return await vault.uploadFileToVault(WORKSPACE_USER_ID, input.fileName, buffer, mimeType);
        } catch (error) {
          console.error("Error adding file from URL:", error);
          throw new Error(`Failed to add file from URL: ${(error as Error).message}`);
        }
      }),

    // Delete a task (mark as failed to remove from active list)
    deleteTask: publicProcedure
      .input(z.object({
        taskId: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.updateTaskStatus(input.taskId, "failed");
          return { success: true };
        } catch (error) {
          console.error("Error deleting task:", error);
          throw new Error(`Failed to delete task: ${(error as Error).message}`);
        }
      }),

    // Send a proactive message from OMNI
    sendMessage: publicProcedure
      .input(z.object({
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await db.createMessage({
            userId: WORKSPACE_USER_ID,
            role: "assistant",
            content: input.content,
          });
        } catch (error) {
          console.error("Error sending proactive message from OMNI:", error);
          throw new Error(`Failed to send message: ${(error as Error).message}`);
        }
      }),
    
    transcribeVoice: publicProcedure
      .input(z.object({
        audioUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const text = await voiceService.transcribeVoiceInput(input.audioUrl);
          return { text };
        } catch (error) {
          console.error("Error transcribing voice:", error);
          throw new Error(`Failed to transcribe voice: ${(error as Error).message}`);
        }
      }),

    uploadVoiceInput: publicProcedure
      .input(z.object({
        audioData: z.string(), // base64 encoded
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.audioData, "base64");
          const url = await voiceService.uploadAudioBuffer(buffer, input.mimeType);
          return { url };
        } catch (error) {
          console.error("Error uploading voice input:", error);
          throw new Error(`Failed to upload voice input: ${(error as Error).message}`);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
