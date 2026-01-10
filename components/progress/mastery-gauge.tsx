'use client';

/**
 * MasteryGauge - Visual progress indicator
 *
 * Shows mastery percentage as a circular or linear gauge
 */

export interface MasteryGaugeProps {
  value: number; // 0-100
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  threshold?: number; // Mastery threshold (default 80)
}

export function MasteryGauge({
  value,
  label,
  size = 'md',
  showPercentage = true,
  threshold = 80,
}: MasteryGaugeProps) {
  const isMastered = value >= threshold;

  const sizeClasses = {
    sm: 'w-16 h-16 text-sm',
    md: 'w-24 h-24 text-lg',
    lg: 'w-32 h-32 text-2xl',
  };

  // Calculate stroke dasharray for SVG circle
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${sizeClasses[size]}`}>
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={isMastered ? 'text-green-500' : 'text-primary'}
          />
        </svg>
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center font-bold">
            {Math.round(value)}%
          </div>
        )}
      </div>
      {label && (
        <span className="mt-2 text-sm text-muted-foreground">{label}</span>
      )}
      {isMastered && (
        <span className="mt-1 text-xs text-green-500 font-medium">
          Mastered!
        </span>
      )}
    </div>
  );
}

export default MasteryGauge;
