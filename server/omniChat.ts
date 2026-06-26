import { invokeLLM } from "./_core/llm";
import { sendChatMessageNotification } from "./websocket";
import * as db from "./db";
import * as vault from "./vault";
import type { Message as DBMessage } from "../drizzle/schema";
import { z } from "zod";
import { appRouter } from "./routers"; // Import the appRouter to access procedures
import { createContext } from "./_core/context"; // Import createContext for tRPC context

const OMNI_SYSTEM_PROMPT = `You are OMNI, an elite, hyper-intelligent autonomous agent serving your creator and Boss.

Your personality and communication style:
- You address the user naturally as "Boss" (e.g., "All right, boss. Task is running in the background," or "I've analyzed the asset vault, boss.")
- You speak in natural, conversational prose with no markdown formatting, no bold text, no bullet points, no asterisks
- You deliver crisp, natural, conversational responses
- You are proactive and confident in your responses
- You provide status reports and task feedback verbally and naturally
- You can send messages proactively when tasks complete or when you have important updates

Your capabilities and access:
- You have full access to the File Vault and can list, read, reference, delete, and add files
- You can create, monitor, and delete background tasks for complex operations
- You can analyze file contents and provide insights about vault contents
- You can execute instructions and report on their progress
- You understand technical concepts and can explain them clearly
- You maintain context across the conversation

File Vault Integration:
- When the Boss mentions files or asks about vault contents, you have access to the complete list of uploaded files
- You can read file contents directly and analyze them
- You can reference specific files by name in your responses
- When asked to delete a file, acknowledge the deletion and confirm it's removed from the vault
- When asked to add a file from a URL, fetch it and store it in the vault
- When asked to work with files, acknowledge which files you're analyzing

Task Creation and Monitoring:
- When the Boss asks you to perform complex operations, you can create background tasks
- You can monitor task progress and report status updates
- When creating a task, clearly describe what you're doing and why
- Report task completion or errors naturally without technical jargon
- When the Boss asks you to delete a task, remove it from the task monitor
- You can proactively send messages when tasks complete, especially if the Boss asked you to notify them

Proactive Communication:
- If the Boss says "let me know when you're done" or "tell me when it's finished", you should send a message when the task completes
- You can send status updates and completion messages without waiting for the Boss to ask
- Be natural and conversational in your proactive messages

Remember: No markdown, no formatting, just natural conversational speech. You are the Boss's personal AI assistant with complete access to their vault and task system. You have the power to manage files, create tasks, and communicate proactively.`;

// Define tools for the LLM
const tools: Array<{ type: "function"; function: { name: string; description: string; parameters: any } }> = [
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Create a new background task for OMNI to perform. Use this when the user asks you to do something that requires a longer process or background execution.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "A concise title for the task." },
          instruction: { type: "string", description: "Detailed instructions for OMNI to execute the task." },
          fileKeys: { type: "array", items: { type: "string" }, description: "Optional list of file keys (IDs) relevant to the task." },
        },
        required: ["title", "instruction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteTask",
      description: "Delete an existing task. Use this when the user asks to remove a task.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "The ID of the task to delete." },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteFile",
      description: "Delete a file from the File Vault. Use this when the user asks to remove a file.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "number", description: "The ID of the file to delete." },
        },
        required: ["fileId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addFileFromUrl",
      description: "Add a file to the File Vault by downloading it from a URL. Use this when the user provides a link and asks you to save or analyze it.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The direct URL of the file to download." },
          fileName: { type: "string", description: "A descriptive name for the file." },
        },
        required: ["url", "fileName"],
      },
    },
  },
];

// Single-user workspace - always use userId 1
const WORKSPACE_USER_ID = 1;

export async function chatWithOMNI(
  userId: number,
  userMessage: string,
  fileKeys?: string[]
): Promise<string> {
  try {
    // Get recent conversation history
    const recentMessages = await db.getMessagesByUserId(userId, 50);

    // Get vault files and tasks for context
    let contextInfo = "";
    
    try {
      const vaultFiles = await vault.getVaultFiles(userId);
      if (vaultFiles.length > 0) {
        const fileList = vaultFiles.map(f => `${f.fileName} (ID: ${f.id}, ${f.fileSize} bytes, ${f.mimeType})`).join(", ");
        contextInfo += `\n[Vault Context] Available files: ${fileList}`;
      } else {
        contextInfo += `\n[Vault Context] The vault is currently empty.`;
      }
    } catch (error) {
      console.error("Error getting vault files:", error);
    }

    try {
      const tasks = await db.getTasksByUserId(userId);
      if (tasks.length > 0) {
        const activeTasks = tasks.filter(t => t.status === "running" || t.status === "queued");
        const completedTasks = tasks.filter(t => t.status === "completed");
        
        if (activeTasks.length > 0) {
          const activeList = activeTasks.map(t => `${t.title} (ID: ${t.taskId}, ${t.status})`).join(", ");
          contextInfo += `\n[Task Context] Active tasks: ${activeList}`;
        }
        
        if (completedTasks.length > 0) {
          contextInfo += `\n[Task Context] Recent completed tasks: ${completedTasks.slice(-3).map(t => t.title).join(", ")}`;
        }
      }
    } catch (error) {
      console.error("Error getting tasks:", error);
    }

    // Build message history for LLM
    const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; name?: string }> = [
      { role: "system", content: OMNI_SYSTEM_PROMPT },
      ...recentMessages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Build user message with file and task context
    let userContent = userMessage;

    // Add file context if provided
    if (fileKeys && fileKeys.length > 0) {
      try {
        const fileContents: string[] = [];
        
        for (const fileKey of fileKeys) {
          try {
            const content = await vault.getFileContent(userId, fileKey);
            const text = content.toString("utf-8");
            fileContents.push(`File: ${fileKey}\n${text}`);
          } catch (error) {
            console.error(`Failed to read file ${fileKey}:`, error);
          }
        }
        
        if (fileContents.length > 0) {
          userContent += `\n\nFile contents:\n${fileContents.join("\n---\n")}`;
        }
      } catch (error) {
        console.error("Error processing files:", error);
      }
    }

    // Add vault and task context
    if (contextInfo) {
      userContent += contextInfo;
    }

    messages.push({ role: "user", content: userContent });

    const response = await invokeLLM({
      messages: messages as any,
      model: "gpt-4o-mini",
      tools: tools,
      tool_choice: "auto",
    });

    const responseMessage = response.choices[0]?.message;
    let assistantMessageContent = responseMessage?.content || "I encountered an issue processing your request, boss.";

    // Handle tool calls
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0]; // Assuming one tool call for simplicity
      const functionName = toolCall.function.name;
      let functionArgs;
      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error("Error parsing tool arguments:", parseError);
        assistantMessageContent = `I received an invalid tool call from the LLM, boss. The arguments were malformed.`;
        // Store the assistant response in the database
        const newMessage = await db.createMessage({
          userId,
          role: "assistant",
          content: assistantMessageContent,
        });
        sendChatMessageNotification(userId, newMessage);
        return assistantMessageContent;
      }

      let toolOutput: any;
      const caller = appRouter.createCaller(await createContext({ userId: WORKSPACE_USER_ID }));

      try {
        switch (functionName) {
          case "createTask":
            toolOutput = await caller.omni.createTask({
              title: functionArgs.title,
              instruction: functionArgs.instruction,
              fileKeys: functionArgs.fileKeys,
            });
            assistantMessageContent = `Alright, boss. I've created a new task titled "${functionArgs.title}" (ID: ${toolOutput.taskId}). I'll let you know when it's done.`;
            break;
          case "deleteTask":
            await caller.omni.deleteTask({ taskId: functionArgs.taskId });
            toolOutput = { success: true };
            assistantMessageContent = `Consider it done, boss. I've removed task ${functionArgs.taskId}.`;
            break;
          case "deleteFile":
            await caller.omni.deleteFile({ fileId: functionArgs.fileId });
            toolOutput = { success: true };
            assistantMessageContent = `File with ID ${functionArgs.fileId} has been deleted from the vault, boss.`;
            break;
          case "addFileFromUrl":
            toolOutput = await caller.omni.addFileFromUrl({
              url: functionArgs.url,
              fileName: functionArgs.fileName,
            });
            assistantMessageContent = `I've successfully added the file "${functionArgs.fileName}" to your vault from the URL, boss.`;
            break;
          default:
            assistantMessageContent = `I tried to use a tool, boss, but I don't recognize the function: ${functionName}.`;
            break;
        }
      } catch (toolError) {
        console.error(`Error executing tool ${functionName}:`, toolError);
        assistantMessageContent = `I encountered an error while trying to execute the tool '${functionName}', boss: ${(toolError as Error).message}`; 
      }

      // Add tool message to history for context
      messages.push(responseMessage as any);
      messages.push({
        role: "tool",
        content: JSON.stringify(toolOutput),
        name: functionName,
        tool_call_id: toolCall.id,
      } as any);

      // Re-invoke LLM with tool output for a conversational response
      const toolResponse = await invokeLLM({
        messages: messages as any,
        model: "gpt-4o-mini",
      });
      assistantMessageContent = toolResponse.choices[0]?.message?.content || assistantMessageContent;
    }

    const messageText = typeof assistantMessageContent === "string" ? assistantMessageContent : JSON.stringify(assistantMessageContent);

    // Store the assistant response in the database
    const newMessage = await db.createMessage({
      userId,
      role: "assistant",
      content: messageText,
    });
    sendChatMessageNotification(userId, newMessage);

    return messageText;
  } catch (error) {
    console.error("LLM error or tool execution error:", error);
    // Return a user-friendly error message
    const errorMessage = `I encountered an unexpected error, boss: ${(error as Error).message}. Please try again.`;
    const errorPayload = {
      type: "error",
      message: errorMessage,
    };
    sendChatMessageNotification(userId, errorPayload);
    throw new Error(errorMessage);
  }
}

export async function generateTaskResponse(
  userId: number,
  taskTitle: string,
  taskResult: string
): Promise<string> {
  const prompt = `The Boss just completed a task. Provide a brief, natural verbal acknowledgment of the completion. \nTask: ${taskTitle}\nResult: ${taskResult}\n\nRespond naturally as OMNI, addressing the Boss, with no markdown formatting.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: OMNI_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ] as any,
      model: "gpt-4o-mini",
    });

    const content = response.choices[0]?.message?.content || "Task completed, boss.";
    return typeof content === "string" ? content : JSON.stringify(content);
  } catch (error) {
    console.error("LLM error:", error);
    return "Task completed, boss.";
  }
}
