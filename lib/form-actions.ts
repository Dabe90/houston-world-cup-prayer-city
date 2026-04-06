"use server";

import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export async function submitForm(formData: FormData) {
  const email = formData.get('email') as string;
  const name = formData.get('name') as string || '';

  // This sends the magic link email (creates the user automatically)
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Uses the NEXT_PUBLIC_SITE_URL you just added in Vercel
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    },
  });

  if (error) {
    console.error('Magic link error:', error.message);
    redirect('/?error=failed');   // sends user back to home if something goes wrong
  }

  // Success - go to success page
  redirect(`/success?email=${encodeURIComponent(email)}`);
}