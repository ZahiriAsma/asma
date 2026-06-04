import { useState, useEffect } from 'react';

/**
 * Custom hook that provides responsive breakpoint booleans.
 * Uses window.matchMedia for efficient, real-time updates.
 *
 * Breakpoints:
 *   mobile  — width ≤ 768px
 *   tablet  — 769px ≤ width ≤ 1024px
 *   desktop — width > 1024px
 */
const useMediaQuery = () => {
  const getMatches = () => {
    if (typeof window === 'undefined') {
      return { isMobile: false, isTablet: false, isDesktop: true };
    }
    const w = window.innerWidth;
    return {
      isMobile: w <= 768,
      isTablet: w > 768 && w <= 1024,
      isDesktop: w > 1024,
    };
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 768px)');
    const mqTablet = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');

    const handler = () => setMatches(getMatches());

    // Modern browsers
    if (mqMobile.addEventListener) {
      mqMobile.addEventListener('change', handler);
      mqTablet.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mqMobile.addListener(handler);
      mqTablet.addListener(handler);
    }

    // Also listen to resize for safety
    window.addEventListener('resize', handler);

    return () => {
      if (mqMobile.removeEventListener) {
        mqMobile.removeEventListener('change', handler);
        mqTablet.removeEventListener('change', handler);
      } else {
        mqMobile.removeListener(handler);
        mqTablet.removeListener(handler);
      }
      window.removeEventListener('resize', handler);
    };
  }, []);

  return matches;
};

export default useMediaQuery;
