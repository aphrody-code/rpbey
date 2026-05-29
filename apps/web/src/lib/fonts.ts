import { Google_Sans_Flex } from "next/font/google";

export const googleSansFlex = Google_Sans_Flex({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-google-sans-flex",
  axes: ["opsz"],
  // `Google Sans Flex` absent de la table de précalcul CLS de next/font → le
  // fallback auto échoue (warning build) et serait mal calibré. On le désactive :
  // `display:swap` gère déjà le FOUT, sans fallback CSS mal dimensionné.
  adjustFontFallback: false,
});

export const fontFamily =
  "var(--font-google-sans-flex), system-ui, Roboto, Helvetica, Arial, sans-serif";
