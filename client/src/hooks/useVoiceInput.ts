import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";

interface UseVoiceInputOptions {
  onTranscribed?: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);

  const uploadVoiceMutation = trpc.omni.uploadVoiceInput.useMutation();
  const transcribeMutation = trpc.omni.transcribeVoice.useMutation();

  const stopRecording = useCallback(() => {
    console.log("[Voice] Stopping recording...");
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        console.log("[Voice] Stopping track:", track.kind);
        track.stop();
      });
      setIsRecording(false);
      console.log("[Voice] Recording stopped");
    } else {
      console.warn("[Voice] No active recording to stop");
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    console.log("[Voice] Starting recording...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[Voice] Microphone access granted, stream:", stream);
      
      // Setup VAD
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.1;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      silenceStartRef.current = null;
      isSpeakingRef.current = false;

      const checkSilence = () => {
        if (!analyserRef.current || !isRecording) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Threshold for speech detection (adjust as needed)
        const threshold = 10;
        
        if (average > threshold) {
          // User is speaking
          isSpeakingRef.current = true;
          silenceStartRef.current = null;
        } else if (isSpeakingRef.current) {
          // User was speaking, now silent
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > 1500) {
            // 1.5 seconds of silence detected after speaking
            console.log("[Voice] 1.5s silence detected, stopping recording...");
            stopRecording();
            return; // Stop checking
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(checkSilence);
      };

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      console.log("[Voice] MediaRecorder created");
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        console.log("[Voice] Data available, chunk size:", event.data.size);
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        console.log("[Voice] Recording stopped, processing audio...");
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          console.log("[Voice] Audio blob created, size:", audioBlob.size);
          
          // Only process if we have actual audio data
          if (audioBlob.size > 0 && isSpeakingRef.current) {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
              try {
                const base64 = (e.target?.result as string).split(",")[1];
                console.log("[Voice] Base64 encoded, length:", base64?.length);
                
                if (!base64) throw new Error("Failed to encode audio to base64");
                
                // Upload audio to server
                console.log("[Voice] Uploading audio to server...");
                const uploadResult = await uploadVoiceMutation.mutateAsync({
                  audioData: base64,
                  mimeType: "audio/webm",
                });
                
                const audioUrl = uploadResult.url;
                console.log("[Voice] Audio uploaded, URL:", audioUrl);
                
                if (!audioUrl) throw new Error("Failed to upload audio");
                
                // Transcribe audio
                console.log("[Voice] Transcribing audio...");
                const transcribeResult = await transcribeMutation.mutateAsync({
                  audioUrl,
                });
                
                const text = transcribeResult.text;
                console.log("[Voice] Transcription result:", text);
                
                if (text && text.trim().length > 0) {
                  console.log("[Voice] Calling onTranscribed with:", text);
                  options.onTranscribed?.(text);
                } else {
                  console.warn("[Voice] No text returned from transcription or text is empty");
                }
              } catch (error) {
                console.error("[Voice] Error in reader.onload:", error);
                const err = error instanceof Error ? error : new Error("Transcription failed");
                options.onError?.(err);
              } finally {
                setIsProcessing(false);
              }
            };
            
            reader.onerror = (error) => {
              console.error("[Voice] FileReader error:", error);
              options.onError?.(new Error("Failed to read audio file"));
              setIsProcessing(false);
            };
            
            console.log("[Voice] Starting FileReader...");
            reader.readAsDataURL(audioBlob);
          } else {
             console.log("[Voice] No speech detected or empty blob, skipping processing.");
             setIsProcessing(false);
          }
        } catch (error) {
          console.error("[Voice] Error in onstop:", error);
          const err = error instanceof Error ? error : new Error("Failed to process audio");
          options.onError?.(err);
          setIsProcessing(false);
        }
      };
      
      mediaRecorder.onerror = (error) => {
        console.error("[Voice] MediaRecorder error:", error);
        options.onError?.(new Error("Recording error: " + error.error));
        setIsRecording(false);
      };
      
      console.log("[Voice] Starting MediaRecorder...");
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      // Start VAD loop
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
           checkSilence();
        }
      }, 100); // slight delay to ensure state is updated

      console.log("[Voice] Recording started successfully");
    } catch (error) {
      console.error("[Voice] Error starting recording:", error);
      const err = error instanceof Error ? error : new Error("Failed to start recording");
      options.onError?.(err);
    }
  }, [options, uploadVoiceMutation, transcribeMutation, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
  };
}
