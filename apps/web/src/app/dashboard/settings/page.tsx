import { Box } from "@mui/material";
import { AccountSettings } from "@/components/dashboard/settings/AccountSettings";

export const metadata = {
  title: "Paramètres du compte | Dashboard",
  description: "Gère ton e-mail, ton mot de passe, l'A2F et tes appareils connectés.",
};

export default function SettingsPage() {
  return (
    <Box sx={{ py: 2 }}>
      <AccountSettings />
    </Box>
  );
}
