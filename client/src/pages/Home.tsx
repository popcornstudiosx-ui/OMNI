import { useState, useEffect, useCallback } from "react";
import { ArcReactor } from "@/components/ArcReactor";
import { ChatPanel } from "@/components/ChatPanel";
import { FileVaultPanel } from "@/components/FileVaultPanel";
import { TaskMonitor } from "@/components/TaskMonitor";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string>();

  const { startRecording, stopRecording, isRecording, isProcessing } = useVoiceInput({
    onTranscribed: (text) => {
      setTranscribedText(text);
      setIsListening(false);
    },
    onError: (error) => {
      console.error("Voice input error:", error);
      setIsListening(false);
    },
  });

  const { isSpeaking, speak } = useTextToSpeech();

  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
      setIsListening(false);
    } else {
      startRecording();
      setIsListening(true);
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleSendMessage = useCallback(async (content: string) => {
    // Message is handled by ChatPanel's mutation
  }, []);

  // Effect to automatically send transcribed text to chat
  useEffect(() => {
    if (transcribedText) {
      // This will trigger the ChatPanel's internal mutation
      // We pass it down as a prop, and ChatPanel will handle the actual sending
      // This ensures the message goes through the normal chat flow
      // and is stored in the database.
      // ChatPanel will clear transcribedText after sending.
    }
  }, [transcribedText]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Main workspace grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">
        {/* Left: Arc Reactor + Chat */}
        <div className="lg:col-span-2 flex flex-col overflow-hidden">
          {/* Arc Reactor section */}
          <div className="flex-1 flex items-center justify-center border-b border-slate-700 lg:border-b-0 lg:border-r">
            <ArcReactor
              isListening={isListening}
              isRecording={isRecording}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
              onMicToggle={handleMicToggle}
            />
          </div>

          {/* Chat section */}
          <div className="flex-1 flex flex-col overflow-hidden border-t border-slate-700 lg:border-t-0">
            <ChatPanel
              onSendMessage={handleSendMessage}
              isRecording={isRecording}
              isProcessing={isProcessing}
              onVoiceTranscribed={transcribedText}
              setTranscribedText={setTranscribedText}
            />
          </div>
        </div>

        {/* Right: File Vault + Task Monitor */}
        <div className="flex flex-col overflow-hidden">
          {/* File Vault */}
          <div className="flex-1 overflow-hidden border-t border-slate-700 lg:border-t-0">
            <FileVaultPanel />
          </div>

          {/* Task Monitor */}
          <div className="flex-1 overflow-hidden border-t border-slate-700">
            <TaskMonitor />
          </div>
        </div>
      </div>
    </div>
  );
}
