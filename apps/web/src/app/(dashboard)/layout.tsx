import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireBusinessGate } from "@/components/business/RequireBusinessGate";
import { DashboardDeferredGates } from "@/components/dashboard/DashboardDeferredGates";
import { BusinessVocabularyProvider } from "@/contexts/business-vocabulary-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <BusinessVocabularyProvider>
        <RequireBusinessGate>{children}</RequireBusinessGate>
        <DashboardDeferredGates />
      </BusinessVocabularyProvider>
    </RequireAuth>
  );
}
