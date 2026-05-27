import { Google_Sans_Flex } from 'next/font/google';

export const googleSansFlex = Google_Sans_Flex({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-google-sans-flex',
  axes: ['opsz'],
});

export const fontFamily =
  'var(--font-google-sans-flex), system-ui, Roboto, Helvetica, Arial, sans-serif';
