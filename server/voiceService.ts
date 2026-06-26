import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

export async function transcribeVoiceInput(audioUrl: string): Promise<string> {
  try {
    const result = await transcribeAudio({
      audioUrl,
      language: "en",
      prompt: "Transcribe the user's voice command for OMNI assistant",
    });

    if ("text" in result) {
      return result.text;
    } else if ("error" in result) {
      const errorMsg = typeof result.error === "string" ? result.error : (result.error as any)?.message || "Transcription failed";
      throw new Error(errorMsg);
    }

    throw new Error("Invalid transcription response");
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export async function uploadAudioBuffer(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const fileKey = `voice/${nanoid()}.webm`;
  const { url } = await storagePut(fileKey, audioBuffer, mimeType);
  return url;
}

export async function generateTextToSpeech(text: string): Promise<Buffer> {
  // This will use the built-in TTS API from Manus
  // For now, we'll return a placeholder that can be called from the frontend
  // The actual TTS will be handled by browser Web Speech API or a TTS service
  
  // In a real implementation, you would call:
  // const response = await fetch(`${BUILT_IN_FORGE_API_URL}/v1/audio/speech`, {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${BUILT_IN_FORGE_API_KEY}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     model: "tts-1",
  //     input: text,
  //     voice: "alloy",
  //   }),
  // });
  
  // For MVP, we'll use browser-based TTS
  throw new Error("TTS will be handled by frontend Web Speech API");
}
