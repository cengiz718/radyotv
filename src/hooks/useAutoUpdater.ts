import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { SystemStatusResponse } from '../types.ts';

interface UseAutoUpdaterOptions {
  onCatalogUpdated?: (status: SystemStatusResponse) => void;
}

export function useAutoUpdater({ onCatalogUpdated }: UseAutoUpdaterOptions = {}) {
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [updateBanner, setUpdateBanner] = useState<string | null>(null);
  const knownCatalogVersionRef = useRef<string | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        swRegistrationRef.current = registration;
      }
    },
  });

  // Automatically check Service Worker updates every 10 minutes & on tab resume
  useEffect(() => {
    const checkSw = () => {
      if (document.visibilityState === 'visible') {
        swRegistrationRef.current?.update().catch(() => {});
      }
    };
    const interval = window.setInterval(checkSw, 1000 * 60 * 10);
    document.addEventListener('visibilitychange', checkSw);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkSw);
    };
  }, []);

  // Poll server catalog version periodically so channel updates propagate automatically
  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status');
      if (!res.ok) return null;
      const data = (await res.json()) as SystemStatusResponse;
      setSystemStatus(data);

      if (
        knownCatalogVersionRef.current &&
        data.catalogVersion !== knownCatalogVersionRef.current
      ) {
        onCatalogUpdated?.(data);
      }
      knownCatalogVersionRef.current = data.catalogVersion;
      return data;
    } catch {
      return null;
    }
  }, [onCatalogUpdated]);

  useEffect(() => {
    fetchSystemStatus();
    const timer = window.setInterval(fetchSystemStatus, 1000 * 60 * 15);
    return () => window.clearInterval(timer);
  }, [fetchSystemStatus]);

  const checkAndUpdateNow = useCallback(async () => {
    setChecking(true);
    try {
      await swRegistrationRef.current?.update().catch(() => {});
      if (needRefresh) {
        await updateServiceWorker(true);
        return;
      }
      const res = await fetch('/api/system/refresh', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as SystemStatusResponse;
        setSystemStatus(data);
        knownCatalogVersionRef.current = data.catalogVersion;
        onCatalogUpdated?.(data);
        setUpdateBanner(
          `Güncellendi · ${data.radioCount.toLocaleString('tr-TR')} Türkçe radyo · ${data.tvCount} TV`,
        );
        window.setTimeout(() => setUpdateBanner(null), 4500);
      }
    } catch {
      setUpdateBanner('Güncelleme kontrol edilemedi.');
      window.setTimeout(() => setUpdateBanner(null), 3500);
    } finally {
      setChecking(false);
    }
  }, [needRefresh, onCatalogUpdated, updateServiceWorker]);

  return {
    needRefresh,
    checking,
    systemStatus,
    updateBanner,
    applyAppUpdate: () => updateServiceWorker(true),
    checkAndUpdateNow,
  };
}
