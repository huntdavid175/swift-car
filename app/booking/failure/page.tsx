'use client';

import { useRouter } from 'next/navigation';

export default function BookingFailurePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Payment Cancelled</h1>
        <p className="text-gray-600 mb-6">
          Your payment was not completed. No charges were made to your account.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-[#667eea] text-white rounded-xl font-semibold hover:bg-[#5568d3] transition-all"
          >
            Return to Home
          </button>
          <button
            onClick={() => router.back()}
            className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
