import { useEffect, useState } from "react"

const ASPECT_RATIO = '11/9';
const makeMql = () => window.matchMedia(`(max-aspect-ratio: ${ASPECT_RATIO})`);

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(makeMql().matches);

  useEffect(() => {
    const mql = makeMql();
    
    const onChange = () => {
      setIsMobile(mql.matches);
    }
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
