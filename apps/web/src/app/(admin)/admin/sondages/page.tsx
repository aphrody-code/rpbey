"use client";

import { AdminAwardsEditions } from "@/components/polls/AdminAwardsEditions";
import { AdminPollsManager } from "@/components/polls/AdminPollsManager";

export default function AdminSondagesPage() {
  return (
    <>
      <AdminPollsManager />
      <AdminAwardsEditions />
    </>
  );
}
