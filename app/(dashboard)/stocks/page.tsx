import { Suspense } from "react";
import { InventoryPage } from "@/features/inventory/components/inventory-page";

export default function StocksPage() {
  return (
    <Suspense fallback={null}>
      <InventoryPage />
    </Suspense>
  );
}
