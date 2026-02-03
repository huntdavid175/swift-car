import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      car_id,
      pickup_date,
      return_date,
      full_name,
      phone_number,
      email,
      pickup_location,
      days,
      daily_rate,
      total_amount,
      sessionId,
    } = body;

    // Validate required fields
    if (!car_id || !pickup_date || !return_date || !full_name || !phone_number || !pickup_location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find or create user
    let userId: number;
    
    // Use sessionId as whatsapp_id, or phone_number as fallback
    const whatsappId = sessionId || phone_number;
    
    // First try to find by whatsapp_id
    const { data: existingUserByWhatsapp, error: lookupErrorByWhatsapp } = await supabase
      .from('users')
      .select('id')
      .eq('whatsapp_id', whatsappId)
      .maybeSingle();

    if (existingUserByWhatsapp) {
      userId = existingUserByWhatsapp.id;
      // Update user info if provided
      if (full_name || email || phone_number) {
        await supabase
          .from('users')
          .update({
            name: full_name || undefined,
            email: email || undefined,
            phone: phone_number || undefined,
          })
          .eq('id', userId);
      }
    } else {
      // Try to find by phone number as fallback
      const { data: existingUserByPhone, error: lookupErrorByPhone } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone_number)
        .maybeSingle();

      if (existingUserByPhone) {
        userId = existingUserByPhone.id;
        // Update user info including whatsapp_id
        await supabase
          .from('users')
          .update({
            name: full_name || undefined,
            email: email || undefined,
            whatsapp_id: whatsappId,
          })
          .eq('id', userId);
      } else {
        // Create new user with whatsapp_id
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            whatsapp_id: whatsappId,
            phone: phone_number,
            name: full_name,
            email: email || null,
          })
          .select('id')
          .single();

        if (userError) {
          console.error('User creation error:', userError);
          // If user already exists (unique constraint violation), try to fetch it
          if (userError.code === '23505' || userError.message?.includes('duplicate')) {
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('whatsapp_id', whatsappId)
              .maybeSingle();
            
            if (existingUser) {
              userId = existingUser.id;
            } else {
              return NextResponse.json(
                { error: `Failed to create user: ${userError.message}` },
                { status: 500 }
              );
            }
          } else {
            return NextResponse.json(
              { error: `Failed to create user: ${userError.message}` },
              { status: 500 }
            );
          }
        } else if (!newUser) {
          return NextResponse.json(
            { error: 'Failed to create user: No user data returned' },
            { status: 500 }
          );
        } else {
          userId = newUser.id;
        }
      }
    }

    // Get car ID from database
    const { data: carData } = await supabase
      .from('cars')
      .select('id')
      .eq('car_id', car_id)
      .single();

    if (!carData) {
      return NextResponse.json(
        { error: 'Car not found' },
        { status: 404 }
      );
    }

    // Generate order ID
    const orderId = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Generate payment reference
    const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        order_id: orderId,
        user_id: userId,
        car_id: carData.id,
        pickup_date: pickup_date,
        return_date: return_date,
        pickup_location: pickup_location,
        days: days,
        daily_rate: daily_rate,
        total_amount: total_amount,
        deposit_amount: total_amount,
        balance_amount: 0,
        status: 'paid',
        payment_status: 'paid',
        payment_reference: paymentReference,
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error('Booking error:', bookingError);
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    // Create payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      order_id: orderId,
      payment_reference: paymentReference,
      amount: total_amount,
      currency: 'GHS',
      status: 'success',
      provider: 'manual',
      provider_reference: paymentReference,
      paid_at: new Date().toISOString(),
      metadata: {
        sessionId: sessionId || null,
      },
    });

    if (paymentError) {
      console.error('Payment error:', paymentError);
      // Don't fail if payment record creation fails, booking is already created
    }

    // Update session if sessionId exists
    if (sessionId) {
      await supabase
        .from('sessions')
        .update({
          session_state: 'BOOKED',
          session_data: {
            booking_completed: true,
            payment_reference: paymentReference,
            order_id: orderId,
            booking_id: booking.id,
          },
          last_message_at: new Date().toISOString(),
        })
        .eq('whatsapp_id', sessionId);
    }

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      order_id: orderId,
      payment_reference: paymentReference,
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
