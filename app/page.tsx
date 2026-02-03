'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  available: boolean;
}

interface CarFromDB {
  id: number;
  car_id: string;
  name: string;
  category: string;
  daily_rate: number;
  seats: number;
  transmission: string;
  fuel_type: string;
  image_url: string | null;
  features: string[] | null;
  status: string;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [cars, setCars] = useState<Car[]>([]);
  const [filteredCars, setFilteredCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [transmissionFilter, setTransmissionFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Capture and save sessionId from URL
  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
      console.log('Session ID saved:', sessionId);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchCars = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch active cars from Supabase
        const { data, error: fetchError } = await supabase
          .from('cars')
          .select('*')
          .eq('status', 'active')
          .order('daily_rate', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        if (data) {
          // Helper function to check if URL is a valid image URL
          const isValidImageUrl = (url: string): boolean => {
            if (!url) return false;
            
            // Check if it's a data URL (base64 image)
            if (url.startsWith('data:image/')) return true;
            
            // Check if it ends with common image extensions
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
            const lowerUrl = url.toLowerCase();
            
            // Check if URL ends with image extension or contains image extension before query params
            const hasImageExtension = imageExtensions.some(ext => {
              const index = lowerUrl.indexOf(ext);
              if (index === -1) return false;
              // Check if it's at the end or followed by ? or #
              const afterExt = lowerUrl.substring(index + ext.length);
              return afterExt === '' || afterExt.startsWith('?') || afterExt.startsWith('#');
            });
            
            // Also check for common image CDN patterns (like Unsplash, Cloudinary, etc.)
            const imageCdnPatterns = [
              'unsplash.com',
              'cloudinary.com',
              'imgur.com',
              'i.imgur.com',
              'images.unsplash.com',
              'res.cloudinary.com'
            ];
            const isImageCdn = imageCdnPatterns.some(pattern => url.includes(pattern));
            
            return hasImageExtension || isImageCdn;
          };

          // Transform database data to Car interface
          const transformedCars: Car[] = data.map((car: CarFromDB) => {
            // Handle image URL - trim whitespace and ensure it's a valid URL
            let imageUrl = car.image_url?.trim() || '';
            
            if (!imageUrl || imageUrl === '') {
              imageUrl = 'https://via.placeholder.com/400x200?text=Car+Image';
            } else {
              // If it's a Supabase Storage path (doesn't start with http), get public URL
              if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                // Extract bucket and path from storage path (format: bucket-name/path/to/file.jpg)
                const parts = imageUrl.split('/');
                if (parts.length >= 2) {
                  const bucket = parts[0];
                  const path = parts.slice(1).join('/');
                  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
                  imageUrl = urlData.publicUrl;
                }
              }
              
              // Validate that it's actually an image URL, not a webpage
              if (!isValidImageUrl(imageUrl)) {
                console.warn(`Invalid image URL for ${car.name}: ${imageUrl}. Using placeholder.`);
                imageUrl = 'https://via.placeholder.com/400x200?text=Car+Image';
              }
            }
            
            // Log for debugging
            console.log(`Car: ${car.name}, Image URL: ${imageUrl}`);
            
            return {
              car_id: car.car_id,
              name: car.name,
              category: car.category || '',
              daily_rate: Number(car.daily_rate),
              seats: car.seats || 0,
              transmission: car.transmission || '',
              fuel_type: car.fuel_type || '',
              image_url: imageUrl,
              features: car.features || [],
              available: true // For now, all active cars are available. Can add booking check later.
            };
          });

          console.log('Fetched cars:', transformedCars);
          setCars(transformedCars);
          setFilteredCars(transformedCars);
        }
      } catch (err) {
        console.error('Error fetching cars:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cars');
        // Fallback to empty array on error
        setCars([]);
        setFilteredCars([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCars();
  }, []);

  useEffect(() => {
    // Apply filters whenever filters change
    let filtered = cars.filter(car => {
      if (categoryFilter && car.category !== categoryFilter) return false;
      if (transmissionFilter && car.transmission !== transmissionFilter) return false;
      if (maxPrice && car.daily_rate > parseFloat(maxPrice)) return false;
      return true;
    });

    setFilteredCars(filtered);
  }, [cars, categoryFilter, transmissionFilter, maxPrice]);

  const selectCar = (car: Car) => {
    if (!car.available) {
      alert('This car is not available for the selected dates.');
      return;
    }

    // Navigate to booking page with car ID
    window.location.href = `/booking?carId=${car.car_id}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] py-5 px-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center text-white mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">🚗 Choose Your Car</h1>
          <p className="text-xl opacity-90">Select from our premium fleet</p>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-xl p-5 mb-8 shadow-lg">
          <div className="flex flex-wrap gap-4">
            <select
              id="categoryFilter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-[#667eea]"
            >
              <option value="">All Categories</option>
              <option value="Economy">Economy</option>
              <option value="SUV">SUV</option>
              <option value="Luxury">Luxury</option>
              <option value="Van">Van</option>
            </select>

            <select
              id="transmissionFilter"
              value={transmissionFilter}
              onChange={(e) => setTransmissionFilter(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-[#667eea]"
            >
              <option value="">All Transmission</option>
              <option value="Auto">Automatic</option>
              <option value="Manual">Manual</option>
            </select>

            <input
              type="number"
              id="maxPrice"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max Price per Day (GHS)"
              className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-[#667eea]"
            />
          </div>
        </div>

        {/* Cars Grid */}
        {loading ? (
          <div className="text-center py-16 text-white">
            <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-5"></div>
            <p className="text-xl">Loading available cars...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl text-red-600">
            <h2 className="text-2xl font-bold mb-3">Error loading cars</h2>
            <p>{error}</p>
            <p className="text-sm text-gray-500 mt-2">Please try refreshing the page.</p>
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl text-gray-600">
            <h2 className="text-2xl font-bold mb-3">No cars available</h2>
            <p>Please try adjusting your filters or check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {filteredCars.map((car) => (
              <div
                key={car.car_id}
                onClick={() => selectCar(car)}
                className={`bg-white rounded-2xl overflow-hidden shadow-lg transition-all duration-300 cursor-pointer ${
                  car.available
                    ? 'hover:-translate-y-2 hover:shadow-2xl'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="relative">
                  <img
                    src={car.image_url}
                    alt={car.name}
                    className="w-full h-48 object-cover bg-gray-100"
                    loading="lazy"
                    onError={(e) => {
                      console.error(`Failed to load image for ${car.name}: ${car.image_url}`);
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Car+Image';
                    }}
                    onLoad={() => {
                      console.log(`Successfully loaded image for ${car.name}`);
                    }}
                  />
                  <span
                    className={`absolute top-3 right-3 px-4 py-1 rounded-full text-sm font-bold text-white ${
                      car.available ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    {car.available ? '✓ Available' : '✗ Booked'}
                  </span>
                </div>

                <div className="p-5">
                  <span className="inline-block bg-[#667eea] text-white px-4 py-1 rounded-full text-xs mb-3">
                    {car.category}
                  </span>
                  <div className="text-2xl font-bold mb-3 text-gray-800">{car.name}</div>

                  <div className="flex gap-4 my-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <span>👥</span>
                      <span>{car.seats} seats</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>⚙️</span>
                      <span>{car.transmission}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>⛽</span>
                      <span>{car.fuel_type}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 my-4">
                    {car.features.map((feature, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 px-3 py-1 rounded text-xs text-gray-600"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-5 pt-5 border-t-2 border-gray-100">
                    <div>
                      <div className="text-3xl font-bold text-[#667eea]">GHS {car.daily_rate}</div>
                      <div className="text-xs text-gray-500">per day</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCar(car);
                      }}
                      disabled={!car.available}
                      className={`px-6 py-3 rounded-full font-bold text-white transition-colors ${
                        car.available
                          ? 'bg-[#667eea] hover:bg-[#5568d3]'
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {car.available ? 'Select' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
          <div className="text-center text-white">
            <div className="inline-block w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-5"></div>
            <p className="text-xl">Loading...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
