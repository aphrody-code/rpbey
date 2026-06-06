"use client";

import nextDynamic from "next/dynamic";

const AdminPartsPage = nextDynamic(() => import("./AdminPartsPage"), {
  ssr: false,
});

export default function PartsClientWrapper() {
  return <AdminPartsPage />;
}
