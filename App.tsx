import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { ScriptFormat, ScriptLine, ProcessingState, AppTab, User, AuthState, HistoryRecord } from './types.ts';
import VideoUploader from './components/VideoUploader.tsx';
import ScriptViewer from './components/ScriptViewer.tsx';
import ProcessingIndicator from './components/ProcessingIndicator.tsx';
import AuthPage from './components/AuthPage.tsx';
import HistoryPanel from './components/HistoryPanel.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import { authAPI, historyAPI, getToken, removeToken } from './api.ts';

const VEO_LOADING_MESSAGES = [
  "Initializing Veo Cinema Engine...",
  "Analyzing visual composition...",
  "Synthesizing high-fidelity motion vectors...",
  "Rendering cinematic lighting and textures...",
  "Optimizing temporal consistency...",
  "Finalizing production-grade output..."
];

const VIDEO_STYLES = [
  { id: 'none', label: 'Default', prompt: '' },
  { id: 'cinematic', label: 'Cinematic', prompt: 'Cinematic lighting, high production value, 8k, professional grading' },
  { id: 'anime', label: 'Studio Ghibli Anime', prompt: 'Hand-drawn anime style, vibrant colors, painterly backgrounds, Studio Ghibli aesthetic' },
  { id: 'noir', label: 'Film Noir', prompt: 'High contrast black and white, dramatic shadows, moody atmosphere, classic film grain' },
  { id: 'cyberpunk', label: 'Cyberpunk', prompt: 'Neon lights, futuristic rainy atmosphere, high-tech gritty textures, electric blue and hot pink hues' },
  { id: 'photorealistic', label: 'Photorealistic', prompt: 'Ultra-realistic textures, natural lighting, shot on 35mm lens, highly detailed' },
  { id: '3d-render', label: '3D Animation', prompt: 'Disney Pixar style 3D render, expressive characters, soft global illumination' }
];

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

const App: React.FC = () => {
  // ─── Auth State ────────────────────────────────────────────────────────────
  const [auth, setAuth] = useState<AuthState>({ user: null, token: null, isAuthenticated: false });
  const [authLoading, setAuthLoading] = useState(true);

  // ─── App State ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AppTab>('script');
  const [format, setFormat] = useState<ScriptFormat>('tamil');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [veoLoadingMessage, setVeoLoadingMessage] = useState(VEO_LOADING_MESSAGES[0]);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [script, setScript] = useState<ScriptLine[] | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, step: 0, message: '' });
  const videoRef = useRef<HTMLVideoElement>(null);

  const [imagePrompt, setImagePrompt] = useState('');
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');

  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
  const [videoStyle, setVideoStyle] = useState('cinematic');
  const [animatingFile, setAnimatingFile] = useState<File | null>(null);
  const [lastVideoOperation, setLastVideoOperation] = useState<any>(null);

  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [thinkingMode, setThinkingMode] = useState(false);

  const [ttsText, setTtsText] = useState('');
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState('');
  const [lastTtsBuffer, setLastTtsBuffer] = useState<AudioBuffer | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const echoNodeRef = useRef<DelayNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const liveSessionPromiseRef = useRef<Promise<any> | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const transcriptionBufferRef = useRef('');

  const [audioPitch, setAudioPitch] = useState(1.0);
  const [echoDelay, setEchoDelay] = useState(0.0);
  const [reverbWet, setReverbWet] = useState(0.0);

  // ─── Check existing auth on mount ──────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) { setAuthLoading(false); return; }
      try {
        const res = await authAPI.me();
        setAuth({ user: res.user, token, isAuthenticated: true });
      } catch {
        removeToken();
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => { if (sourceRef.current) sourceRef.current.playbackRate.value = audioPitch; }, [audioPitch]);
  useEffect(() => { if (echoNodeRef.current) echoNodeRef.current.delayTime.value = echoDelay; }, [echoDelay]);
  useEffect(() => { if (wetGainRef.current) wetGainRef.current.gain.value = reverbWet; }, [reverbWet]);

  const handleAuthSuccess = (user: User, token: string) => {
    setAuth({ user, token, isAuthenticated: true });
  };

  const handleLogout = () => {
    removeToken();
    setAuth({ user: null, token: null, isAuthenticated: false });
    setScript(null);
    setVideoFile(null);
    setVideoUrl(null);
    setActiveTab('script');
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error("File conversion failed."));
    });

  const handleFileSelect = useCallback((file: File) => {
    setVideoFile(file);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setScript(null);
    setError(null);
  }, [videoUrl]);

  const handleSeek = (time: string) => {
    if (!videoRef.current) return;
    const parts = time.split(':').map(parseFloat);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 1) seconds = parts[0];
    if (!isNaN(seconds)) { videoRef.current.currentTime = seconds; videoRef.current.play().catch(() => { }); }
  };

  const checkAndOpenKey = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      if (!await (window as any).aistudio.hasSelectedApiKey()) await (window as any).aistudio.openSelectKey();
    }
  };

  const handleExport = async () => {
    if (!script) return;
    const header = `KURALDUB PRO - OFFICIAL DUBBING SCRIPT\n`;
    const subHeader = `Format: ${format.toUpperCase()} | Generation Date: ${new Date().toLocaleString()}\n`;
    const separator = `==================================================\n\n`;
    const content = script.map(line => {
      const dialogue = format === 'tamil' ? line.versions.spoken : line.versions.tanglish;
      let text = `[${line.startTime} - ${line.endTime}] ${line.person}:\n`;
      if (line.actionDescription) text += `Action: [ ${line.actionDescription} ]\n`;
      text += `${dialogue}\n`;
      return text;
    }).join('\n');
    const fullText = header + subHeader + separator + content;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `KuralDub_Official_Script_${new Date().getTime()}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateTamilScript = async () => {
    if (!videoFile) return;
    setProcessing({ isProcessing: true, step: 1, message: 'Performing Global Video Analysis (00:00 - END)...' });
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = await fileToBase64(videoFile);
      const systemPrompt = `You are a PROFESSIONAL Tamil Lip-Sync Dubbing Script Generator.
      GOAL: Generate FULL VIDEO Tamil dubbing script from start to end (00:00 to END).

      CRITICAL RULES:
      1. ANALYZE THE ENTIRE VIDEO. Do not stop after 30 seconds.
      2. EVERY SPOKEN WORD must be converted into Tamil script. No skipping.
      3. If you output less than 20 timestamps, it is a failure. Be granular.
      4. SYLLABLE MATCHING: Match mouth movement perfectly using Kollywood style.
      5. SPOKEN TAMIL: Use natural day-to-day spoken Tamil (Chennai/Madurai style). Avoid formal words.
      6. MULTIPLE SPEAKERS: Automatically detect and name different speakers.
      
      OUTPUT FORMAT (MANDATORY):
      [START_TIME – END_TIME]
      Speaker: <Name>
      Original Meaning: <Meaning>
      Emotion: <Mood>
      Action Description: <If no speech, describe visuals>
      S: <Spoken Tamil>
      T: <Tanglish>
      L: <Short Sync Version>
      ---`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: systemPrompt }, { inlineData: { mimeType: videoFile.type, data: base64Data } }] }
      });
      const rawText = response.text || "";
      const parsedScript = parseScript(rawText);
      setProcessing({ isProcessing: false, step: 0, message: '' });

      // Auto-save to history if authenticated
      if (auth.isAuthenticated && parsedScript && parsedScript.length > 0) {
        try {
          await historyAPI.save({
            videoName: videoFile.name,
            videoSize: videoFile.size,
            videoType: videoFile.type,
            format,
            script: parsedScript,
          });
        } catch (histErr) {
          console.warn('Failed to save to history:', histErr);
        }
      }
    } catch (err: any) {
      setError(err.message);
      setProcessing({ isProcessing: false, step: 0, message: '' });
    }
  };

  const parseScript = (text: string): ScriptLine[] => {
    const lines: ScriptLine[] = [];
    const entryBlocks = text.split('---');
    const clean = (val: string | undefined) => val ? val.trim().replace(/\*\*/g, '') : '';

    for (const block of entryBlocks) {
      if (!block.trim()) continue;
      const timeMatch = block.match(/\[([\d:.]+) – ([\d:.]+)\]/) || block.match(/\[([\d:.]+) - ([\d:.]+)\]/);
      if (!timeMatch) continue;
      const speakerMatch = block.match(/Speaker:\s*(.*)/i);
      const meaningMatch = block.match(/Original Meaning:\s*(.*)/i);
      const emotionMatch = block.match(/Emotion:\s*(.*)/i);
      const actionMatch = block.match(/Action Description:\s*(.*)/i);
      const sMatch = block.match(/S:\s*(.*)/i);
      const tMatch = block.match(/T:\s*(.*)/i);
      const lMatch = block.match(/L:\s*(.*)/i);

      const spoken = clean(sMatch?.[1]);
      const tanglish = clean(tMatch?.[1]);
      const syncShort = clean(lMatch?.[1]);

      lines.push({
        startTime: timeMatch[1].trim(), endTime: timeMatch[2].trim(),
        person: clean(speakerMatch?.[1]) || 'Unknown',
        emotion: clean(emotionMatch?.[1]) || 'Neutral',
        originalMeaning: clean(meaningMatch?.[1]),
        actionDescription: clean(actionMatch?.[1]),
        dialogue: spoken,
        versions: { spoken, tanglish, syncShort }
      });
    }
    if (lines.length === 0) setError(`Parsing Error: AI output didn't follow the 20+ timestamp granular format.`);
    else setScript(lines);
    return lines;
  };

  const generateImage = async () => {
    await checkAndOpenKey(); setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: imagePrompt }] },
        config: { imageConfig: { aspectRatio: imageAspectRatio as any, imageSize: imageSize as any } }
      });
      const part = response.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
      if (part?.inlineData) setImageResult(`data:image/png;base64,${part.inlineData.data}`);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const generateVideo = async (isExtension: boolean = false) => {
    await checkAndOpenKey(); setLoading(true); setError(null);
    let msgIndex = 0;
    const interval = setInterval(() => { msgIndex = (msgIndex + 1) % VEO_LOADING_MESSAGES.length; setVeoLoadingMessage(VEO_LOADING_MESSAGES[msgIndex]); }, 15000);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const styledPrompt = `${VIDEO_STYLES.find(s => s.id === videoStyle)?.prompt || ''} ${videoPrompt}`;
      let operation;
      if (isExtension && lastVideoOperation?.response?.generatedVideos?.[0]?.video) {
        operation = await ai.models.generateVideos({ model: 'veo-3.1-generate-preview', prompt: styledPrompt, video: lastVideoOperation.response.generatedVideos[0].video, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: videoAspectRatio as any } });
      } else {
        const payload: any = { model: 'veo-3.1-generate-preview', prompt: styledPrompt, config: { numberOfVideos: 1, resolution: videoResolution, aspectRatio: videoAspectRatio as any } };
        if (animatingFile) payload.image = { imageBytes: await fileToBase64(animatingFile), mimeType: animatingFile.type };
        operation = await ai.models.generateVideos(payload);
      }
      while (!operation.done) { await new Promise(r => setTimeout(r, 10000)); operation = await new GoogleGenAI({ apiKey: process.env.API_KEY }).operations.getVideosOperation({ operation }); }
      setLastVideoOperation(operation);
      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) setVideoResult(`${uri}&key=${process.env.API_KEY}`);
    } catch (err: any) { setError(err.message); }
    finally { clearInterval(interval); setLoading(false); }
  };

  const analyzeContent = async () => {
    setLoading(true);
    try {
      const parts: any[] = [{ text: analysisPrompt }];
      if (analysisFile) parts.push({ inlineData: { data: await fileToBase64(analysisFile), mimeType: analysisFile.type } });
      const response = await new GoogleGenAI({ apiKey: process.env.API_KEY }).models.generateContent({
        model: 'gemini-3-pro-preview', contents: { parts },
        config: thinkingMode ? { thinkingConfig: { thinkingBudget: 32768 } } : {}
      });
      setAnalysisResult(response.text || "");
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const startLiveTranscription = async () => {
    if (isLiveTranscribing) {
      if (liveStreamRef.current) liveStreamRef.current.getTracks().forEach(t => t.stop());
      if (liveAudioContextRef.current) liveAudioContextRef.current.close();
      setIsLiveTranscribing(false); return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      liveAudioContextRef.current = inputCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      liveStreamRef.current = stream; setIsLiveTranscribing(true); setTranscriptionResult('');
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => { sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) })); };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: (m) => {
            if (m.serverContent?.inputTranscription) { transcriptionBufferRef.current += m.serverContent.inputTranscription.text; setTranscriptionResult(transcriptionBufferRef.current); }
          },
          onerror: () => { setError('Transcription Failed.'); setIsLiveTranscribing(false); },
          onclose: () => setIsLiveTranscribing(false),
        },
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {} }
      });
    } catch (err: any) { setError(err.message); setIsLiveTranscribing(false); }
  };

  const generateTts = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts", contents: { parts: [{ text: ttsText }] },
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
      });
      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) {
        const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioCtxRef.current = ctx;
        const buf = await decodeAudioData(decode(data), ctx, 24000, 1);
        setLastTtsBuffer(buf);
        const src = setupAudioChain(ctx, buf);
        setIsPlaying(true); src.start();
      }
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const setupAudioChain = (ctx: AudioContext, buf: AudioBuffer) => {
    if (sourceRef.current) sourceRef.current.stop();
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = audioPitch; sourceRef.current = src;
    const dry = ctx.createGain(); dry.gain.value = 1.0;
    const wet = ctx.createGain(); wet.gain.value = reverbWet;
    const echo = ctx.createDelay(1.0); echo.delayTime.value = echoDelay;
    src.connect(dry); src.connect(wet); dry.connect(ctx.destination);
    src.onended = () => setIsPlaying(false); return src;
  };

  // Load a history record into the script editor
  const handleLoadFromHistory = (record: HistoryRecord) => {
    if (record.script && record.script.length > 0) {
      setScript(record.script);
      setFormat(record.format);
      setActiveTab('script');
    }
  };

  // ─── Auth Loading ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 animate-pulse">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">Loading KuralDub Pro...</p>
        </div>
      </div>
    );
  }

  // ─── Auth Gate ─────────────────────────────────────────────────────────────
  if (!auth.isAuthenticated) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // ─── Determine available tabs ──────────────────────────────────────────────
  const availableTabs: AppTab[] = ['script', 'visuals', 'analysis', 'audio', 'history'];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">KuralDub Pro</h1>
            <div className="flex gap-4 mt-1">
              {availableTabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>{tab}</button>
              ))}
              {auth.user?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin' as any)}
                  className={`text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${activeTab === ('admin' as any) ? 'text-amber-400 border-b-2 border-amber-400' : 'text-amber-500/70 hover:text-amber-400'}`}
                >
                  🛡 Admin
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white">{auth.user?.name}</p>
              <p className="text-xs text-slate-400">{auth.user?.role === 'admin' ? '🛡 Admin' : 'User'}</p>
            </div>
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {auth.user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
          <button onClick={handleLogout} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-400 transition-colors">
            Logout
          </button>
          {activeTab === 'script' && videoFile && !processing.isProcessing && (
            <button onClick={generateTamilScript} className="bg-indigo-600 px-6 py-2.5 rounded-full font-bold shadow-xl hover:bg-indigo-500 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Full Master Script
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'script' && (
          <div className="h-full flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
            <div className="w-full md:w-1/2 flex flex-col gap-4">
              <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50 flex-1 flex flex-col overflow-hidden">
                <VideoUploader ref={videoRef} videoUrl={videoUrl} onFileSelect={handleFileSelect} />
              </div>
            </div>
            <div className="w-full md:w-1/2 flex flex-col bg-slate-800/30 rounded-3xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 flex justify-between bg-slate-800/50 items-center">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold">Dubbing Console</h3>
                  {script && (
                    <button onClick={handleExport} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-all flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Official Export
                    </button>
                  )}
                </div>
                <div className="flex bg-slate-900 rounded-lg p-1">
                  <button onClick={() => setFormat('tamil')} className={`px-4 py-1 text-xs font-bold rounded-md ${format === 'tamil' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Tamil</button>
                  <button onClick={() => setFormat('tanglish')} className={`px-4 py-1 text-xs font-bold rounded-md ${format === 'tanglish' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Tanglish</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {processing.isProcessing ? <ProcessingIndicator status={processing} /> : script ? <ScriptViewer script={script} format={format} onSeek={handleSeek} /> : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 italic p-12 text-center">Drag a video into the monitor to generate an official lip-sync script.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'visuals' && (
          <div className="h-full p-6 grid md:grid-cols-2 gap-6 overflow-y-auto">
            <section className="bg-slate-800/40 rounded-3xl p-8 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-6 text-indigo-400">Visual Frame Engine</h2>
              <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Cinematic detail..." className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4 h-32" />
              <button onClick={generateImage} disabled={loading} className="w-full bg-indigo-600 py-4 rounded-2xl font-bold">Generate Frame</button>
              {imageResult && <img src={imageResult} className="mt-6 rounded-2xl border border-slate-700" />}
            </section>
            <section className="bg-slate-800/40 rounded-3xl p-8 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-6 text-purple-400">Veo Cinema Core</h2>
              <textarea value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)} placeholder="Action sequence..." className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4 h-32" />
              <div className="grid grid-cols-2 gap-4 mb-4">
                <select value={videoResolution} onChange={e => setVideoResolution(e.target.value as any)} className="bg-slate-900 border border-slate-700 rounded-xl p-2"><option value="720p">720p</option><option value="1080p">1080p</option></select>
                <select value={videoStyle} onChange={e => setVideoStyle(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl p-2">{VIDEO_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              </div>
              <button onClick={() => generateVideo(false)} disabled={loading} className="w-full bg-indigo-600 py-4 rounded-2xl font-bold mb-2">Render Clip</button>
              {videoResult && <button onClick={() => generateVideo(true)} className="w-full border border-slate-700 py-2 rounded-xl text-xs uppercase font-bold text-slate-400 hover:text-white transition-all">+7 Seconds</button>}
              {videoResult && <video src={videoResult} controls className="mt-6 rounded-2xl border border-slate-700" />}
            </section>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="h-full p-8 max-w-4xl mx-auto overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-indigo-400">Content Intelligence</h2>
            <textarea value={analysisPrompt} onChange={e => setAnalysisPrompt(e.target.value)} placeholder="Ask about content..." className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 h-40 mb-6" />
            <button onClick={analyzeContent} className="w-full bg-indigo-600 py-4 rounded-2xl font-bold">Run Deep Analysis</button>
            {analysisResult && <div className="mt-8 p-8 bg-slate-900 rounded-3xl border border-slate-700 whitespace-pre-wrap">{analysisResult}</div>}
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="h-full p-8 flex flex-col max-w-4xl mx-auto gap-8 overflow-y-auto">
            <section className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50">
              <h2 className="text-xl font-bold mb-6 text-indigo-400">Live AI Transcription</h2>
              <button onClick={startLiveTranscription} className={`w-full py-12 rounded-2xl font-black text-lg transition-all ${isLiveTranscribing ? 'bg-red-600' : 'bg-slate-800'}`}>
                {isLiveTranscribing ? 'Stop Listening' : 'Start Mic Stream'}
              </button>
              {transcriptionResult && <div className="mt-6 p-6 bg-slate-900 rounded-2xl border border-slate-700 select-all">{transcriptionResult}</div>}
            </section>
            <section className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50">
              <h2 className="text-xl font-bold mb-6 text-indigo-400">Phonetic Dub Synthesis</h2>
              <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} placeholder="Phonetic text..." className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4 h-32" />
              <button onClick={generateTts} className="w-full bg-indigo-600 py-4 rounded-2xl font-bold">Synthesize Preview</button>
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryPanel onLoadScript={handleLoadFromHistory} />
        )}

        {(activeTab as string) === 'admin' && auth.user?.role === 'admin' && (
          <AdminPanel currentUserId={auth.user.id} />
        )}
      </main>

      {error && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-12 cursor-pointer" onClick={() => setError(null)}>{error} ✕</div>}
    </div>
  );
};

export default App;