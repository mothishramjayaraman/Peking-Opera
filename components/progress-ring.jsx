"use client";

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  className = "",
  showLabel = true,
  labelClassName = "",
  strokeColor = null,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={strokeColor ? "transition-all duration-500 ease-out" : "stroke-primary transition-all duration-500 ease-out"}
          stroke={strokeColor || undefined}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      {showLabel && (
        <span className={`absolute text-sm font-semibold ${labelClassName}`}>
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
}
