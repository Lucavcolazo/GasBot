import type { CSSProperties } from "react";

interface Props {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = "", style }: Props) {
  return <div className={`animate-pulse bg-white/10 ${className}`} style={style} />;
}
