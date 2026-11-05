import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Layers,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Table as TableIcon,
  Map as MapIcon,
  Wifi,
  WifiOff,
  Settings,
  Info,
  ExternalLink,
} from 'lucide-react';
import { SituationLocationRecord, SituationLocationsResponse, cmrgApi } from '../lib/cmrgApi.ts';

interface SituationMapProps {
  initialFormId?: string;
  activeEnumeratorId?: string;
}

export const SituationMap: React.FC<SituationMapProps> = ({
  initialFormId = 'all',
  activeEnumeratorId = 'all',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // States
  const [data, setData] = useState<SituationLocationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Filters
  const [selectedFormId, setSelectedFormId] = useState<string>(initialFormId);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');

  // Tile configuration
  const [showTileConfig, setShowTileConfig] = useState<boolean>(false);
  const [tileUrl, setTileUrl] = useState<string>(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  );
  const [tileAttribution, setTileAttribution] = useState<string>(
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  );

  // Active selected record for drawer
  const [selectedRecord, setSelectedRecord] = useState<SituationLocationRecord | null>(null);

  // Fetch real situation locations from CMRG API
  const fetchLocations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await cmrgApi.getSituationLocations({
        formId: selectedFormId !== 'all' ? selectedFormId : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        enumeratorId: activeEnumeratorId !== 'all' ? activeEnumeratorId : undefined,
      });
      setData(response);
      setLastUpdated(response.serverTime);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to CMRG situation geospatial service.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [selectedFormId, selectedStatus, activeEnumeratorId]);

  // Filter records by date range client-side if needed
  const filteredRecords = useMemo(() => {
    if (!data?.records) return [];
    if (dateRange === 'all') return data.records;

    const now = new Date();
    return data.records.filter((r) => {
      const recordDate = new Date(r.createdAt);
      if (dateRange === 'today') {
        return (
          recordDate.getDate() === now.getDate() &&
          recordDate.getMonth() === now.getMonth() &&
          recordDate.getFullYear() === now.getFullYear()
        );
      }
      if (dateRange === '7d') {
        const diffDays = (now.getTime() - recordDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      return true;
    });
  }, [data, dateRange]);

  const recordsWithGps = useMemo(
    () => filteredRecords.filter((r) => r.hasCoordinates && r.latitude !== null && r.longitude !== null),
    [filteredRecords]
  );

  const recordsWithoutGps = useMemo(
    () => filteredRecords.filter((r) => !r.hasCoordinates || r.latitude === null || r.longitude === null),
    [filteredRecords]
  );

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    // Create map instance if it doesn't exist
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [5.6037, -0.187], // Default West Africa / Ghana center
        zoom: 6,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    // Clear previous markers
    markersGroup.clearLayers();

    // Add markers for records with valid GPS coordinates
    const bounds: [number, number][] = [];

    recordsWithGps.forEach((record) => {
      if (record.latitude === null || record.longitude === null) return;

      const lat = record.latitude;
      const lng = record.longitude;
      bounds.push([lat, lng]);

      // Status color style: CMRG red/black/white theme
      let pinColor = '#ef4444'; // Red for flagged
      let badgeLabel = 'FLAGGED';
      if (record.status === 'synced') {
        pinColor = '#10b981'; // Emerald for synced
        badgeLabel = 'SYNCED';
      } else if (record.status === 'submitted') {
        pinColor = '#f59e0b'; // Amber for submitted
        badgeLabel = 'SUBMITTED';
      }

      // Custom CMRG Leaflet DivIcon
      const customIcon = L.divIcon({
        className: 'cmrg-leaflet-marker',
        html: `
          <div style="position: relative; width: 30px; height: 30px; cursor: pointer;">
            <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: ${pinColor}; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 30px; height: 30px; border-radius: 9999px; background-color: #0f172a; border: 2.5px solid ${pinColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <div style="width: 10px; height: 10px; border-radius: 9999px; background-color: ${pinColor};"></div>
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Sanitized, non-sensitive popup (Strictly no respondent PII, answers, or media)
      const popupContent = `
        <div style="font-family: inherit; font-size: 12px; color: #f8fafc; min-width: 200px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
            <span style="font-weight: 800; font-size: 10px; letter-spacing: 0.05em; color: ${pinColor}; text-transform: uppercase;">
              ${badgeLabel}
            </span>
            <span style="font-size: 10px; color: #94a3b8; font-family: monospace;">${record.deviceId}</span>
          </div>
          <div style="font-weight: 700; color: #ffffff; margin-bottom: 4px; font-size: 12px; line-height: 1.3;">
            ${record.formTitle}
          </div>
          <div style="color: #cbd5e1; font-size: 11px; margin-bottom: 2px;">
            Surveyor: <strong>${record.enumeratorName}</strong>
          </div>
          <div style="color: #94a3b8; font-size: 10px; margin-bottom: 6px;">
            Recorded: ${new Date(record.createdAt).toLocaleString()}
          </div>
          <div style="background-color: #1e293b; padding: 4px 6px; border-radius: 4px; font-size: 10px; font-family: monospace; color: #38bdf8;">
            GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${record.accuracy ? record.accuracy.toFixed(1) : '5.0'}m)
          </div>
          <div style="margin-top: 6px; font-size: 9px; color: #64748b; font-style: italic;">
            Respondent PII & private answers redacted for GIS safety.
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'cmrg-leaflet-popup',
      });

      marker.on('click', () => {
        setSelectedRecord(record);
      });

      markersGroup.addLayer(marker);
    });

    // Auto-fit bounds if we have points
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    // Force map to re-evaluate container size
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [viewMode, recordsWithGps, tileUrl, tileAttribution]);

  // Clean up Leaflet on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Situation Toolbar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                CMRG Field Situation Map
              </h2>
              <span className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-2 py-0.5 rounded-full">
                Leaflet GIS
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Authorized server submission locations &bull; Real submitted GPS coordinates
            </p>
          </div>
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Map vs Accessible Table View */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'map'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Accessible Table</span>
            </button>
          </div>

          {/* Tile Config Toggle */}
          <button
            onClick={() => setShowTileConfig(!showTileConfig)}
            title="Configure Tile Provider"
            className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
              showTileConfig
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchLocations}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-red-500' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Tile Provider Config Drawer */}
      {showTileConfig && (
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 text-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-400" />
              Leaflet Tile Provider & Network Settings
            </span>
            <button
              onClick={() => setShowTileConfig(false)}
              className="text-slate-400 hover:text-white font-bold"
            >
              &times; Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Tile URL Template</label>
              <input
                type="text"
                value={tileUrl}
                onChange={(e) => setTileUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-[11px] outline-none focus:border-red-500"
                placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Must comply with tile provider usage policy. Requires online internet connection.
              </span>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Attribution Notice</label>
              <input
                type="text"
                value={tileAttribution}
                onChange={(e) => setTileAttribution(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-[11px] outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold">Filters:</span>
          </div>

          {/* Form Filter */}
          <select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs outline-none focus:border-red-500"
          >
            <option value="all">All Questionnaires</option>
            <option value="cmrg_consumer_brand_audit_2026">Consumer Brand Audit 2026</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs outline-none focus:border-red-500"
          >
            <option value="all">All Statuses</option>
            <option value="synced">Synced (Confirmed)</option>
            <option value="submitted">Submitted (Pending QA)</option>
            <option value="flagged">Flagged (Speed/Geofence)</option>
          </select>

          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs outline-none focus:border-red-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today Only</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>

        {/* Server Sync / Status Stats */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span>Server Data</span>
          </div>
          {lastUpdated && (
            <div className="hidden sm:inline">
              Updated: {new Date(lastUpdated).toLocaleTimeString()}
            </div>
          )}
          <div className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-white font-bold">
            {recordsWithGps.length} Mapped / {recordsWithoutGps.length} No GPS
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="p-3 bg-red-950/80 border-b border-red-800 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchLocations}
            className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded font-bold transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden min-h-[420px]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">
              Connecting to CMRG GIS Location Server...
            </span>
          </div>
        )}

        {/* Map View */}
        {viewMode === 'map' && (
          <div className="flex-1 relative flex flex-col">
            {/* Empty State */}
            {!isLoading && filteredRecords.length === 0 && !error && (
              <div className="absolute inset-0 z-20 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
                <MapPin className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-base font-bold text-white mb-1">No Server Submissions Found</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  No interview submissions match the selected filter criteria. Try adjusting the questionnaire or status filter.
                </p>
              </div>
            )}

            {/* Leaflet Map Div */}
            <div ref={mapContainerRef} className="w-full h-full min-h-[380px] z-10" />

            {/* Network Note in bottom-left */}
            <div className="absolute bottom-2 left-2 z-20 bg-slate-950/90 border border-slate-800 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-slate-400 flex items-center gap-2 pointer-events-none">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>Online Leaflet Tiles &bull; OpenStreetMap Data</span>
            </div>
          </div>
        )}

        {/* Accessible Table View */}
        {viewMode === 'table' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Questionnaire / Form</th>
                    <th className="p-3">Field Officer</th>
                    <th className="p-3">GPS Location</th>
                    <th className="p-3">Recorded Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-sans">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                        No submissions available for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRecord(r)}
                        className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              r.status === 'synced'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : r.status === 'flagged'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-white">{r.formTitle}</td>
                        <td className="p-3 text-slate-400">
                          {r.enumeratorName} ({r.deviceId})
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {r.hasCoordinates ? (
                            <span className="text-emerald-400">
                              {r.latitude?.toFixed(4)}, {r.longitude?.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No GPS Captured</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Side Panel: No-Location Records List (Fulfills explicit requirement) */}
        <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0 max-h-96 md:max-h-none overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Unmapped Records ({recordsWithoutGps.length})
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">No GPS</span>
          </div>

          <div className="p-2 text-[11px] text-slate-400 bg-slate-900/40 border-b border-slate-800">
            Records received without valid GPS coordinates. Listed here without placing markers to maintain GIS accuracy.
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {recordsWithoutGps.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                All filtered records contain valid GPS coordinates.
              </div>
            ) : (
              recordsWithoutGps.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white truncate max-w-[170px]">
                      {record.formTitle}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {record.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Officer: {record.enumeratorName} &bull; {record.deviceId}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{new Date(record.createdAt).toLocaleTimeString()}</span>
                    <span className="text-amber-400">GPS Unavailable</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Privacy & Consent Guidance Note */}
          <div className="p-3 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Shield className="w-3 h-3 text-red-500" />
              <span>Surveyor Privacy & Consent</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              GPS coordinates are recorded strictly upon surveyor opt-in and informed questionnaire consent. Personal answers and identities are never shown on situation displays.
            </p>
          </div>
        </div>
      </div>

      {/* Selected Record Detail Modal / Bar */}
      {selectedRecord && (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{selectedRecord.formTitle}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-800 text-slate-300 font-mono">
                {selectedRecord.status}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Enumerator: <strong>{selectedRecord.enumeratorName}</strong> &bull; Device:{' '}
              {selectedRecord.deviceId} &bull; Synced:{' '}
              {new Date(selectedRecord.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedRecord.hasCoordinates ? (
              <span className="font-mono text-emerald-400 text-[11px]">
                Lat: {selectedRecord.latitude?.toFixed(5)}, Lng: {selectedRecord.longitude?.toFixed(5)}
              </span>
            ) : (
              <span className="text-amber-400 text-[11px] italic">No GPS coordinates recorded</span>
            )}
            <button
              onClick={() => setSelectedRecord(null)}
              className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 text-[11px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
