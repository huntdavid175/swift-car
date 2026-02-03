'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/database';

interface Car {
  car_id: string;
  name: string;
  category: string;
  daily_rate: number;
  seats: number;
  transmission: string;
  fuel_type: string;
  image_url: string;
  features: string[];
}

interface BookingData {
  car: Car | null;
  pickupDate: string;
  returnDate: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  pickupLocation: string;
}

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const carId = searchParams.get('carId');

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<BookingData>({
    car: null,
    pickupDate: '',
    returnDate: '',
    fullName: '',
    phoneNumber: '',
    email: '',
    pickupLocation: '',
  });
  const [processingPayment, setProcessingPayment] = useState(false);

  const [locations] = useState(['Airport', 'Osu', 'Tema', 'Accra Central', 'East Legon']);

  // Fetch car details
  useEffect(() => {
    const fetchCar = async () => {
      if (!carId) {
        router.push('/');
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('cars')
          .select('*')
          .eq('car_id', carId)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          throw new Error('Car not found');
        }

        // Transform car data
        let imageUrl = data.image_url?.trim() || '';
        if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          const parts = imageUrl.split('/');
          if (parts.length >= 2) {
            const bucket = parts[0];
            const path = parts.slice(1).join('/');
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
            imageUrl = urlData.publicUrl;
          }
        }
        if (!imageUrl || imageUrl === '') {
          imageUrl = 'https://via.placeholder.com/400x200?text=Car+Image';
        }

        const car: Car = {
          car_id: data.car_id,
          name: data.name,
          category: data.category || '',
          daily_rate: Number(data.daily_rate),
          seats: data.seats || 0,
          transmission: data.transmission || '',
          fuel_type: data.fuel_type || '',
          image_url: imageUrl,
          features: data.features || [],
        };

        setBookingData(prev => ({ ...prev, car }));
      } catch (error) {
        console.error('Error fetching car:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchCar();
  }, [carId, router]);

  // Calculate booking details
  const calculateBookingDetails = () => {
    if (!bookingData.pickupDate || !bookingData.returnDate || !bookingData.car) {
      return null;
    }

    const pickup = new Date(bookingData.pickupDate);
    const returnDate = new Date(bookingData.returnDate);
    const diffTime = Math.abs(returnDate.getTime() - pickup.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const dailyRate = bookingData.car.daily_rate;
    const totalAmount = diffDays * dailyRate;

    return {
      days: diffDays,
      dailyRate,
      totalAmount,
    };
  };

  const bookingDetails = calculateBookingDetails();

  // Validation
  const canProceedToStep2 = () => {
    return bookingData.pickupDate && bookingData.returnDate && 
           new Date(bookingData.returnDate) > new Date(bookingData.pickupDate);
  };

  const canProceedToStep3 = () => {
    return bookingData.fullName.trim() && 
           bookingData.phoneNumber.trim() && 
           bookingData.email.trim() &&
           bookingData.pickupLocation;
  };

  const handleNext = () => {
    if (currentStep === 1 && canProceedToStep2()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canProceedToStep3()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.push('/');
    }
  };

  const handleSubmit = async () => {
    if (!bookingData.car || !bookingDetails) {
      alert('Please complete all booking details');
      return;
    }

    setProcessingPayment(true);

    try {
      // Get sessionId from localStorage
      const sessionId = localStorage.getItem('sessionId');

      // Create booking and payment (simulated payment)
      const response = await fetch('/api/booking/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          car_id: bookingData.car.car_id,
          pickup_date: bookingData.pickupDate,
          return_date: bookingData.returnDate,
          full_name: bookingData.fullName,
          phone_number: bookingData.phoneNumber,
          email: bookingData.email,
          pickup_location: bookingData.pickupLocation,
          days: bookingDetails.days,
          daily_rate: bookingDetails.dailyRate,
          total_amount: bookingDetails.totalAmount,
          sessionId: sessionId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }

      // Redirect to success page with booking ID
      router.push(`/booking/success?bookingId=${data.booking_id}&orderId=${data.order_id}`);
    } catch (error) {
      console.error('Booking creation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to create booking. Please try again.');
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-5"></div>
          <p className="text-xl">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!bookingData.car) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                      currentStep >= step
                        ? 'bg-white text-[#667eea]'
                        : 'bg-white/30 text-white'
                    }`}
                  >
                    {currentStep > step ? '✓' : step}
                  </div>
                  <div className="mt-2 text-white text-sm font-medium text-center">
                    {step === 1 && 'Dates'}
                    {step === 2 && 'Details'}
                    {step === 3 && 'Summary'}
                  </div>
                </div>
                {step < 3 && (
                  <div
                    className={`h-1 flex-1 mx-2 transition-all ${
                      currentStep > step ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Date Selection */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Select Your Dates</h2>
            <p className="text-gray-600 mb-6">Choose your pickup and return dates</p>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pickup Date
                </label>
                <input
                  type="date"
                  value={bookingData.pickupDate}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    setBookingData(prev => {
                      // Auto-adjust return date if it's before pickup
                      let returnDate = prev.returnDate;
                      if (returnDate && new Date(returnDate) <= new Date(selectedDate)) {
                        const nextDay = new Date(selectedDate);
                        nextDay.setDate(nextDay.getDate() + 1);
                        returnDate = nextDay.toISOString().split('T')[0];
                      }
                      return { ...prev, pickupDate: selectedDate, returnDate };
                    });
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#667eea] text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Return Date
                </label>
                <input
                  type="date"
                  value={bookingData.returnDate}
                  onChange={(e) => setBookingData(prev => ({ ...prev, returnDate: e.target.value }))}
                  min={bookingData.pickupDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#667eea] text-lg"
                />
              </div>
            </div>

            {bookingDetails && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Rental Duration:</span>
                  <span className="text-xl font-bold text-[#667eea]">
                    {bookingDetails.days} {bookingDetails.days === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Customer Information */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Your Information</h2>
            <p className="text-gray-600 mb-6">Please provide your contact details</p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={bookingData.fullName}
                  onChange={(e) => setBookingData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#667eea] text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={bookingData.phoneNumber}
                  onChange={(e) => setBookingData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="e.g., 233241234567"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#667eea] text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={bookingData.email}
                  onChange={(e) => setBookingData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#667eea] text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pickup Location
                </label>
                <select
                  value={bookingData.pickupLocation}
                  onChange={(e) => setBookingData(prev => ({ ...prev, pickupLocation: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#667eea] text-lg"
                >
                  <option value="">Select a location</option>
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Booking Summary */}
        {currentStep === 3 && bookingDetails && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Booking Summary</h2>
            <p className="text-gray-600 mb-6">Review your booking details before proceeding</p>

            {/* Car Details */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex gap-6">
                <img
                  src={bookingData.car.image_url}
                  alt={bookingData.car.name}
                  className="w-32 h-24 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{bookingData.car.name}</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-3 py-1 bg-[#667eea] text-white rounded-full text-sm">
                      {bookingData.car.category}
                    </span>
                    <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                      {bookingData.car.seats} seats
                    </span>
                    <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                      {bookingData.car.transmission}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div className="space-y-4 mb-6">
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Pickup Date</span>
                <span className="font-semibold text-gray-800">
                  {new Date(bookingData.pickupDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Return Date</span>
                <span className="font-semibold text-gray-800">
                  {new Date(bookingData.returnDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Duration</span>
                <span className="font-semibold text-gray-800">
                  {bookingDetails.days} {bookingDetails.days === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Pickup Location</span>
                <span className="font-semibold text-gray-800">{bookingData.pickupLocation}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Customer Name</span>
                <span className="font-semibold text-gray-800">{bookingData.fullName}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Phone Number</span>
                <span className="font-semibold text-gray-800">{bookingData.phoneNumber}</span>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl p-6 text-white mb-6">
              <h3 className="text-xl font-bold mb-4">Price Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Daily Rate × {bookingDetails.days} {bookingDetails.days === 1 ? 'day' : 'days'}</span>
                  <span>GHS {bookingData.car.daily_rate.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/30 pt-3 mt-3">
                  <div className="flex justify-between text-2xl font-bold">
                    <span>Total Amount</span>
                    <span>GHS {bookingDetails.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={handleBack}
            className="px-8 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-all"
          >
            {currentStep === 1 ? 'Back to Cars' : 'Previous'}
          </button>

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 1 && !canProceedToStep2()) ||
                (currentStep === 2 && !canProceedToStep3())
              }
              className="px-8 py-3 bg-white hover:bg-gray-100 text-[#667eea] rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={processingPayment}
              className="px-8 py-3 bg-white hover:bg-gray-100 text-[#667eea] rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {processingPayment ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#667eea] border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
