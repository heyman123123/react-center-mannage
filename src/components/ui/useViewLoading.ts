import { useEffect, useState } from "react";

/**
 * 数据视图统一加载态：进入时返回 true，模拟 600-900ms 后变为 false
 * 用于驱动骨架屏到真实数据的过渡
 */
export function useViewLoading(min = 600, max = 900) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, min + Math.random() * (max - min));
    return () => clearTimeout(timer);
  }, []);
  return loading;
}
