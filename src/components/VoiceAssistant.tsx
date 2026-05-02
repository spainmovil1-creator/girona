import { Mic, Square, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function base64EncodeAudio(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const uint8Array = new Uint8Array(int16Array.buffer);
  
  // Use chunks to prevent call stack overflow
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(uint8Array.slice(i, i + chunkSize)));
  }
  return btoa(binary);
}

export default function VoiceAssistant({ 
  text, 
  language, 
  onScroll, 
  onNavigate 
}: { 
  text: string; 
  language: 'es' | 'ca'; 
  onScroll?: (target: string) => void; 
  onNavigate?: (chapterNumber: number) => string | void;
}) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);

  const sessionRef = useRef<any>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const lastContextRef = useRef<string>("");

  const cleanContext = text
    .replace(/[*_#]/g, '')
    .replace(/>/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .slice(0, 1000);

  const stopAssistant = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    
    if (sessionRef.current) {
      try {
        sessionRef.current.close?.() || sessionRef.current.disconnect?.();
      } catch (e) {}
      sessionRef.current = null;
    }
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (inputContextRef.current) {
      inputContextRef.current.close().catch(() => {});
      inputContextRef.current = null;
    }

    if (outputContextRef.current) {
      outputContextRef.current.close().catch(() => {});
      outputContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    activeSourcesRef.current = [];
  }, []);

  useEffect(() => {
    return () => stopAssistant();
  }, [stopAssistant]);

  // Handle context updating when active
  useEffect(() => {
    if (isActive && sessionRef.current && cleanContext && cleanContext !== lastContextRef.current) {
      try {
        lastContextRef.current = cleanContext;
        sessionRef.current.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [{ text: `[SYSTEM: El usuario acaba de cambiar a esta sección. Toma nota del siguiente texto que está viendo ahora: ${cleanContext}]` }]
            }
          ],
          turnComplete: true
        });
      } catch (e) {
        console.error("Error updating context", e);
      }
    }
  }, [cleanContext, isActive]);

  const toggleSpeech = async () => {
    if (isActive || isConnecting) {
      stopAssistant();
      return;
    }

    setIsConnecting(true);

    try {
      lastContextRef.current = cleanContext;
      
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      outputContextRef.current = outputCtx;
      nextPlayTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;

      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;
      
      source.connect(processor);
      processor.connect(inputCtx.destination);

      const sysInst = `Eres un experto historiador y guía turístico que acompaña al usuario en un recorrido por Girona. Eres muy amable y servicial.
Importante: 
1. Responde SIEMPRE de forma conversacional y breve (es hablado).
2. Usa el idioma: ${language === 'es' ? 'Español' : 'Catalán'}
3. No uses markdown. No digas asteriscos ni comillas.
4. Si el usuario te pide ir a otro capítulo, usa la tool navigateToChapter.
5. Si te pide buscar algo o hablar sobre un tema de la pantalla actual, puedes usar la tool scrollToSection.
6. El texto actual de la pantalla que el usuario está viendo es: "${cleanContext}"

Saluda alegremente en un inicio y dile que estás disponible para contestar sus dudas sobre la etapa actual o llevarle a otro sitio si lo desea.`;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: sysInst,
          tools: [{
            functionDeclarations: [
              {
                name: "scrollToSection",
                description: "Haz scroll a un concepto que está en la pantalla o texto actual y que el usuario menciona.",
                parameters: {
                  type: Type.OBJECT,
                  properties: { target: { type: Type.STRING, description: "Un string descriptivo pequeño para buscar (ej 'Muralla' o 'Siglo XII')" } },
                  required: ["target"]
                }
              },
              {
                name: "navigateToChapter",
                description: "Navega y cambia a un número de capítulo determinado de la guía (e.g. 1, 2, 4...) si el usuario lo pide o cambiais de tema.",
                parameters: {
                  type: Type.OBJECT,
                  properties: { chapterNumber: { type: Type.NUMBER, description: "Número entero del capítulo (ej. 4, 10)" } },
                  required: ["chapterNumber"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onerror: (e) => {
            console.error('LiveSession error:', e);
            stopAssistant();
          },
          onopen: () => {
            console.log("Live session connected!");
            setIsConnecting(false);
            setIsActive(true);

            sessionPromise.then(session => {
              sessionRef.current = session;
              console.log("Session resolved and stored.");
            });

            processor.onaudioprocess = (e) => {
              if (!sessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const outputData = e.outputBuffer.getChannelData(0);
              
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += Math.abs(inputData[i]);
                outputData[i] = 0; // Prevent microphone feedback
              }
              setVolume(sum / inputData.length);
              
              const base64 = base64EncodeAudio(inputData);
              
              try {
                sessionRef.current.sendRealtimeInput({
                  audio: {
                    mimeType: "audio/pcm;rate=16000",
                    data: base64
                  }
                });
              } catch(err) {
                console.error("Audio send error", err);
              }
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log("Received server message:", message);
            if (message.toolCall && sessionRef.current) {
              console.log("Tool call received:", message.toolCall);
              const responses: any[] = [];
              for (const call of message.toolCall.functionCalls || []) {
                if (call.name === "scrollToSection" && onScroll) {
                  onScroll(call.args.target as string);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: "Success, navigated to section" }
                  });
                } else if (call.name === "navigateToChapter" && onNavigate) {
                  const newText = onNavigate(call.args.chapterNumber as number);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: newText ? `Success. The user is now looking at this text: "${newText.replace(/[*_#>]/g, '').slice(0, 2000)}"` : "Success, navigated to chapter" }
                  });
                } else {
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { error: "Action not supported or callback missing" }
                  });
                }
              }
              
              if (responses.length > 0) {
                // Send tool responses back
                try {
                  sessionRef.current.sendToolResponse({
                    functionResponses: responses
                  });
                } catch (e) {
                  console.error("Error sending tool response", e);
                }
              }
            }
            
            if (message.serverContent && outputContextRef.current) {
              const playCtx = outputContextRef.current;
              
              // Interruption handling (if AI stops generating, or user speaks)
              if (message.serverContent.interrupted) {
                 console.log("Interruption from server!");
                 activeSourcesRef.current.forEach(source => {
                   try { source.stop(); } catch(e) {}
                 });
                 activeSourcesRef.current = [];
                 nextPlayTimeRef.current = playCtx.currentTime;
              }

              // Play audio parts
              if (message.serverContent.modelTurn?.parts) {
                message.serverContent.modelTurn.parts.forEach(part => {
                  if (part.inlineData && part.inlineData.data) {
                    try {
                      const binary = atob(part.inlineData.data);
                      const bytes = new Uint8Array(binary.length);
                      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                      
                      const length = bytes.length % 2 === 0 ? bytes.length : bytes.length - 1;
                      const validBuffer = bytes.buffer.slice(0, length);
                      const pcm16 = new Int16Array(validBuffer);
                      
                      const audioBuffer = playCtx.createBuffer(1, pcm16.length, 24000);
                      const channelData = audioBuffer.getChannelData(0);
                      for (let i = 0; i < pcm16.length; i++) {
                        channelData[i] = pcm16[i] / 32768.0;
                      }
                      
                      const playSource = playCtx.createBufferSource();
                      playSource.buffer = audioBuffer;
                      playSource.connect(playCtx.destination);
                      
                      playSource.onended = () => {
                        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== playSource);
                      };
                      activeSourcesRef.current.push(playSource);
                      
                      const startTime = Math.max(nextPlayTimeRef.current, playCtx.currentTime);
                      playSource.start(startTime);
                      nextPlayTimeRef.current = startTime + audioBuffer.duration;
                    } catch (err) {
                      console.error("Error playing audio chunk:", err);
                    }
                  }
                  
                  // For debugging text output (not speech, just transcripts if enabled or parts)
                  if (part.text) {
                     console.log("Model response text:", part.text);
                  }
                });
              }
            }
          },
          onclose: (e) => {
            console.log("Session closed:", e);
            stopAssistant();
          },
        }
      });
      
      sessionPromise.catch(e => {
        console.error("Session promise rejected:", e);
        stopAssistant();
      });
      
    } catch (e) {
      console.error("Error starting speech", e);
      stopAssistant();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center relative">
      <button 
        onClick={toggleSpeech} 
        disabled={isConnecting}
        className={`flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-full border shadow-md transition-all duration-300 relative z-10 ${
          isActive 
            ? 'bg-red-500 border-red-600 text-white animate-pulse' 
            : 'bg-[var(--color-brand-bg)] border-[var(--color-brand-heading)] text-[var(--color-brand-heading)] hover:shadow-lg hover:bg-[var(--color-brand-heading)] hover:text-white pb-[2px]'
        }`}
        aria-label={isActive ? "Detener asistente" : "Hablar con el asistente"}
        title={isActive ? "Detener asistente" : "Hablar con el asistente"}
      >
        {isConnecting ? (
          <Loader2 size={24} className="animate-spin" />
        ) : isActive ? (
          <Square fill="currentColor" size={20} />
        ) : (
          <Mic size={24} />
        )}
      </button>

      {isActive && (
        <span className="absolute top-[80px] text-xs font-medium text-red-500 whitespace-nowrap animate-pulse px-3 py-1 bg-white/90 rounded-full shadow-sm z-20">
          Escuchando...
        </span>
      )}
      {isActive && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/20 pointer-events-none transition-all duration-75"
          style={{
            width: `${64 + volume * 800}px`,
            height: `${64 + volume * 800}px`,
            opacity: Math.max(0.1, Math.min(0.8, volume * 15))
          }}
        />
      )}
    </div>
  );
}
