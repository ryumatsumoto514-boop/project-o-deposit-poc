"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { wagmiConfig } from "@/lib/wagmiConfig";
import { FlowProvider } from "./flow-context";
import { CaptureKolRef } from "./components/CaptureKolRef";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <FlowProvider>
          <Suspense fallback={null}>
            <CaptureKolRef />
          </Suspense>
          {children}
        </FlowProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
