import { useEffect, useRef } from 'react';
import { useAnyProjectBusy } from '@/hooks/useAnyProjectBusy';

/**
 * Component that dynamically updates the favicon when any project is busy with AI
 * Rotates the favicon counter-clockwise when busy
 */
export function DynamicFavicon() {
  const isBusy = useAnyProjectBusy();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const rotationRef = useRef(0);
  const originalFaviconRef = useRef<string | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // Initialize canvas and save original favicon
  useEffect(() => {
    // Create canvas element for drawing the favicon
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 32;
      canvasRef.current.height = 32;
    }

    // Store the original favicon URL
    const faviconElement = document.querySelector('link[rel="icon"]');
    if (faviconElement && !originalFaviconRef.current) {
      originalFaviconRef.current = faviconElement.getAttribute('href');
    }

    // Preload the favicon image
    if (!originalImageRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = originalFaviconRef.current || '/shakespeare.png';
      img.onload = () => {
        originalImageRef.current = img;
      };
    }

    return () => {
      // Restore original favicon on unmount
      if (originalFaviconRef.current) {
        const faviconElement = document.querySelector('link[rel="icon"]');
        if (faviconElement) {
          faviconElement.setAttribute('href', originalFaviconRef.current);
        }
      }

      // Cancel any ongoing animation
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Handle busy state changes
  useEffect(() => {
    if (!canvasRef.current) return;

    // If busy, start rotation animation
    if (isBusy) {
      const startRotationAnimation = () => {
        if (!canvasRef.current || !originalImageRef.current) {
          // If image isn't loaded yet, try again in a moment
          setTimeout(startRotationAnimation, 100);
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = originalImageRef.current;

        const animate = () => {
          if (!ctx || !canvas) return;

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Save context state
          ctx.save();

          // Translate to center for rotation
          ctx.translate(canvas.width / 2, canvas.height / 2);

          // Rotate counter-clockwise
          ctx.rotate(-rotationRef.current);

          // Draw the image centered
          ctx.drawImage(
            img,
            -canvas.width / 2,
            -canvas.height / 2,
            canvas.width,
            canvas.height
          );

          // Restore context state
          ctx.restore();

          // Update rotation for next frame (slower rotation)
          rotationRef.current += 0.05;

          // Update favicon
          const faviconElement = document.querySelector('link[rel="icon"]');
          if (faviconElement) {
            faviconElement.setAttribute('href', canvas.toDataURL('image/png'));
          }

          // Continue animation
          animationRef.current = requestAnimationFrame(animate);
        };

        // Start animation loop
        animate();
      };

      startRotationAnimation();
    } else {
      // If not busy, restore original favicon and stop animation
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Reset rotation
      rotationRef.current = 0;

      // Restore original favicon
      if (originalFaviconRef.current) {
        const faviconElement = document.querySelector('link[rel="icon"]');
        if (faviconElement) {
          faviconElement.setAttribute('href', originalFaviconRef.current);
        }
      }
    }

    return () => {
      // Cancel animation on effect cleanup
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isBusy]);

  // This component doesn't render anything visible
  return null;
}
