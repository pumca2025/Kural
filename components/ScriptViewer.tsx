
import React from 'react';
import { ScriptLine, ScriptFormat } from '../types';

interface ScriptViewerProps {
  script: ScriptLine[];
  format: ScriptFormat;
  onSeek?: (time: string) => void;
}

const ScriptViewer: React.FC<ScriptViewerProps> = ({ script, format, onSeek }) => {
  return (
    <div className="p-6 space-y-8">
      {script.map((line, index) => (
        <div
          key={index}
          className="group animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-900/40 border border-slate-700/50 p-6 rounded-3xl hover:border-indigo-500/50 transition-all shadow-xl"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase bg-indigo-400/10 px-3 py-1 rounded-full border border-indigo-400/20">
                {line.person}
              </span>
              <button
                onClick={() => onSeek?.(line.startTime)}
                className="text-[10px] font-mono font-bold text-slate-500 hover:text-white px-3 py-1 rounded-full bg-slate-800/50 transition-all border border-slate-800"
              >
                {line.startTime} — {line.endTime}
              </button>
            </div>

            {line.emotion && (
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                Emotion: {line.emotion}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {line.originalMeaning && (
              <div className="text-[10px] font-bold text-slate-500 italic mb-1">
                Original: {line.originalMeaning}
              </div>
            )}

            {line.actionDescription && (
              <div className="bg-slate-800/30 border border-slate-700/50 p-3 rounded-xl italic text-slate-400 text-sm">
                [ {line.actionDescription} ]
              </div>
            )}

            {(line.versions.spoken || line.versions.tanglish || line.versions.syncShort) && (
              <div className="space-y-4">
                <div className="relative pl-4 border-l-2 border-indigo-500/30">
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tamil Lip-Sync</div>
                  <p className="text-xl leading-relaxed tamil-font text-white selection:bg-indigo-500/30">
                    {line.versions.spoken}
                  </p>
                </div>

                <div className="relative pl-4 border-l-2 border-purple-500/30">
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tanglish (Phonetic)</div>
                  <p className="text-sm italic text-slate-300 font-medium selection:bg-purple-500/30">
                    {line.versions.tanglish}
                  </p>
                </div>

                <div className="relative pl-4 border-l-2 border-emerald-500/30">
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Kollywood Short Cut</div>
                  <p className="text-base text-emerald-100 font-bold tamil-font selection:bg-emerald-500/30">
                    {line.versions.syncShort}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {script.length > 0 && (
        <div className="pt-10 text-center flex flex-col items-center gap-2 opacity-30">
          <div className="w-10 h-[1px] bg-slate-500"></div>
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-slate-400">Master Script Complete</div>
        </div>
      )}
    </div>
  );
};

export default ScriptViewer;
