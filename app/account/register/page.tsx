'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountRegisterRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?tab=register');
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-xs text-neutral-400">
      Redirecting to AL-HAMD Customer Registration...
    </div>
  );
}
