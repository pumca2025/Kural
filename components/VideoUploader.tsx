
import React, { useRef, forwardRef, useImperativeHandle } from 'react';

interface VideoUploaderProps {
  videoUrl: string | null;
  onFileSelect: (file: File) => void;
}

const VideoUploader = forwardRef<HTMLVideoElement, VideoUploaderProps>(({ videoUrl, onFileSelect }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);

  // Expose the internal video ref to the parent
  useImperativeHandle(ref, () => internalVideoRef.current as HTMLVideoElement);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div 
      className={`flex-1 flex flex-col ${!videoUrl ? 'cursor-pointer hover:border-indigo-500/50 hover:bg-slate-800/60' : ''} transition-all border-2 border-dashed ${videoUrl ? 'border-transparent' : 'border-slate-700'} rounded-xl overflow-hidden`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => !videoUrl && fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="video/*" 
        onChange={handleFileChange}
      />

      {videoUrl ? (
        <div className="relative w-full h-full flex items-center justify-center bg-black group">
          <video 
            ref={internalVideoRef}
            src={videoUrl} 
            controls 
            playsInline
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
          <button 
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full shadow-lg backdrop-blur-sm border border-slate-700 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Change Video"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <p className="text-lg font-medium text-slate-200 mb-2">Drag and drop your video file</p>
          <p className="text-sm">Supports high-capacity MP4, WebM, MOV (Up to 4GB)</p>
          <button className="mt-6 bg-slate-800 text-slate-200 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-750 transition-colors">
            Browse High-Res Files
          </button>
        </div>
      )}
    </div>
  );
});

export default VideoUploader;
