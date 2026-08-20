"use client";

import { ClipboardList, Grid2X2, Layers, Move3D, Store } from "lucide-react";

export const navigationItems = [
  { label: "Каталог", href: "/catalog", icon: Grid2X2, permission: "catalog:read" },
  { label: "Заказы", href: "/orders", icon: ClipboardList, permission: "orders:read" },
  { label: "Магазины", href: "/stores", icon: Store, permission: "stores:read" },
  { label: "Движения", href: "/movements", icon: Move3D, permission: "movements:read" },
  { label: "Склад", href: "/stocks", icon: Layers, permission: "stocks:read" },
] as const;
