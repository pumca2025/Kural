
import React from 'react';
import { ProcessingState } from '../types';

interface ProcessingIndicatorProps {
  status: ProcessingState;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ status }) => {
  const steps = [
    'Submitting Video',
    'Extracting Audio & Meaning',
    'Analyzing Lip Movement',
    'Detecting Scene Emotions',
    'Crafting Tamil Script'
  ];

  const currentStepIndex = Math.min(status.step, steps.length - 1);

  return (
    <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-900/50">
      <div className="mb-8 relative">
        <div className="w-24 h-24 border-4 border-slate-800 rounded-full"></div>
        <div className="w-24 h-24 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute top-0"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-indigo-400 font-bold text-xl">{Math.round((status.step / 5) * 100)}%</span>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-2">Analyzing Performance...</h3>
      <p className="text-slate-400 text-sm max-w-xs mb-8">{status.message}</p>

      <div className="w-full max-w-xs space-y-3">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full transition-all duration-500 ${idx < status.step ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : idx === status.step ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}></div>
            <span className={`text-xs font-medium transition-colors duration-500 ${idx <= status.step ? 'text-slate-200' : 'text-slate-600'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProcessingIndicator;
