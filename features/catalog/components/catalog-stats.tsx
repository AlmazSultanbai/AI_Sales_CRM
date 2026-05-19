import { Card, CardContent } from "@/components/ui/card";
import { Collection } from "@/types/domain";

export function CatalogStats({ collections }: { collections: Collection[] }) {
  const stats = {
    total: collections.length,
    material: collections.filter((item) => item.type === "material").length,
    profile: collections.filter((item) => item.type === "profile").length,
    cap: collections.filter((item) => item.type === "cap").length,
  };

  const cards = [
    { label: "Всего позиций", value: stats.total },
    { label: "Материал", value: stats.material },
    { label: "Профиль", value: stats.profile },
    { label: "Заглушка", value: stats.cap },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3">
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-1 text-2xl font-bold leading-none text-ink">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
