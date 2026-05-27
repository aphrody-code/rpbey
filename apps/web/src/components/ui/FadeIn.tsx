'use client';

import {
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import { type ReactNode } from 'react';

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  fullWidth = false,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  fullWidth?: boolean;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0,
      x: direction === 'left' ? 20 : direction === 'right' ? -20 : 0,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94], // Ease Out Quad
      },
    },
  };

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial="hidden"
        animate="visible"
        variants={variants}
        className={className}
        style={{ width: fullWidth ? '100%' : 'auto' }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

export function FadeInStagger({
  children,
  faster = false,
  className,
}: {
  children: ReactNode;
  faster?: boolean;
  className?: string;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: faster ? 0.05 : 0.1,
            },
          },
        }}
        className={className}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

export function ScaleOnHover({
  children,
  scale = 1.02,
  className,
}: {
  children: ReactNode;
  scale?: number;
  className?: string;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        whileHover={{ scale }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={className}
        style={{ height: '100%' }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
