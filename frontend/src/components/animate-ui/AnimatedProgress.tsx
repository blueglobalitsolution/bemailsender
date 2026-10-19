import React from "react";
import { motion } from "motion/react";

interface AnimatedProgressProps {
  value: number; // 0 to 100
  className?: string;
  barClassName?: string;
}

export function AnimatedProgress({
  value,
  className = "w-full bg-[#222930] h-1.5 rounded-full overflow-hidden",
  barClassName = "bg-white",
}: AnimatedProgressProps) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div className={className}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1], // Custom smooth easeOut
        }}
        className={`h-full ${barClassName}`}
      />
    </div>
  );
}
