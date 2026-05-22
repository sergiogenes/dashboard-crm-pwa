'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Permitimos el registro en producción O si estamos en un entorno de tests
      const isProd = process.env.NODE_ENV === 'production';
      const isTest = process.env.NEXT_PUBLIC_TEST_ENV === 'true';

      if (isProd || isTest) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('✅ Service Worker registrado con éxito: ', registration.scope);
          })
          .catch((err) => {
            console.error('❌ Fallo al registrar el Service Worker: ', err);
          });
      }
    }
  }, []);

  return null;
}
