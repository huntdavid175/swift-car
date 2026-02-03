'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/database';

export default function BookingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const orderId = searchParams.get('orderId');
  
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<any>(null);
  const [telegramSent, setTelegramSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookingAndSendTelegram = async () => {
      if (!bookingId) {
        setError('No booking ID found');
        setLoading(false);
        return;
      }

      try {
        // Fetch booking details
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            users (name, phone, email),
            cars (name, car_id, category, daily_rate)
          `)
          .eq('id', bookingId)
          .single();

        if (bookingError || !booking) {
          throw new Error('Booking not found');
        }

        setBookingData(booking);

        // Get sessionId from localStorage
        const sessionId = localStorage.getItem('sessionId');

        // Update session state to BOOKED if sessionId exists
        if (sessionId) {
          await supabase
            .from('sessions')
            .update({
              session_state: 'BOOKED',
              session_data: {
                booking_completed: true,
                order_id: booking.order_id,
                booking_id: booking.id,
              },
              last_message_at: new Date().toISOString(),
            })
            .eq('whatsapp_id', sessionId);
        }

        // Format message for Telegram
        const message = `
🎉 <b>New Booking Confirmed!</b>

📋 <b>Order ID:</b> ${booking.order_id}
🚗 <b>Car:</b> ${booking.cars.name} (${booking.cars.category})
👤 <b>Customer:</b> ${booking.users.name}
📞 <b>Phone:</b> ${booking.users.phone}
📧 <b>Email:</b> ${booking.users.email || 'N/A'}

📅 <b>Pickup Date:</b> ${new Date(booking.pickup_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
📅 <b>Return Date:</b> ${new Date(booking.return_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
📍 <b>Pickup Location:</b> ${booking.pickup_location}
⏱️ <b>Duration:</b> ${booking.days} ${booking.days === 1 ? 'day' : 'days'}

💰 <b>Total Amount:</b> GHS ${parseFloat(booking.total_amount).toFixed(2)}
💳 <b>Payment Status:</b> ${booking.payment_status}
${sessionId ? `\n🔗 <b>Session ID:</b> ${sessionId}` : ''}
        `.trim();

        // Send to Telegram
        const telegramResponse = await fetch('/api/telegram/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
          }),
        });

        const telegramData = await telegramResponse.json();

        if (telegramResponse.ok) {
          setTelegramSent(true);
        } else {
          console.error('Failed to send Telegram message:', telegramData);
          // Don't fail the page if Telegram fails
        }
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingAndSendTelegram();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-5"></div>
          <p className="text-xl">Processing your booking...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-[#667eea] text-white rounded-xl font-semibold hover:bg-[#5568d3] transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600">Your booking has been successfully created</p>
            {telegramSent && (
              <p className="text-sm text-green-600 mt-2">✓ Notification sent to Telegram</p>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Booking Details</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-semibold">{bookingData.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Car:</span>
                <span className="font-semibold">{bookingData.cars.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-semibold">{bookingData.users.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold">{bookingData.users.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pickup Date:</span>
                <span className="font-semibold">
                  {new Date(bookingData.pickup_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Return Date:</span>
                <span className="font-semibold">
                  {new Date(bookingData.return_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-semibold">
                  {bookingData.days} {bookingData.days === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pickup Location:</span>
                <span className="font-semibold">{bookingData.pickup_location}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl p-6 mb-6 text-white">
            <h3 className="text-xl font-bold mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Daily Rate × {bookingData.days} {bookingData.days === 1 ? 'day' : 'days'}</span>
                <span>GHS {parseFloat(bookingData.daily_rate).toFixed(2)}</span>
              </div>
              <div className="border-t border-white/30 pt-3 mt-3">
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total Amount</span>
                  <span>GHS {parseFloat(bookingData.total_amount).toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/30">
                <div className="flex justify-between">
                  <span>Payment Status:</span>
                  <span className="font-semibold">Paid</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">What's Next?</h2>
            <ul className="space-y-2 text-gray-700">
              <li>• You will receive a confirmation message shortly</li>
              <li>• Our team will contact you to confirm pickup details</li>
              <li>• Please arrive at the pickup location on your selected date</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-all"
            >
              Return to Home
            </button>
            <a
              href={`https://t.me/swift_rental_bot?text=Payment%20made%20for%20Order%20${encodeURIComponent(bookingData.order_id)}.%20Please%20confirm%20payment.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-6 py-3 bg-[#0088cc] text-white rounded-xl font-semibold hover:bg-[#0077b5] transition-all text-center flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Confirm Payment on Telegram
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
