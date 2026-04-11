'use client';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

export default function ErrorMessage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  if (!error) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md flex items-center gap-2 text-sm border border-red-100">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <p>
        {error === 'OAuthCallback' && 'There was a problem signing in with Google. Please try again.'}
        {error === 'AccessDenied' && 'Access was denied. Please make sure you have the right permissions.'}
        {error !== 'OAuthCallback' && error !== 'AccessDenied' && `Authentication error: ${error}`}
      </p>
    </div>
  );
}