import React from 'react';
import { ShieldCheck, Shield, AlertTriangle } from 'lucide-react';

export function bandColor(score: number) {
  if (score >= 90) return { bg: 'bg-teal-100', text: 'text-teal-800', ring: 'ring-teal-500', hex: '#0D9488' };
  if (score >= 75) return { bg: 'bg-teal-50', text: 'text-teal-700', ring: 'ring-teal-400', hex: '#14B8A6' };
  if (score >= 60) return { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-400', hex: '#D97706' };
  if (score >= 40) return { bg: 'bg-orange-50', text: 'text-orange-800', ring: 'ring-orange-400', hex: '#EA580C' };
  return { bg: 'bg-red-50', text: 'text-red-800', ring: 'ring-red-400', hex: '#DC2626' };
}

export function bandLabel(score: number) {
  if (score >= 90) return 'Very High';
  if (score >= 75) return 'High';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Low';
  return 'High Risk';
}

interface Props { score: number; size?: 'sm' | 'md' | 'lg'; confidence?: number; }

export default function ScoreBadge({ score, size = 'md', confidence }: Props) {
  const c = bandColor(score);
  const dims = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'sm' ? 'w-10 h-10 text-sm' : 'w-14 h-14 text-lg';
  const Icon = score >= 75 ? ShieldCheck : score >= 60 ? Shield : AlertTriangle;
  return (
    <div className="flex flex-col items-center gap-1" data-testid="score-badge">
      <div className={`${dims} ${c.bg} ${c.text} rounded-full flex items-center justify-center font-poppins font-bold ring-2 ${c.ring}`}>
        {score}
      </div>
      <div className={`flex items-center gap-1 text-xs font-semibold ${c.text}`}>
        <Icon className="w-3 h-3" /> {bandLabel(score)}
      </div>
      {confidence !== undefined && (
        <div className="text-[10px] uppercase tracking-widest text-slate-400">
          {Math.round(confidence * 100)}% confidence
        </div>
      )}
    </div>
  );
}
