import React from "react";
import { cn } from "@/lib/utils";

interface GaugeMeterProps {
  value: number; // 0-100
  displayValue: string | number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  backgroundColor?: string;
}

export const GaugeMeter: React.FC<GaugeMeterProps> = ({
  value,
  displayValue,
  label,
  size = 140,
  strokeWidth = 12,
  className,
  color = "#10b981",
  backgroundColor = "#f1f5f9",
}) => {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Arc configuration - 200 degrees (more than half circle for better look)
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Create the arc path (200 degrees from -100 to 100 degrees)
  const startAngle = -100;
  const endAngle = 100;
  const angleRange = endAngle - startAngle;
  
  // Calculate the progress angle
  const progressAngle = startAngle + (angleRange * clampedValue) / 100;
  
  // Convert angles to radians
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const progressRad = (progressAngle * Math.PI) / 180;
  
  // Calculate arc coordinates
  const startX = centerX + radius * Math.cos(startRad);
  const startY = centerY + radius * Math.sin(startRad);
  const endX = centerX + radius * Math.cos(endRad);
  const endY = centerY + radius * Math.sin(endRad);
  const progressX = centerX + radius * Math.cos(progressRad);
  const progressY = centerY + radius * Math.sin(progressRad);
  
  // Create SVG path for background arc
  const backgroundPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
  
  // Create SVG path for progress arc
  const progressPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${clampedValue > 50 ? 1 : 0} 1 ${progressX} ${progressY}`;
  
  // Needle coordinates
  const needleLength = radius - 15;
  const needleX = centerX + needleLength * Math.cos(progressRad);
  const needleY = centerY + needleLength * Math.sin(progressRad);

  // Scale marks
  const scaleMarks = [];
  for (let i = 0; i <= 4; i++) {
    const angle = startAngle + (angleRange * i) / 4;
    const rad = (angle * Math.PI) / 180;
    const markRadius = radius + 8;
    const markX = centerX + markRadius * Math.cos(rad);
    const markY = centerY + markRadius * Math.sin(rad);
    const innerMarkX = centerX + (markRadius - 6) * Math.cos(rad);
    const innerMarkY = centerY + (markRadius - 6) * Math.sin(rad);
    
    scaleMarks.push(
      <line
        key={i}
        x1={innerMarkX}
        y1={innerMarkY}
        x2={markX}
        y2={markY}
        stroke="#9ca3af"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }

  return (
    <div className={cn("relative", className)}>
      <svg width={size} height={size * 0.75} className="overflow-visible">
        {/* Background arc */}
        <path
          d={backgroundPath}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
        />
        
        {/* Progress arc */}
        <path
          d={progressPath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 4px ${color}40)`
          }}
        />
        
        {/* Scale marks */}
        {scaleMarks}
        
        {/* Center dot */}
        <circle
          cx={centerX}
          cy={centerY}
          r={6}
          fill={color}
          className="drop-shadow-sm"
        />
        
        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 2px 4px ${color}60)`
          }}
        />
      </svg>
      
      {/* Value display inside gauge */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ marginTop: size * 0.15 }}>
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {displayValue}
          </div>
          {label && (
            <div className="text-xs text-gray-500 mt-1 font-medium">
              {label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 