import React from 'react';
import { MobileBottomNav } from './MobileBottomNav';

export const MobileShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isStandalone =
    typeof window !== 'undefined' &&
    ((window.navigator as Navigator & { standalone?: boolean }).standalone ||
      window.matchMedia('(display-mode: standalone)').matches);

  return (
    <div
      className="bg-bg text-white flex flex-col overflow-hidden"
      style={{ height: isStandalone ? '100vh' : '100dvh' }}
    >
      <main
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 0 }}
        className="flex-1 min-h-0 w-full flex flex-col overflow-hidden"
      >
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
};
