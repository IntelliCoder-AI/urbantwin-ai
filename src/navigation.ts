import { useEffect, useState } from 'react';
export const VIEW_PATHS = ['/', '/control-center', '/lab', '/insights', '/methodology'];
export function useViewRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const tab = VIEW_PATHS.indexOf(path.replace(/\/$/, '') || '/');
  const navigate = (index: number) => {
    const next = VIEW_PATHS[index];
    if (window.location.pathname !== next) window.history.pushState(null, '', next);
    setPath(next);
  };
  return [tab, navigate] as const;
}
