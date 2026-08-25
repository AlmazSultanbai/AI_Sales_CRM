"use client";

import { BarChart3, ClipboardList, Layers, Users } from "lucide-react";

export const navigationItems = [
  { label: "Склад", href: "/stocks", icon: Layers, permission: "stocks:read" },
  { label: "Заказы", href: "/orders", icon: ClipboardList, permission: "orders:read" },
  { label: "Клиенты", href: "/stores", icon: Users, permission: "stores:read" },
  { label: "Отчёты", href: "/movements", icon: BarChart3, permission: "movements:read" },
] as const;
