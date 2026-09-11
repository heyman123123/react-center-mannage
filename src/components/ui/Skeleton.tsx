import React from "react";
import { cn } from "../../lib/utils";

/**
 * shadcn 风格骨架屏组件
 * 背景使用 --skeleton-base 变量，自带 pulse 动画，可通过 className 自定义宽高圆角
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
