import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

/**
 * Pixel-perfect ReachEngine Architectural Isometric 'R' Logomark (Exact Concept A)
 */
export const ReachEngineLogoMark: React.FC<LogoProps> = ({
  className = "",
  size = 28,
  alt = "ReachEngine Logomark",
}) => {
  return (
    <img
      src="/reachengine_mark.png"
      alt={alt}
      width={size}
      height={size}
      className={`object-contain select-none shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
};

export const ReachEngineLogo: React.FC<{
  size?: number;
  textSize?: string;
  className?: string;
}> = ({ size = 26, textSize = "text-xl", className = "" }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ReachEngineLogoMark size={size} />
      <span className={`font-bold text-white tracking-tight ${textSize}`}>
        Reach<span className="font-semibold text-[#CBD5E1]">Engine</span>
      </span>
    </div>
  );
};

export default ReachEngineLogo;
