import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  hoverEffect?: boolean;
}

export function AnimatedCard({
  children,
  delay = 0,
  className = "",
  hoverEffect = true,
  ...props
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      whileHover={
        hoverEffect
          ? {
              y: -3,
              transition: { duration: 0.2, ease: "easeOut" },
            }
          : undefined
      }
      className={`relative ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
