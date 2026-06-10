import { Box, Typography } from "@mui/material";
import { headers } from "next/headers";
import { getStaffMembers } from "@/server/services/cms";
import { TeamClientContent } from "./TeamClientContent";

export const metadata = {
  title: "Notre Équipe | RPB",
  description: "Découvrez les passionnés qui font vivre la République Populaire du Beyblade.",
};

const TEAM_LABELS: Record<string, string> = {
  ADMIN: "Administration",
  RH: "Ressources Humaines",
  MODO: "Modération",
  ARBITRE: "Arbitrage",
  STAFF: "Staff",
  DEV: "Développement",
  EVENT: "Événementiel",
  MEDIA: "Média / Design",
};

const TEAM_ORDER = ["ADMIN", "RH", "MODO", "ARBITRE", "STAFF", "DEV", "EVENT", "MEDIA"];

export default async function TeamPage() {
  await headers();
  const members = await getStaffMembers();

  if (members.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 20 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: "bold",
          }}
        >
          Notre Équipe
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: "text.secondary",
          }}
        >
          L'équipe est en cours de formation... Revenez bientôt !
        </Typography>
      </Box>
    );
  }

  // Group members by ROLE
  const groupedMembers = members.reduce(
    (acc, member) => {
      // Ensure role is a string key
      const roleKey = member.role || "STAFF";
      if (!acc[roleKey]) {
        acc[roleKey] = [];
      }
      acc[roleKey]?.push(member);
      return acc;
    },
    {} as Record<string, typeof members>,
  );

  return (
    <TeamClientContent
      groupedMembers={groupedMembers}
      teamLabels={TEAM_LABELS}
      teamOrder={TEAM_ORDER}
    />
  );
}
