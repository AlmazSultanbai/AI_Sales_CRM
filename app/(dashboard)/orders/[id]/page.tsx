import { OrderDetailsPage } from "@/features/orders/components/order-details-page";

export default async function OrderDetailsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailsPage orderId={id} />;
}
