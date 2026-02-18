import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, X, Sparkles } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audio';

// NOTE: In a real production app, move API_KEY to a secure backend proxy.
// For this prototype, we assume process.env.API_KEY is available.
const API_KEY = process.env.API_KEY || '';

export const VoiceAssistant: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for Audio Contexts and cleanup
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanup = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    
    // Stop all playing sources
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    setIsActive(false);
    setIsConnecting(false);
    nextStartTimeRef.current = 0;
  };

  const startSession = async () => {
    if (!API_KEY) {
      setError("API Key not found. Please set process.env.API_KEY");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      // Initialize Audio Contexts
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      inputAudioContextRef.current = new InputContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new InputContextClass({ sampleRate: 24000 });
      
      // Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;



      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            
            // Setup Audio Processing for Input
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            
            // Using ScriptProcessor for compatibility, effectively creating chunks
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              
              // Send to Gemini
              if (sessionRef.current) {
                 sessionRef.current.sendRealtimeInput({ media: pcmBlob });
              }
            };
            
            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              // Ensure we don't schedule in the past
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBytes = decode(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              const gainNode = ctx.createGain();
              // A bit of volume boost
              gainNode.gain.value = 1.2; 
              
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              
              source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle interruptions
            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Session closed");
            cleanup();
          },
          onerror: (e: ErrorEvent) => {
            console.error("Session error", e);
            setError("Connection error. Please try again.");
            cleanup();
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            systemInstruction: `You are "Keza", a friendly and knowledgeable agricultural assistant for smallholder farmers in Rwanda. 
            Your role is to provide practical advice on maize and bean farming, weather interpretation, and pest control (specifically Fall Armyworm).
            
            Guidelines:
            - Speak clearly and concisely (max 2-3 sentences per turn).
            - Use a warm, encouraging tone.
            - Use metric units (Celcius, Liters, Hectares).
            - If asked about pests, suggest both organic (e.g. push-pull) and chemical options available in East Africa.
            - Acknowledge local context (Rwamagana district, hillside farming).`
        }
      };

      // const sessionPromise = ai.live.connect(config);
      // sessionRef.current = await sessionPromise;
      console.warn("Voice Assistant disabled for build verification.");
      setError("Voice Assistant momentarily unavailable.");
      setIsConnecting(false);

    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Failed to access microphone or connect.");
      setIsConnecting(false);
      cleanup();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-4">
      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-lg text-sm mb-2 animate-fade-in">
          {error}
        </div>
      )}

      {isActive && (
        <div className="bg-[#2D5A27] text-white p-4 rounded-2xl shadow-xl w-64 mb-2 animate-slide-up backdrop-blur-md bg-opacity-95">
            <div className="flex justify-between items-center mb-2">
                <span className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-300" /> 
                    Keza (Live)
                </span>
                <button onClick={cleanup} className="hover:bg-white/20 rounded-full p-1">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <p className="text-xs text-green-100 leading-relaxed">
                Listening... Ask about your soil moisture, pest identification, or weather forecast.
            </p>
            <div className="mt-3 flex gap-1 justify-center h-4 items-center">
                 {/* Simple Audio Visualizer Animation */}
                 <div className="w-1 bg-white/60 animate-[bounce_1s_infinite] h-2"></div>
                 <div className="w-1 bg-white/80 animate-[bounce_1.2s_infinite] h-4"></div>
                 <div className="w-1 bg-white/60 animate-[bounce_0.8s_infinite] h-2"></div>
            </div>
        </div>
      )}

      <button
        onClick={isActive ? cleanup : startSession}
        disabled={isConnecting}
        className={`h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
            isActive 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-[#2D5A27] hover:bg-[#1a3817]'
        } text-white`}
        aria-label="Toggle Voice Assistant"
      >
        {isConnecting ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isActive ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>
    </div>
  );
};