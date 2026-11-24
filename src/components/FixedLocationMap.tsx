import { useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  ColorScheme,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { RESTAURANT_LOCATION } from '../data/menuData';

const FIXED_COORDINATES = RESTAURANT_LOCATION.coordinates;
const FIXED_ZOOM = 16;
const EMBED_MAP_URL = `https://maps.google.com/maps?q=${FIXED_COORDINATES.lat},${FIXED_COORDINATES.lng}&ll=${FIXED_COORDINATES.lat},${FIXED_COORDINATES.lng}&z=${FIXED_ZOOM}&output=embed`;

function KeylessEmbedFallback() {
  return (
    <iframe
      title={`Google Map showing ${RESTAURANT_LOCATION.shortAddress}`}
      src={EMBED_MAP_URL}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      style={{ border: 0 }}
      className="h-full w-full"
    />
  );
}

function InteractiveMapContent({ onQuotaOrAuthFailure }: { onQuotaOrAuthFailure: () => void }) {
  const status = useApiLoadingStatus();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      onQuotaOrAuthFailure();
    }
  }, [status, onQuotaOrAuthFailure]);

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return <KeylessEmbedFallback />;
  }

  return (
    <GoogleMap
      defaultCenter={FIXED_COORDINATES}
      defaultZoom={FIXED_ZOOM}
      mapId="DEMO_MAP_ID"
      colorScheme={ColorScheme.DARK}
      gestureHandling="cooperative"
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={true}
      zoomControl={true}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
    >
      <AdvancedMarker
        ref={markerRef}
        position={FIXED_COORDINATES}
        title={`Andhra Ruchulu — ${RESTAURANT_LOCATION.shortAddress}`}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <Pin
          background="#F59E0B"
          borderColor="#0B0C10"
          glyphColor="#0B0C10"
          scale={1.25}
        />
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="space-y-1.5 p-1 font-sans text-slate-900">
            <p className="text-sm font-bold tracking-tight text-slate-950">
              Andhra Ruchulu
            </p>
            <p className="text-xs leading-snug text-slate-600">
              {RESTAURANT_LOCATION.shortAddress}
            </p>
            <a
              href={RESTAURANT_LOCATION.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 pt-0.5 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline"
            >
              <span>Get Directions</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

export function FixedLocationMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldMountMap, setShouldMountMap] = useState(false);
  const [useFallbackEmbed, setUseFallbackEmbed] = useState(false);

  const rawApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapsApiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : '';
  const hasValidApiKey =
    mapsApiKey.length > 0 && mapsApiKey !== 'MY_GOOGLE_MAPS_API_KEY';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldMountMap(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMountMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setUseFallbackEmbed(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-white/12 bg-[#08090C]">
      {/* Top Coordinates & Directions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-[#94A3B8]">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Navigation className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
          <span>{RESTAURANT_LOCATION.coordinatesLabel}</span>
        </span>

        <a
          href={RESTAURANT_LOCATION.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F59E0B] transition-colors hover:bg-[#F59E0B]/20"
        >
          <MapPin className="h-3 w-3" aria-hidden="true" />
          <span>Get Directions</span>
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>

      {/* Responsive Fixed-Height Map Viewport (Prevents Layout Shift) */}
      <div
        ref={containerRef}
        className="relative h-[400px] w-full overflow-hidden bg-[#0E1016]"
      >
        {!shouldMountMap ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-[#94A3B8]">
            <MapPin className="h-6 w-6 text-[#F59E0B]" aria-hidden="true" />
            <p className="font-medium text-[#F8FAFC]">Andhra Ruchulu — Madhuravada</p>
            <p className="max-w-xs">{RESTAURANT_LOCATION.shortAddress}</p>
          </div>
        ) : hasValidApiKey && !useFallbackEmbed ? (
          <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en" region="IN">
            <InteractiveMapContent
              onQuotaOrAuthFailure={() => setUseFallbackEmbed(true)}
            />
          </APIProvider>
        ) : (
          <KeylessEmbedFallback />
        )}

        {/* Fixed Location Label Chip */}
        <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 flex items-center justify-between gap-3 sm:right-auto sm:max-w-sm">
          <div className="glass-panel pointer-events-auto flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs shadow-lg">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#F8FAFC]">
                Andhra Ruchulu · Madhuravada
              </p>
              <p className="truncate text-[11px] text-[#94A3B8]">
                {RESTAURANT_LOCATION.shortAddress}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
