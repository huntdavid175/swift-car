import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/database';
import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);

    // Handle different event types
    if (event.event === 'charge.success') {
      const { reference, amount, customer, metadata } = event.data;

      // Get sessionId from metadata (Paystack sends metadata as an object)
      const sessionId = metadata?.sessionId || metadata?.custom_fields?.find((field: any) => field.variable_name === 'sessionId')?.value;

      // Find booking by payment reference
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('order_id')
        .eq('payment_reference', reference)
        .single();

      if (paymentError || !payment) {
        console.error('Payment not found:', paymentError);
        // Payment might not exist yet, try to find by order_id in metadata or create it
        // This can happen if webhook arrives before the success page creates the records
        return NextResponse.json({ received: true });
      }

      // Update payment status
      const { error: updatePaymentError } = await supabase
        .from('payments')
        .update({
          status: 'success',
          paid_at: new Date().toISOString(),
        })
        .eq('payment_reference', reference);

      if (updatePaymentError) {
        console.error('Error updating payment:', updatePaymentError);
      }

      // Update booking status
      const { error: updateBookingError } = await supabase
        .from('bookings')
        .update({
          status: 'paid',
          payment_status: 'paid',
        })
        .eq('order_id', payment.order_id);

      if (updateBookingError) {
        console.error('Error updating booking:', updateBookingError);
      }

      // Update session if sessionId exists
      if (sessionId) {
        const { error: sessionError } = await supabase
          .from('sessions')
          .update({
            session_data: {
              booking_completed: true,
              payment_reference: reference,
              order_id: payment.order_id,
            },
            last_message_at: new Date().toISOString(),
          })
          .eq('whatsapp_id', sessionId);

        if (sessionError) {
          console.error('Error updating session:', sessionError);
        }
      }

      console.log('Payment webhook processed successfully:', reference);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
