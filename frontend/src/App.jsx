import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API = "http://127.0.0.1:8000";
const REFRESH_MS = 60_000;

const RISK_COLORS = {
  CRITICAL: "#ff4f5e",
  HIGH: "#ff9b4a",
  MEDIUM: "#f3cf55",
  LOW: "#39d98a",
};

const CLASS_OPTIONS = [
  ["ALL", "All classifications"],
  ["industrial_fire", "Industrial fire"],
  ["natural_fire", "Natural fire"],
  ["agricultural_burning", "Agricultural burning"],
  ["persistent_thermal_source", "Persistent thermal source"],
  ["uncertain", "Uncertain"],
];

function pretty(value) {
  if (!value) return "Unknown";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function number(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Number(value).toFixed(digits);
}

function riskColor(level) {
  return RISK_COLORS[String(level || "LOW").toUpperCase()] || RISK_COLORS.LOW;
}

function MapController({ selected }) {
  const map = useMap();

  useEffect(() => {
    if (!selected) {
      map.setView([22.5, 79], 5.1, { animate: false });
      return;
    }
    const [lon, lat] = selected.geometry.coordinates;
    map.flyTo([lat, lon], 7.4, { duration: 0.7 });
  }, [map, selected]);

  return null;
}

function ThermalMarker({ event, selected, onClick }) {
  const p = event.properties;
  const [lon, lat] = event.geometry.coordinates;
  const color = riskColor(p.risk_level);
  const risk = Number(p.risk_score || 0);
  const frp = Number(p.frp || 0);
  const radius = Math.max(5, Math.min(12, 5 + risk / 30 + frp / 45));

  return (
    <>
      <CircleMarker
        center={[lat, lon]}
        radius={radius * 2.7}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: selected ? 0.14 : 0.035,
          opacity: selected ? 0.7 : 0.16,
          weight: 1,
        }}
        eventHandlers={{ click: onClick }}
      />
      <CircleMarker
        center={[lat, lon]}
        radius={selected ? radius + 3 : radius}
        pathOptions={{
          color: selected ? "#ffffff" : color,
          fillColor: color,
          fillOpacity: 0.95,
          opacity: 1,
          weight: selected ? 2 : 1,
        }}
        eventHandlers={{ click: onClick }}
      />
    </>
  );
}

function Icon({ name, size = 16 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.9-4" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 4" /><path d="M20 20v-4h-4" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    crosshair: <><circle cx="12" cy="12" r="5" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 16 9 5 9-5" /></>,
    pulse: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function App() {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  async function fetchEvents() {
    try {
      const response = await fetch(`${API}/events/geojson`);
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      setEvents(data.features || []);
      setLastSync(new Date());
      setApiError("");
    } catch (error) {
      setApiError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    const timer = setInterval(fetchEvents, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector("#signal-search")?.focus();
      }
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const stats = useMemo(() => {
    const result = { total: events.length, critical: 0, high: 0, medium: 0, low: 0, uncertain: 0, classified: 0, maxFrp: 0, riskTotal: 0 };
    for (const event of events) {
      const p = event.properties;
      const level = String(p.risk_level || "LOW").toLowerCase();
      if (level in result) result[level] += 1;
      if (p.classification_status === "UNCERTAIN") result.uncertain += 1;
      else result.classified += 1;
      result.maxFrp = Math.max(result.maxFrp, Number(p.frp || 0));
      result.riskTotal += Number(p.risk_score || 0);
    }
    result.avgRisk = events.length ? result.riskTotal / events.length : 0;
    return result;
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      const p = event.properties;
      const classValue = p.predicted_class || p.model_predicted_class || "uncertain";
      const riskMatch = riskFilter === "ALL" || p.risk_level === riskFilter;
      const classMatch = classFilter === "ALL" || classValue === classFilter;
      if (!q) return riskMatch && classMatch;
      const [lon, lat] = event.geometry.coordinates;
      const text = [classValue, p.landcover_name, p.risk_level, p.satellite, p.instrument, lat, lon].join(" ").toLowerCase();
      return riskMatch && classMatch && text.includes(q);
    });
  }, [events, query, riskFilter, classFilter]);

  const priority = useMemo(() => [...filtered].sort((a, b) => Number(b.properties.risk_score || 0) - Number(a.properties.risk_score || 0)).slice(0, 8), [filtered]);

  const classCounts = useMemo(() => {
    const counts = {};
    for (const event of events) {
      const key = event.properties.predicted_class || "uncertain";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [events]);

  const reset = () => {
    setRiskFilter("ALL");
    setClassFilter("ALL");
    setQuery("");
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="brand">
          <div className="brand-mark"><span /></div>
          <div>
            <div className="brand-name">GEOFLARE</div>
            <div className="brand-sub">AI-POWERED GEOSPATIAL THERMAL INTELLIGENCE</div>
          </div>
        </div>

        <div className="header-center">
          <div className="live-indicator"><span /> LIVE MONITORING</div>
          <div className="source-label">NASA FIRMS / VIIRS NOAA-20</div>
        </div>

        <div className="header-actions">
          <div className="sync-label">
            <span>LAST SYNC</span>
            <strong>{lastSync ? lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</strong>
          </div>
          <button className="refresh-button" onClick={fetchEvents} disabled={loading} title="Refresh events"><Icon name="refresh" /></button>
        </div>
      </header>

      <main className="layout">
        <aside className="left-panel panel">
          <div className="panel-heading">
            <div><span className="eyebrow">MONITOR</span><h1>India Sector</h1></div>
            <span className={`status-dot ${apiError ? "offline" : ""}`} />
          </div>

          <section className="overview-block">
            <div className="total-row"><span>Active thermal events</span><strong>{stats.total}</strong></div>
            <div className="overview-grid">
              <Stat label="Critical" value={stats.critical} tone="CRITICAL" />
              <Stat label="High" value={stats.high} tone="HIGH" />
              <Stat label="Medium" value={stats.medium} tone="MEDIUM" />
              <Stat label="Low" value={stats.low} tone="LOW" />
            </div>
          </section>

          <section className="section">
            <div className="section-title"><span>Threat distribution</span><span>{stats.total ? `${Math.round((stats.classified / stats.total) * 100)}% classified` : "0% classified"}</span></div>
            <div className="distribution-bar">
              {[["CRITICAL", stats.critical], ["HIGH", stats.high], ["MEDIUM", stats.medium], ["LOW", stats.low]].map(([level, value]) => (
                <span key={level} style={{ width: `${stats.total ? (value / stats.total) * 100 : 0}%`, background: riskColor(level) }} />
              ))}
            </div>
            <div className="distribution-rows">
              {[["CRITICAL", stats.critical], ["HIGH", stats.high], ["MEDIUM", stats.medium], ["LOW", stats.low]].map(([level, value]) => (
                <div key={level}><span><i style={{ background: riskColor(level) }} />{level}</span><strong>{value}</strong></div>
              ))}
            </div>
          </section>

          <section className="section filters-section">
            <div className="section-title"><span>Find signals</span><button className="text-button" onClick={reset}>Reset</button></div>
            <label className="search-box">
              <Icon name="search" size={15} />
              <input id="signal-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search class, land cover, coordinates" />
              <kbd>Ctrl K</kbd>
            </label>

            <button className="filter-toggle" onClick={() => setShowFilters((value) => !value)}>
              <span><Icon name="filter" size={15} /> Filters</span><b>{showFilters ? "Hide" : "Show"}</b>
            </button>

            {showFilters && (
              <div className="filter-body">
                <div className="filter-label">Risk level</div>
                <div className="risk-filter-grid">
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => (
                    <button key={level} className={riskFilter === level ? "active" : ""} onClick={() => setRiskFilter(level)}>{level === "ALL" ? "All" : level}</button>
                  ))}
                </div>
                <div className="filter-label">Classification</div>
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                  {CLASS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            )}
          </section>

          <section className="section context-section">
            <div className="section-title"><span>System context</span></div>
            <ContextRow label="Data source" value="NASA FIRMS" />
            <ContextRow label="Spatial context" value="OSM + WorldCover" />
            <ContextRow label="ML engine" value="Random Forest" />
            <ContextRow label="Risk engine" value="GeoFlare v0.1" />
          </section>

          <div className={`pipeline-status ${apiError ? "degraded" : ""}`}>
            <div className="pipeline-icon"><Icon name="pulse" size={18} /></div>
            <div><span>Pipeline</span><strong>{apiError ? "Degraded" : "Operational"}</strong></div>
            <span className="pipeline-light" />
          </div>
        </aside>

        <section className="map-panel panel">
          <div className="map-toolbar">
            <div><span className="eyebrow">THERMAL ACTIVITY</span><h2>Live event map</h2></div>
            <div className="map-tools">
              <span className="event-count">{filtered.length} signals</span>
              <button title="Map layers"><Icon name="layers" /></button>
              <button title="Map center"><Icon name="crosshair" /></button>
            </div>
          </div>

          <div className="map-frame">
            <MapContainer center={[22.5, 79]} zoom={5.1} minZoom={4} maxZoom={11} maxBounds={[[4, 60], [40, 105]]} maxBoundsViscosity={0.7} scrollWheelZoom className="map">
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapController selected={selected} />
              {filtered.map((event, index) => <ThermalMarker key={`${event.geometry.coordinates.join("-")}-${index}`} event={event} selected={selected === event} onClick={() => setSelected(event)} />)}
            </MapContainer>
            <div className="map-overlay" />
            <div className="map-grid" />

            <div className="map-info-card">
              <span>INDIA / 01</span>
              <strong>Thermal field</strong>
              <p>Near-real-time FIRMS detections enriched with geospatial context.</p>
            </div>

            <div className="map-coordinates"><span>22.5000 N</span><i /><span>79.0000 E</span></div>

            <div className="map-bottom-left">
              <div className="legend-title">Risk</div>
              {Object.keys(RISK_COLORS).map((level) => <div className="legend-item" key={level}><i style={{ background: riskColor(level) }} />{level}</div>)}
            </div>

            <div className="map-metrics">
              <Metric label="Peak FRP" value={`${number(stats.maxFrp)} MW`} />
              <Metric label="Average risk" value={`${number(stats.avgRisk)} / 100`} />
              <Metric label="Needs review" value={stats.uncertain} />
            </div>

            <div className="map-scale">100 km</div>
          </div>

          <div className="map-footer">
            <div><span>Classification coverage</span><strong>{stats.total ? `${Math.round((stats.classified / stats.total) * 100)}%` : "0%"}</strong></div>
            <div className="coverage-track"><span style={{ width: `${stats.total ? (stats.classified / stats.total) * 100 : 0}%` }} /></div>
            <div className="coverage-chips">
              {Object.entries(classCounts).slice(0, 3).map(([key, value]) => <button key={key} onClick={() => setClassFilter(key)}>{pretty(key)} <b>{value}</b></button>)}
            </div>
          </div>
        </section>

        <aside className="right-panel panel">
          {selected ? <EventDetail event={selected} onClose={() => setSelected(null)} /> : <PrioritySignals events={priority} onSelect={setSelected} />}
        </aside>
      </main>

      <footer className="footer">
        <span><i /> GEOFLARE CORE</span>
        <span>{stats.total} active detections</span>
        <span>{stats.uncertain} require review</span>
        <span>Auto refresh 60 sec</span>
        <span className="footer-right">India sector / build 01</span>
      </footer>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return <div className="stat"><span><i style={{ background: riskColor(tone) }} />{label}</span><strong>{value}</strong></div>;
}

function ContextRow({ label, value }) {
  return <div className="context-row"><span>{label}</span><strong>{value}</strong></div>;
}

function Metric({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function PrioritySignals({ events, onSelect }) {
  return (
    <div className="right-content">
      <div className="right-heading">
        <div><span className="eyebrow">PRIORITY QUEUE</span><h2>Signals requiring attention</h2></div>
        <span className="queue-badge">{String(events.length).padStart(2, "0")}</span>
      </div>
      <p className="right-intro">Sorted by thermal intensity, persistence, satellite confidence, infrastructure proximity and model confidence.</p>

      <div className="priority-list">
        {events.map((event, index) => {
          const p = event.properties;
          const color = riskColor(p.risk_level);
          const [lon, lat] = event.geometry.coordinates;
          return (
            <button className="priority-card" key={`${lat}-${lon}-${index}`} onClick={() => onSelect(event)}>
              <div className="priority-rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="priority-main">
                <div className="priority-title"><i style={{ background: color, boxShadow: `0 0 9px ${color}` }} /><strong>{pretty(p.predicted_class)}</strong><b style={{ color }}>{number(p.risk_score)}</b></div>
                <div className="priority-sub"><span>{p.risk_level}</span><span>FRP {number(p.frp)} MW</span><span>{p.landcover_name || "Unknown"}</span></div>
                <div className="priority-location">{number(lat, 4)} N, {number(lon, 4)} E</div>
              </div>
              <span className="priority-arrow"><Icon name="arrow" size={14} /></span>
            </button>
          );
        })}
        {!events.length && <div className="empty-state"><strong>No matching signals</strong><span>Adjust the search or filters to restore the queue.</span></div>}
      </div>

      <div className="queue-summary">
        <div><span>Queue health</span><strong>ACTIVE</strong></div>
        <div className="queue-bars">{Array.from({ length: 14 }).map((_, index) => <i key={index} className={index < Math.min(14, events.length + 2) ? "on" : ""} />)}</div>
      </div>
    </div>
  );
}

function EventDetail({ event, onClose }) {
  const p = event.properties;
  const [lon, lat] = event.geometry.coordinates;
  const color = riskColor(p.risk_level);
  const reasons = String(p.risk_reasons || "").split(";").map((x) => x.trim()).filter(Boolean);
  const confidence = Number(p.prediction_confidence || 0) * 100;

  return (
    <div className="detail-content">
      <div className="detail-top"><button onClick={onClose}><Icon name="arrow" size={15} /> Back to queue</button><span>EVENT INTELLIGENCE</span></div>
      <div className="detail-title-row"><div><span className="eyebrow">THERMAL EVENT</span><h2>{pretty(p.predicted_class)}</h2><p>{number(lat, 5)} N, {number(lon, 5)} E</p></div><div className="risk-badge" style={{ color, borderColor: `${color}55`, background: `${color}12` }}><span>RISK</span><strong>{p.risk_level}</strong></div></div>

      <div className="score-panel" style={{ "--accent": color }}>
        <div><span>GeoFlare risk score</span><strong>{number(p.risk_score)}</strong><small>/ 100</small></div>
        <div className="score-ring"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="16" /><circle className="ring-value" cx="21" cy="21" r="16" pathLength="100" style={{ strokeDasharray: `${Math.min(100, Number(p.risk_score || 0))} 100` }} /></svg></div>
      </div>

      <DetailSection title="AI classification">
        <div className="class-result"><div><strong>{pretty(p.predicted_class)}</strong><span className={p.classification_status === "CLASSIFIED" ? "good" : "warn"}>{p.classification_status === "CLASSIFIED" ? "Classification available" : "Review recommended"}</span></div><b>{number(confidence, 0)}%</b></div>
        <div className="confidence-track"><span style={{ width: `${Math.min(100, confidence)}%` }} /></div>
        <div className="detail-pairs"><Pair label="Model hypothesis" value={pretty(p.model_predicted_class)} /><Pair label="Land cover" value={p.landcover_name || "Unknown"} /></div>
      </DetailSection>

      <DetailSection title="Thermal telemetry">
        <div className="telemetry-grid"><Pair label="Fire radiative power" value={`${number(p.frp)} MW`} /><Pair label="Satellite confidence" value={`${number(Number(p.confidence_score || 0) * 100, 0)}%`} /><Pair label="Acquisition" value={p.acq_datetime || p.acq_date || "Unknown"} /><Pair label="Instrument" value={`${p.satellite || "VIIRS"} / ${p.instrument || "N/A"}`} /></div>
      </DetailSection>

      <DetailSection title="Geospatial context">
        <div className="telemetry-grid"><Pair label="Industry distance" value={`${number(p.distance_to_industry_km)} km`} /><Pair label="Power distance" value={`${number(p.distance_to_power_km)} km`} /><Pair label="Oil / gas distance" value={`${number(p.distance_to_oil_gas_km)} km`} /><Pair label="Settlement distance" value={`${number(p.distance_to_settlement_km)} km`} /></div>
      </DetailSection>

      <DetailSection title="Risk reasoning">
        <div className="reason-list">{reasons.length ? reasons.map((reason, index) => <div key={`${reason}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{reason}</div>) : <div><span>--</span>No risk reasoning available.</div>}</div>
      </DetailSection>

      <div className="decision" style={{ borderColor: `${color}40` }}><div><span>DECISION STATUS</span><strong>{p.decision_status || "REVIEW_RECOMMENDED"}</strong></div><i style={{ background: color }} /></div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return <section className="detail-section"><div className="detail-section-title">{title}</div>{children}</section>;
}

function Pair({ label, value }) {
  return <div className="pair"><span>{label}</span><strong>{value || "--"}</strong></div>;
}

export default App;
