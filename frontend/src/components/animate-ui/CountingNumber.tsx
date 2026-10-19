import React, { useEffect, useRef } from "react";
import { useMotionValue, useSpring } from "motion/react";

interface CountingNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function CountingNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: CountingNumberProps) {
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, {
    damping: 24,
    stiffness: 90,
  });

  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    const unsubscribe = springVal.on("change", (latest) => {
      if (spanRef.current) {
        const formatted = decimals > 0 
          ? latest.toFixed(decimals) 
          : Math.round(latest).toLocaleString();
        spanRef.current.textContent = `${prefix}${formatted}${suffix}`;
      }
    });
    return () => unsubscribe();
  }, [springVal, decimals, prefix, suffix]);

  return (
    <span ref={spanRef} className={className}>
      {prefix}{decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()}{suffix}
    </span>
  );
}
