import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DebtsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Долги</h1>
        <p className="mt-2 text-sm text-muted">Мониторинг долгов, дата последней отгрузки и статус оплаты.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сводка задолженности</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Модуль готов к подключению таблицы `debts` и аналитики по просрочкам.
        </CardContent>
      </Card>
    </section>
  );
}
