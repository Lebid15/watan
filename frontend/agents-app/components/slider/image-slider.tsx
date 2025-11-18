"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const slides = [
  { id: 1, image: "/images/slide1.jpg" },
  { id: 2, image: "/images/slide2.jpg" },
];

export function ImageSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000); // تغيير كل 4 ثواني

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-32 sm:h-40 md:h-56 lg:h-64 rounded-xl overflow-hidden shadow-lg">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            currentSlide === index ? "opacity-100" : "opacity-0"
          )}
        >
          <Image
            src={slide.image}
            alt={`Slide ${slide.id}`}
            fill
            className="object-cover rounded-xl"
            priority={index === 0}
          />
        </div>
      ))}

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              currentSlide === index
                ? "bg-gold w-6"
                : "bg-white/50 hover:bg-white/80"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
