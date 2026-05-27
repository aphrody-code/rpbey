import { redirect } from 'next/navigation';

export default function SignUpPage() {
  // Redirect to sign-in since we only use Discord OAuth
  redirect('/sign-in');
}
