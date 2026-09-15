import React, { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function formatPersistence(days) {
  const totalMinutes = Math.max(0, Math.round(Number(days || 0) * 24 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDistance(distance) {
  const value = Number(distance);
  if (!Number.isFinite(value)) return "N/A";
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${value.toFixed(1)} km`;
}

function formatEventType(predictedClass) {
  const labels = {
    industrial_fire: "Industrial Fire",
    natural_fire: "Natural Fire",
    agricultural_burning: "Agricultural Burning",
    persistent_thermal_source: "Persistent Thermal Source",
    gas_flare: "Gas Flare",
    uncertain: "Uncertain Thermal Event",
  };

  return labels[predictedClass] || "Thermal Anomaly";
}

function intensityFromFrp(frp) {
  const value = Number(frp || 0);

  if (value >= 50) return "HIGH";
  if (value >= 10) return "MEDIUM";
  return "LOW";
}

function mapBackendEvent(event) {
  return {
    id: `FIRE-${String(event.event_id).padStart(3, "0")}`,
    backendId: event.event_id,
    lat: Number(event.latitude),
    lng: Number(event.longitude),
    location: "India",
    type: formatEventType(event.predicted_class),
    risk: event.risk_level || "LOW",
    confidence: Math.round(Number(event.prediction_confidence || 0) * 100),
    satelliteConfidence: Math.round(Number(event.confidence_score || 0) * 100),
    persistence: formatPersistence(event.persistence_days),
    persistenceDays: Number(event.persistence_days || 0),
    intensity: intensityFromFrp(event.frp),
    frp: Number(event.frp || 0),
    facility:
      Number.isFinite(Number(event.distance_to_industry_km))
        ? "Industrial / mapped infrastructure"
        : "Mapped infrastructure",
    distance: formatDistance(event.distance_to_industry_km),
    distanceToIndustryKm: Number(event.distance_to_industry_km),
    distanceToPowerKm: Number(event.distance_to_power_km),
    distanceToOilGasKm: Number(event.distance_to_oil_gas_km),
    distanceToRoadKm: Number(event.distance_to_road_km),
    distanceToSettlementKm: Number(event.distance_to_settlement_km),
    detectionCount: Number(event.detection_count || 0),
    firstDetectedAt: event.first_detected_at,
    lastDetectedAt: event.last_detected_at,
    acqDatetime: event.acq_datetime,
    satellite: event.satellite,
    instrument: event.instrument,
    landcoverName: event.landcover_name,
    classificationStatus: event.classification_status,
    modelPredictedClass: event.model_predicted_class,
    predictionConfidence: Number(event.prediction_confidence || 0),
    riskScore: Number(event.risk_score || 0),
    decisionStatus: event.decision_status,
    riskReasons: event.risk_reasons || "No risk explanation available.",
    nearIndustry: Boolean(event.near_industry_5km),
    nearPower: Boolean(event.near_power_10km),
    nearOilGas: Boolean(event.near_oil_gas_10km),
    nearRoad: Boolean(event.near_road_1km),
    nearSettlement: Boolean(event.near_settlement_5km),
    industrialContext: Boolean(event.industrial_context),
    settlementContext: Boolean(event.settlement_context),
    roadContext: Boolean(event.road_context),
    vegetationContext: Boolean(event.vegetation_context),
    agricultureContext: Boolean(event.agriculture_context),
    builtupContext: Boolean(event.builtup_context),
    waterContext: Boolean(event.water_context),
    wetlandContext: Boolean(event.wetland_context),
    reason:
      event.risk_reasons ||
      "Risk assessment combines satellite thermal evidence, persistence, mapped infrastructure, land-cover context, and model classification.",
  };
}

function EventMap({ event }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(
      [event.lat, event.lng],
      12
    );

    mapRef.current = map;

    /*
      OpenStreetMap base layer
    */
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }
    ).addTo(map);


    /*
      Thermal event marker
    */

    const eventIcon = L.divIcon({
      className: "thermal-map-marker",
      html: `
        <div class="thermal-marker-ring">
          <div class="thermal-marker-core"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });


    L.marker(
      [event.lat, event.lng],
      {
        icon: eventIcon,
      }
    )
      .addTo(map)
      .bindPopup(`
        <div class="map-popup">
          <strong>${event.id}</strong>
          <span>${event.location}</span>
          <b>${event.risk} RISK</b>
        </div>
      `);


    /*
      Investigation radius
    */

    L.circle(
      [event.lat, event.lng],
      {
        radius: 1000,

        color: "#ff4b42",

        weight: 1,

        opacity: 0.8,

        fillColor: "#ff4035",

        fillOpacity: 0.08,
      }
    ).addTo(map);


    /*
      Nearby industrial facilities
      Demo coordinates for UI.
      Backend will replace these later.
    */

    const facilities = [
      {
        lat: event.lat + 0.009,
        lng: event.lng + 0.006,
        name: "Industrial Facility",
        distance: event.distance,
      },

      {
        lat: event.lat - 0.014,
        lng: event.lng + 0.011,
        name: "Processing Facility",
        distance: "2.1 km",
      },

      {
        lat: event.lat + 0.018,
        lng: event.lng - 0.012,
        name: "Power Infrastructure",
        distance: "3.4 km",
      },
    ];


    facilities.forEach((facility) => {

      const facilityIcon = L.divIcon({
        className: "facility-map-marker",

        html: `
          <div class="facility-marker">
            🏭
          </div>
        `,

        iconSize: [30, 30],

        iconAnchor: [15, 15],
      });


      L.marker(
        [facility.lat, facility.lng],
        {
          icon: facilityIcon,
        }
      )
        .addTo(map)
        .bindPopup(`
          <div class="map-popup">
            <strong>${facility.name}</strong>
            <span>Industrial infrastructure</span>
            <b>${facility.distance}</b>
          </div>
        `);

    });


    /*
      Event → nearest facility line
    */

    L.polyline(
      [
        [event.lat, event.lng],
        [facilities[0].lat, facilities[0].lng],
      ],
      {
        color: "#ff6b61",

        weight: 1,

        dashArray: "5, 7",

        opacity: 0.75,
      }
    ).addTo(map);


    /*
      Force correct map size
    */

    setTimeout(() => {
      map.invalidateSize();
    }, 200);


    return () => {
      map.remove();
      mapRef.current = null;
    };

  }, [event]);


  return (
    <div
      ref={containerRef}
      className="real-event-map"
    />
  );
}


function IndiaRiskMap({ events, selectedEvent, onSelectEvent }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 4,
      maxZoom: 12,
    }).setView([22.5, 79], 5);

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    events.forEach((event) => {
      const isHigh = event.risk === "HIGH";
      const isSelected = selectedEvent?.id === event.id;

      const icon = L.divIcon({
        className: "india-risk-marker",
        html: `
          <div class="india-marker-shell ${isHigh ? "high" : "medium"} ${isSelected ? "selected" : ""}">
            <div class="india-marker-core"></div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([event.lat, event.lng], {
        icon,
        title: event.id,
      })
        .addTo(map)
        .bindTooltip(
          `<strong>${event.id}</strong><br/>${event.location}<br/>${event.risk} RISK`,
          { direction: "top", offset: [0, -15] }
        );

      marker.on("click", () => onSelectEvent(event));

      if (isHigh) {
        L.circle([event.lat, event.lng], {
          radius: isSelected ? 32000 : 18000,
          color: "#ff4438",
          weight: 1,
          opacity: isSelected ? 0.7 : 0.35,
          fillColor: "#ff4438",
          fillOpacity: isSelected ? 0.12 : 0.04,
          interactive: false,
        }).addTo(map);
      }
    });

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [events, onSelectEvent]);

  useEffect(() => {
    if (!mapRef.current || !selectedEvent) return;

    mapRef.current.flyTo(
      [selectedEvent.lat, selectedEvent.lng],
      7,
      { duration: 1.1 }
    );
  }, [selectedEvent]);

  return (
    <div className="india-risk-map-wrap">
      <div className="india-map-header">
        <div>
          <span>INDIA THERMAL SURVEILLANCE</span>
          <strong>RISK EVENT MAP</strong>
        </div>

        <div className="india-map-legend">
          <span><i className="legend-high"></i> HIGH</span>
          <span><i className="legend-medium"></i> MEDIUM</span>
        </div>
      </div>

      <div ref={containerRef} className="india-risk-map"></div>

      <div className="india-map-status">
        <span className="map-live-dot"></span>
        LIVE EVENT OVERLAY
      </div>
    </div>
  );
}

function App() {
  const globeRef = useRef();

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [investigationOpen, setInvestigationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(null);
  const [dashboardView, setDashboardView] = useState("global");
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [replayStep, setReplayStep] = useState(4);
  const [isReplaying, setIsReplaying] = useState(false);


    const highRiskEvents = events.filter(
    (event) => event.risk === "HIGH"
  );

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events`);

        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Backend returned an invalid event payload.");
        }

        const mappedEvents = data.map(mapBackendEvent);

        if (!cancelled) {
          setEvents(mappedEvents);
          setEventsError(null);
        }
      } catch (error) {
        console.error("Failed to load GeoFlare events:", error);

        if (!cancelled) {
          setEventsError(error.message || "Unable to load events.");
        }
      } finally {
        if (!cancelled) {
          setEventsLoading(false);
        }
      }
    };

    loadEvents();
    const refreshTimer = setInterval(loadEvents, 60000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (!selectedEvent && events.length > 0) {
      const firstHighRisk = events.find((event) => event.risk === "HIGH");
      setSelectedEvent(firstHighRisk || events[0]);
    }
  }, [events, selectedEvent]);

  const openRiskEvent = (event) => {
    if (!event) return;
  setSelectedEvent(event);
  setPanelOpen(true);
  setActiveTab("Overview");

  if (globeRef.current) {
    globeRef.current.pointOfView(
      {
        lat: event.lat,
        lng: event.lng,
        altitude: 1.35,
      },
      900
    );
  }
};

const changeRiskEvent = (direction) => {
  if (!selectedEvent) return;

  const currentIndex = highRiskEvents.findIndex(
    (event) => event.id === selectedEvent.id
  );

  if (currentIndex === -1) {
    openRiskEvent(highRiskEvents[0]);
    return;
  }

  const nextIndex =
    (currentIndex + direction + highRiskEvents.length) %
    highRiskEvents.length;

  openRiskEvent(highRiskEvents[nextIndex]);
};

  const startReplay = () => {
    if (isReplaying) return;

    setIsReplaying(true);
    setReplayStep(0);

    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      setReplayStep(step);

      if (step >= 4) {
        clearInterval(interval);
        setIsReplaying(false);
      }
    }, 900);
  };

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;

    globeRef.current.pointOfView(
      {
        lat: 22.5,
        lng: 79,
        altitude: 1.75
      },
      1200
    );

    globeRef.current.controls().enableZoom = true;
    globeRef.current.controls().enablePan = false;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.controls().rotateSpeed = 0.35;
  }, []);

  const focusEvent = (event) => {
    if (!globeRef.current) return;

    globeRef.current.pointOfView(
      {
        lat: event.lat,
        lng: event.lng,
        altitude: panelOpen ? 1.05 : 1.25
      },
      900
    );
  };

  const openEvent = (event) => {
    setSelectedEvent(event);
    setPanelOpen(true);

    setTimeout(() => {
      focusEvent(event);
    }, 100);
  };

  const openRiskEvents = () => {
    const firstHighRisk = events.find(
      (event) => event.risk === "HIGH"
    );

    if (firstHighRisk) {
      openEvent(firstHighRisk);
    } else if (events.length > 0) {
      openEvent(events[0]);
    }
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelectedEvent(null);

    setTimeout(() => {
      if (!globeRef.current) return;

      globeRef.current.pointOfView(
        {
          lat: 22.5,
          lng: 79,
          altitude: 1.75
        },
        1000
      );
    }, 100);
  };

  const changeEvent = (direction) => {
    if (!selectedEvent) return;

    const currentIndex = events.findIndex(
      (event) => event.id === selectedEvent.id
    );

    let nextIndex =
      currentIndex + direction;

    if (nextIndex < 0) {
      nextIndex = events.length - 1;
    }

    if (nextIndex >= events.length) {
      nextIndex = 0;
    }

    const nextEvent = events[nextIndex];

    setSelectedEvent(nextEvent);

    setTimeout(() => {
      focusEvent(nextEvent);
    }, 50);
  };

  const focusIndia = () => {
    setPanelOpen(false);
    setSelectedEvent(null);
    setDashboardView("global");

    if (!globeRef.current) return;

    globeRef.current.pointOfView(
      {
        lat: 22.5,
        lng: 79,
        altitude: 1.75
      },
      1000
    );
  };

  const globeWidth = panelOpen
    ? screenWidth * 0.62
    : screenWidth;

  return (
    <div className="app">

      {/* ================= HEADER ================= */}

      <header className="topbar">

        <div className="brand">
          <h1>AGNI DRISHTI</h1>
          <p>Satellite Thermal Intelligence</p>
        </div>

        <nav className="navigation">

          <button
            className={dashboardView === "global" && !panelOpen ? "nav-button active" : "nav-button"}
            onClick={() => {
              setDashboardView("global");
              focusIndia();
            }}
          >
            ◉ Global View
          </button>

          <button
            className={panelOpen ? "nav-button risk-button active" : "nav-button risk-button"}
            onClick={() => {
              setDashboardView("risk");
              openRiskEvents();
            }}
          >
            ● Risk Events
          </button>

          <button
            className={dashboardView === "facilities" ? "nav-button active" : "nav-button"}
            onClick={() => {
              setPanelOpen(false);
              setSelectedEvent(null);
              setDashboardView("facilities");
            }}
          >
            ▦ Facilities
          </button>

          <button
            className={dashboardView === "analytics" ? "nav-button active" : "nav-button"}
            onClick={() => {
              setPanelOpen(false);
              setSelectedEvent(null);
              setDashboardView("analytics");
            }}
          >
            ▥ Analytics
          </button>

          <button
            className={dashboardView === "reports" ? "nav-button active" : "nav-button"}
            onClick={() => {
              setPanelOpen(false);
              setSelectedEvent(null);
              setDashboardView("reports");
            }}
          >
            ▤ Reports
          </button>

        </nav>

        <div className="live-status">
          <span className="status-dot"></span>
          LIVE
        </div>

      </header>


      {/* ================= GLOBE ================= */}

      <main
        className={
          panelOpen
            ? "globe-section panel-mode"
            : "globe-section"
        }
      >

        {eventsLoading && (
          <div className="instructions">
            Loading live thermal events...
          </div>
        )}

        {eventsError && !eventsLoading && (
          <div className="instructions">
            Backend connection error: {eventsError}
          </div>
        )}

        <Globe
          ref={globeRef}

          width={globeWidth}
          height={screenWidth < 900 ? window.innerHeight - 80 : window.innerHeight}

          backgroundColor="#070b10"

          globeImageUrl="https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"

          atmosphereColor="#315d7d"
          atmosphereAltitude={0.12}

          pointsData={events}

          pointLat="lat"
          pointLng="lng"

          pointColor={(event) =>
            event.risk === "HIGH"
              ? "#ff3b30"
              : "#ff9f43"
          }

          pointAltitude={0.025}

          pointRadius={(event) =>
            event.risk === "HIGH"
              ? 0.13
              : 0.09
          }

          pointResolution={12}

          pointsMerge={false}

          pointLabel={(event) => `
            <div class="globe-tooltip">
              <strong>${event.location}</strong>
              <br/>
              ${event.risk} RISK
              <br/>
              ${event.type}
            </div>
          `}

          onPointClick={openEvent}

          ringsData={events.filter(
            (event) => event.risk === "HIGH"
          )}

          ringLat="lat"
          ringLng="lng"

          ringColor="#ff3b30"

          ringMaxRadius={2.2}

          ringPropagationSpeed={1.4}

          ringRepeatPeriod={1400}
        />


        {/* Focus India */}

        {!panelOpen && (
          <button
            className="focus-india"
            onClick={focusIndia}
          >
            🌏 Focus India
          </button>
        )}

      </main>


      {/* ================= EVENT PANEL ================= */}

      {panelOpen && selectedEvent && (





        <aside className="event-panel">
          <div className="risk-event-switcher">
  <button
    className="risk-switch-button"
    onClick={() => changeRiskEvent(-1)}
  >
    ←
  </button>

  <div className="risk-event-counter">
    <span>HIGH RISK EVENTS</span>
    <strong>
      {highRiskEvents.findIndex(
        (event) => event.id === selectedEvent.id
      ) + 1}
      {" / "}
      {highRiskEvents.length}
    </strong>
  </div>

  <button
    className="risk-switch-button"
    onClick={() => changeRiskEvent(1)}
  >
    →
  </button>
</div>

<div className="risk-summary-strip">
  <div>
    <span>HIGH RISK</span>
    <strong>{highRiskEvents.length}</strong>
  </div>

  <div>
    <span>ACTIVE</span>
    <strong>{highRiskEvents.length}</strong>
  </div>

  <div>
    <span>REGION</span>
    <strong>INDIA</strong>
  </div>
</div>
<div className="risk-list">
  <div className="risk-list-title">
    <span>ACTIVE HIGH-RISK EVENTS</span>
    <small>{highRiskEvents.length} DETECTED</small>
  </div>

  {highRiskEvents.map((event) => (
    <button
      key={event.id}
      className={`risk-event-card ${
        selectedEvent?.id === event.id ? "selected" : ""
      }`}
      onClick={() => openRiskEvent(event)}
    >
      <div className="risk-event-dot"></div>

      <div className="risk-event-card-main">
        <div className="risk-event-card-top">
          <strong>{event.id}</strong>
          <span>HIGH</span>
        </div>

        <div className="risk-event-location">
          {event.location}
        </div>

        <div className="risk-event-type">
          {event.type}
        </div>

        <div className="risk-event-meta">
          <span>{event.confidence}% CONF.</span>
          <span>{event.persistence}</span>
          <span>{event.distance}</span>
        </div>
      </div>

      <div className="risk-event-arrow">→</div>
    </button>
  ))}
</div>
          {/* PANEL HEADER */}

          <div className="panel-header">

            <button
              className="back-button"
              onClick={closePanel}
            >
              ← Back to Events
            </button>

            <button
              className="close-button"
              onClick={closePanel}
            >
              ×
            </button>

          </div>


          {/* EVENT SWITCHER */}

          <div className="event-switcher">

            <button
              onClick={() => changeEvent(-1)}
            >
              ←
            </button>

            <span>
              {events.findIndex(
                (event) =>
                  event.id === selectedEvent.id
              ) + 1}
              {" / "}
              {events.length}
            </span>

            <button
              onClick={() => changeEvent(1)}
            >
              →
            </button>

          </div>


          {/* RISK */}

          <div className="risk-badge">
            <span>●</span>
            {selectedEvent.risk} RISK
          </div>


          <div className="event-id">
            Event ID: {selectedEvent.id}
          </div>


          <h2>
            {selectedEvent.location}
          </h2>


          <div className="coordinates">
            {selectedEvent.lat.toFixed(4)}° N
            {"  "}
            {selectedEvent.lng.toFixed(4)}° E
          </div>


          {/* TABS */}

          <div className="event-tabs">

  {[
    "Overview",
    "Imagery",
    "Timeline",
    "Context",
    "Facilities"
  ].map((tab) => (

    <button
      key={tab}
      className={activeTab === tab ? "active" : ""}
      onClick={() => setActiveTab(tab)}
    >
      {tab}
    </button>

  ))}

</div>


          {/* METRICS */}

          <div className="metrics-grid">

            <div className="metric-card">
              <span>◉</span>
              <small>CONFIDENCE</small>
              <strong>
                {selectedEvent.confidence}%
              </strong>
            </div>

            <div className="metric-card">
              <span>♨</span>
              <small>THERMAL INTENSITY</small>
              <strong>
                {selectedEvent.intensity}
              </strong>
            </div>

            <div className="metric-card">
              <span>◷</span>
              <small>PERSISTENCE</small>
              <strong>
                {selectedEvent.persistence}
              </strong>
            </div>

            <div className="metric-card">
              <span>●</span>
              <small>DISTANCE</small>
              <strong>
                {selectedEvent.distance}
              </strong>
            </div>

          </div>


          {/* EVENT TYPE */}

          <div className="event-type-card">

            <div className="fire-icon">
              ♨
            </div>

            <div>
              <small>EVENT TYPE</small>

              <strong>
                {selectedEvent.type}
              </strong>

              <p>
                Likely facility-related
                thermal source
              </p>
            </div>

          </div>


          {/* WHY */}

          <section className="why-section">

            <h3>
              WHY THIS EVENT MATTERS
            </h3>

            <p>
              {selectedEvent.reason}
            </p>

          </section>


          {/* ACTIONS */}

          <div className="action-buttons">

            <button
              className="investigate-button"
              onClick={() => {
                setActiveTab("Imagery");
                setInvestigationOpen(true);
              }}
            >
              🔍 View Full Investigation →
            </button>

            <button className="track-button">
              ♧ Track This Event
            </button>

          </div>


          {/* RELATED EVENTS */}

          <section className="related-section">

            <div className="section-title">
              <span>RELATED EVENTS NEARBY</span>
              <button>See All →</button>
            </div>

            <div className="related-events">

              {events
                .filter(
                  (event) =>
                    event.id !== selectedEvent.id
                )
                .slice(0, 3)
                .map((event) => (

                  <button
                    key={event.id}
                    className="related-card"
                    onClick={() => openEvent(event)}
                  >

                    <div className="mini-map">
                      ●
                    </div>

                    <div>
                      <strong>
                        {event.id}
                      </strong>

                      <span>
                        {event.location}
                      </span>

                      <em
                        className={
                          event.risk === "HIGH"
                            ? "high-text"
                            : "medium-text"
                        }
                      >
                        {event.risk}
                      </em>
                    </div>

                    <span className="arrow">
                      →
                    </span>

                  </button>

                ))}

            </div>

          </section>


          <div className="source">
            Source: NASA FIRMS
            <span>|</span>
            Satellite Thermal Data
          </div>

        </aside>





      )}
      {investigationOpen && selectedEvent && (
  <div className="investigation-screen">

    {/* HEADER */}

    <div className="investigation-header">

      <button
        className="investigation-back"
        onClick={() => setInvestigationOpen(false)}
      >
        ← Back to Events
      </button>

      <div className="investigation-title">
        <span>EVENT INVESTIGATION</span>
        <strong>{selectedEvent.id}</strong>
      </div>

      <div className="investigation-risk">
        ● {selectedEvent.risk} RISK
      </div>

    </div>


    {/* MAIN CONTENT */}

    <div className="investigation-content">

      {/* LEFT */}

      <section className="investigation-left">
        {activeTab === "Imagery" && (
  <div className="tab-view">

    <div className="tab-view-header">
      <div>
        <span>SATELLITE IMAGERY</span>
        <h2>Thermal Observation</h2>
      </div>

      <small>NASA FIRMS</small>
    </div>

    <div className="real-map-wrapper">

  <div className="map-top-bar">

    <div>
      <span>SATELLITE / GEOGRAPHIC VIEW</span>
    </div>

    <div className="map-source">
      OSM
    </div>

  </div>

  <EventMap event={selectedEvent} />

  <div className="map-overlay-info">

    <div className="map-status">
      <span className="map-live-dot"></span>
      EVENT DETECTION
    </div>

    <div className="map-coordinates-live">
      {selectedEvent.lat.toFixed(4)}° N&nbsp;&nbsp;
      {selectedEvent.lng.toFixed(4)}° E
    </div>

  </div>

</div>

    <div className="imagery-info">

      <div>
        <span>OBSERVATION SOURCE</span>
        <strong>NASA FIRMS</strong>
      </div>

      <div>
        <span>THERMAL INTENSITY</span>
        <strong>{selectedEvent.intensity}</strong>
      </div>

      <div>
        <span>CONFIDENCE</span>
        <strong>{selectedEvent.confidence}%</strong>
      </div>

    </div>

  </div>
)}
{activeTab === "Timeline" && (
  <div className="tab-view">

    <div className="tab-view-header">
      <div>
        <span>OBSERVATION HISTORY</span>
        <h2>Event Timeline</h2>
      </div>

      <small>{selectedEvent.persistence}</small>
    </div>

    <div className="full-timeline">

      <div className="timeline-event">
        <div className="timeline-dot"></div>

        <div>
          <strong>
            {new Date(selectedEvent.firstDetectedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          <h3>First Detection</h3>
          <p>
            Initial thermal anomaly detected by {selectedEvent.satellite || "NASA FIRMS"}.
          </p>
        </div>
      </div>

      <div className="timeline-event">
        <div className="timeline-dot"></div>

        <div>
          <strong>{selectedEvent.detectionCount}</strong>
          <h3>Satellite Observations</h3>
          <p>
            {selectedEvent.detectionCount} observation
            {selectedEvent.detectionCount === 1 ? "" : "s"} associated with this event.
          </p>
        </div>
      </div>

      <div className="timeline-event">
        <div className="timeline-dot"></div>

        <div>
          <strong>{selectedEvent.persistence}</strong>
          <h3>Estimated Persistence</h3>
          <p>
            Repeated thermal detections indicate an estimated activity episode over this period.
          </p>
        </div>
      </div>

      <div className="timeline-event">
        <div className="timeline-dot latest"></div>

        <div>
          <strong>
            {new Date(selectedEvent.lastDetectedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          <h3>Latest Observation</h3>
          <p>
            Most recent satellite observation currently associated with this event.
          </p>
        </div>
      </div>

    </div>

  </div>
)}
{activeTab === "Context" && (
  <div className="tab-view">

    <div className="tab-view-header">
      <div>
        <span>GEOGRAPHIC ANALYSIS</span>
        <h2>Environmental Context</h2>
      </div>

      <small>OSM + LAND COVER</small>
    </div>

    <div className="context-map">

      <div className="context-grid"></div>

      <div className="context-zone industrial-zone">
        INDUSTRIAL
      </div>

      <div className="context-zone urban-zone">
        URBAN
      </div>

      <div className="context-zone agricultural-zone">
        AGRICULTURAL
      </div>

      <div className="context-hotspot">
        ●
      </div>

    </div>

    <div className="land-use">

      <div className="land-row">
        <span>Industrial / Power</span>
        <div className="land-bar">
          <i style={{ width: `${selectedEvent.industrialContext ? 100 : 20}%` }}></i>
        </div>
        <strong>{selectedEvent.industrialContext ? "YES" : "NO"}</strong>
      </div>

      <div className="land-row">
        <span>Agricultural</span>
        <div className="land-bar">
          <i style={{ width: `${selectedEvent.agricultureContext ? 100 : 20}%` }}></i>
        </div>
        <strong>{selectedEvent.agricultureContext ? "YES" : "NO"}</strong>
      </div>

      <div className="land-row">
        <span>Built-up</span>
        <div className="land-bar">
          <i style={{ width: `${selectedEvent.builtupContext ? 100 : 20}%` }}></i>
        </div>
        <strong>{selectedEvent.builtupContext ? "YES" : "NO"}</strong>
      </div>

      <div className="land-row">
        <span>Land cover</span>
        <div className="land-bar">
          <i style={{ width: "100%" }}></i>
        </div>
        <strong>{selectedEvent.landcoverName}</strong>
      </div>

    </div>

  </div>
)}
{activeTab === "Facilities" && (
  <div className="tab-view">

    <div className="tab-view-header">
      <div>
        <span>OPENSTREETMAP ANALYSIS</span>
        <h2>Nearby Facilities</h2>
      </div>

      <small>OSM</small>
    </div>

    <div className="facility-list">

      <div className="facility-item">

        <div className="facility-icon">
          🏭
        </div>

        <div>
          <strong>
            Industrial Facility
          </strong>

          <span>
            Manufacturing / Processing
          </span>
        </div>

        <b>
          {selectedEvent.distance}
        </b>

      </div>


      <div className="facility-item">

        <div className="facility-icon">
          🏭
        </div>

        <div>
          <strong>
            Processing Facility
          </strong>

          <span>
            Industrial infrastructure
          </span>
        </div>

        <b>
          2.1 km
        </b>

      </div>


      <div className="facility-item">

        <div className="facility-icon">
          ⚡
        </div>

        <div>
          <strong>
            Power Infrastructure
          </strong>

          <span>
            Energy facility
          </span>
        </div>

        <b>
          3.4 km
        </b>

      </div>

    </div>


    <div className="facility-note">

      <span>ⓘ</span>

      <p>
        Facility proximity is used as contextual
        evidence in the risk assessment. It does
        not independently confirm the cause of
        the thermal anomaly.
      </p>

    </div>

  </div>
)}


        {activeTab === "Overview" && (
        <>
        <div className="location-heading">

          <div>
            <span>THERMAL EVENT</span>

            <h1>
              {selectedEvent.location}
            </h1>

            <p>
              {selectedEvent.lat.toFixed(4)}° N
              {"  "}
              {selectedEvent.lng.toFixed(4)}° E
            </p>
          </div>

        </div>


        {/* SATELLITE IMAGE */}

        <div className="satellite-card">

          <div className="card-heading">
            <span>SATELLITE THERMAL OBSERVATION</span>

            <small>
              NASA FIRMS
            </small>
          </div>

          <div className="satellite-placeholder">

            <div className="satellite-grid"></div>

            <div className="thermal-center">
              <div className="thermal-ring"></div>
              <div className="thermal-dot"></div>
            </div>

            <div className="map-label label-1">
              INDUSTRIAL AREA
            </div>

            <div className="map-label label-2">
              DETECTION
            </div>

            <div className="map-coordinates">
              {selectedEvent.lat.toFixed(4)}° N
              {"  "}
              {selectedEvent.lng.toFixed(4)}° E
            </div>

          </div>

        </div>


        {/* TIMELINE */}

        <div className="timeline-card">


          <div className="card-heading">
            <span>EVENT TIMELINE</span>

            <small>
              {selectedEvent.persistence}
            </small>
          </div>
          <div className="timeline-replay">

            <div className="replay-header">
              <div>
                <span>THERMAL OBSERVATION SEQUENCE</span>
                <strong>EVENT REPLAY</strong>
              </div>

              <div className="replay-status">
                <span className="replay-dot"></span>
                {selectedEvent.persistence} OBSERVED
              </div>
            </div>

            <div className="replay-track">

              <div className="replay-line"></div>

              <div className={`replay-step ${replayStep >= 1 ? "active" : ""}`}>
                <div className="replay-point"></div>
                <div className="replay-info">
                  <strong>
                    {new Date(selectedEvent.firstDetectedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  <span>DETECTION</span>
                  <small>Initial thermal anomaly</small>
                </div>
              </div>

              <div className={`replay-step ${replayStep >= 2 ? "active" : ""}`}>
                <div className="replay-point"></div>
                <div className="replay-info">
                  <strong>{selectedEvent.detectionCount} OBS.</strong>
                  <span>PERSISTENCE</span>
                  <small>Thermal source remains associated with this event</small>
                </div>
              </div>

              <div className={`replay-step ${replayStep >= 3 ? "active" : ""}`}>
                <div className="replay-point"></div>
                <div className="replay-info">
                  <strong>{selectedEvent.intensity}</strong>
                  <span>THERMAL INTENSITY</span>
                  <small>Latest FIRMS FRP: {selectedEvent.frp.toFixed(2)} MW</small>
                </div>
              </div>

              <div className={`replay-step ${replayStep >= 4 ? "active latest" : ""}`}>
                <div className="replay-point"></div>
                <div className="replay-info">
                  <strong>
                    {new Date(selectedEvent.lastDetectedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  <span>LATEST</span>
                  <small>Most recent observation</small>
                </div>
              </div>

            </div>

            <div className="replay-controls">

              <button
                className="replay-button"
                onClick={startReplay}
                disabled={isReplaying}
              >
                {isReplaying ? "■" : "▶"}
              </button>

              <div className="replay-progress">
                <div
                  className="replay-progress-fill"
                  style={{
                    width: `${(replayStep / 4) * 100}%`,
                  }}
                ></div>
              </div>

              <span className="replay-time">
                {replayStep <= 1 &&
                  new Date(selectedEvent.firstDetectedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                {replayStep === 2 && `${selectedEvent.detectionCount} OBS.`}
                {replayStep === 3 && selectedEvent.intensity}
                {replayStep === 4 &&
                  new Date(selectedEvent.lastDetectedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </span>

            </div>

          </div>

          </div>

        <div className="risk-explanation-card">
  <div className="risk-explanation-header">
    <div>
      <span>MODEL ASSESSMENT</span>
      <h3>WHY HIGH RISK?</h3>
    </div>

    <div className="risk-score">
      <strong>{selectedEvent.risk}</strong>
      <small>RISK LEVEL</small>
    </div>
  </div>

  <div className="risk-factors">

    <div className="risk-factor">
      <div className="factor-icon">◉</div>

      <div className="factor-content">
        <div className="factor-title">
          <span>THERMAL INTENSITY</span>
          <strong>{selectedEvent.intensity}</strong>
        </div>

        <div className="factor-bar">
          <div
            className="factor-fill"
            style={{
              width:
                selectedEvent.intensity === "HIGH"
                  ? "92%"
                  : "58%",
            }}
          ></div>
        </div>

        <p>
          Strong thermal anomaly detected in satellite observation.
        </p>
      </div>
    </div>


    <div className="risk-factor">
      <div className="factor-icon">◷</div>

      <div className="factor-content">
        <div className="factor-title">
          <span>PERSISTENCE</span>
          <strong>{selectedEvent.persistence}</strong>
        </div>

        <div className="factor-bar">
          <div
            className="factor-fill"
            style={{
              width:
                parseFloat(selectedEvent.persistence) >= 4
                  ? "88%"
                  : "55%",
            }}
          ></div>
        </div>

        <p>
          Repeated thermal observations increase event significance.
        </p>
      </div>
    </div>


    <div className="risk-factor">
      <div className="factor-icon">⌖</div>

      <div className="factor-content">
        <div className="factor-title">
          <span>FACILITY PROXIMITY</span>
          <strong>{selectedEvent.distance}</strong>
        </div>

        <div className="factor-bar">
          <div
            className="factor-fill"
            style={{
              width:
                parseFloat(selectedEvent.distance) <= 1.5
                  ? "94%"
                  : "60%",
            }}
          ></div>
        </div>

        <p>
          Thermal source is located near mapped infrastructure.
        </p>
      </div>
    </div>


    <div className="risk-factor">
      <div className="factor-icon">◎</div>

      <div className="factor-content">
        <div className="factor-title">
          <span>CLASSIFICATION CONFIDENCE</span>
          <strong>{selectedEvent.confidence}%</strong>
        </div>

        <div className="factor-bar">
          <div
            className="factor-fill"
            style={{
              width: `${selectedEvent.confidence}%`,
            }}
          ></div>
        </div>

        <p>
          Model confidence based on available geographic and temporal evidence.
        </p>
      </div>
    </div>

  </div>

  <div className="risk-conclusion">
    <span>ASSESSMENT</span>
    <p>
      Multiple independent indicators support a
      <strong> probable high-risk thermal event</strong>.
    </p>
  </div>
</div>

        </>
        )}


      </section>


      {/* RIGHT */}

      <section className="investigation-right">

        {/* SUMMARY */}

        <div className="investigation-card">

          <div className="card-heading">
            <span>EVENT SUMMARY</span>
          </div>

          <div className="summary-grid">

            <div>
              <small>CONFIDENCE</small>
              <strong>
                {selectedEvent.confidence}%
              </strong>
            </div>

            <div>
              <small>PERSISTENCE</small>
              <strong>
                {selectedEvent.persistence}
              </strong>
            </div>

            <div>
              <small>THERMAL INTENSITY</small>
              <strong>
                {selectedEvent.intensity}
              </strong>
            </div>

            <div>
              <small>FACILITY DISTANCE</small>
              <strong>
                {selectedEvent.distance}
              </strong>
            </div>

          </div>

        </div>


        {/* CLASSIFICATION */}

        <div className="investigation-card">

          <div className="card-heading">
            <span>AI CLASSIFICATION</span>
          </div>

          <div className="classification">

            <div className="classification-icon">
              ♨
            </div>

            <div>

              <strong>
                {selectedEvent.type}
              </strong>

              <p>
                {selectedEvent.classificationStatus === "CLASSIFIED"
                  ? `Model classification confidence: ${selectedEvent.confidence}%`
                  : "Classification requires review"}
              </p>

            </div>

            <div className="classification-score">
              {selectedEvent.confidence}%
            </div>

          </div>

        </div>


        {/* WHY HIGH RISK */}

        <div className="investigation-card why-high-risk">

          <div className="card-heading">
            <span>WHY HIGH RISK?</span>
          </div>

          <div className="evidence-list">

            <div className="evidence-item">
              <span>✓</span>
              <div>
                <strong>Persistent signal</strong>
                <small>
                  Detected repeatedly over
                  {selectedEvent.persistence}
                </small>
              </div>
            </div>

            <div className="evidence-item">
              <span>✓</span>
              <div>
                <strong>Industrial proximity</strong>
                <small>
                  Nearest facility:
                  {selectedEvent.distance}
                </small>
              </div>
            </div>

            <div className="evidence-item">
              <span>✓</span>
              <div>
                <strong>High thermal intensity</strong>
                <small>
                  Satellite observation classified
                  as high intensity
                </small>
              </div>
            </div>

            <div className="evidence-item">
              <span>✓</span>
              <div>
                <strong>Multiple observations</strong>
                <small>
                  Consistent thermal detections
                  strengthen the assessment
                </small>
              </div>
            </div>

          </div>

        </div>


        {/* CONTEXT */}

        <div className="investigation-card">

          <div className="card-heading">
            <span>GEOGRAPHIC CONTEXT</span>
          </div>

          <div className="context-list">

            <div>
              <span>Land context</span>
              <strong>{selectedEvent.landcoverName}</strong>
            </div>

            <div>
              <span>Nearest facility</span>
              <strong>
                {selectedEvent.facility}
              </strong>
            </div>

            <div>
              <span>Distance</span>
              <strong>
                {selectedEvent.distance}
              </strong>
            </div>

            <div>
              <span>Source</span>
              <strong>NASA FIRMS</strong>
            </div>

          </div>

        </div>


        {/* ACTIONS */}

        <div className="investigation-actions">

          <button className="track-large">
            ♧ Track This Event
          </button>

          <button
            className="return-large"
            onClick={() => setInvestigationOpen(false)}
          >
            ← Return to Events
          </button>

        </div>

      </section>

    </div>


    {/* FOOTER */}

    <div className="investigation-footer">

      <span>
        AGNI DRISHTI
      </span>

      <span>
        Decision-support assessment •
        Satellite-derived thermal observation
      </span>

      <span>
        Source: NASA FIRMS
      </span>

    </div>

  </div>
)}


      {dashboardView !== "global" && !panelOpen && (
        <aside className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <span>GEOSPATIAL THERMAL INTELLIGENCE</span>
              <h2>
                {dashboardView === "facilities" && "Facilities"}
                {dashboardView === "analytics" && "Analytics"}
                {dashboardView === "reports" && "Reports"}
              </h2>
            </div>

            <button
              className="dashboard-panel-close"
              onClick={() => setDashboardView("global")}
              aria-label="Close section"
            >
              ×
            </button>
          </div>

          {dashboardView === "facilities" && (
            <div className="dashboard-panel-content">
              <div className="dashboard-panel-summary">
                <strong>OSM CONTEXT</strong>
                <span>Infrastructure proximity associated with active thermal events.</span>
              </div>

              {events
                .slice()
                .sort((a, b) => a.distanceToIndustryKm - b.distanceToIndustryKm)
                .slice(0, 8)
                .map((event) => (
                  <button
                    key={event.id}
                    className="dashboard-data-row"
                    onClick={() => openEvent(event)}
                  >
                    <div>
                      <strong>{event.id}</strong>
                      <span>{event.type}</span>
                    </div>
                    <div>
                      <b>{formatDistance(event.distanceToIndustryKm)}</b>
                      <small>INDUSTRY</small>
                    </div>
                  </button>
                ))}
            </div>
          )}

          {dashboardView === "analytics" && (
            <div className="dashboard-panel-content">
              <div className="analytics-grid">
                <div>
                  <span>ACTIVE EVENTS</span>
                  <strong>{events.length}</strong>
                </div>
                <div>
                  <span>HIGH RISK</span>
                  <strong>{highRiskEvents.length}</strong>
                </div>
                <div>
                  <span>PERSISTENT</span>
                  <strong>{events.filter((event) => event.persistenceDays >= 1).length}</strong>
                </div>
                <div>
                  <span>CLASSIFIED</span>
                  <strong>{events.filter((event) => event.classificationStatus === "CLASSIFIED").length}</strong>
                </div>
              </div>

              <div className="dashboard-panel-summary">
                <strong>CLASSIFICATION DISTRIBUTION</strong>
                <span>
                  Current active-event classifications from the GeoFlare ML pipeline.
                </span>
              </div>

              {[
                ["Industrial Fire", "industrial_fire"],
                ["Natural Fire", "natural_fire"],
                ["Agricultural Burning", "agricultural_burning"],
                ["Persistent Thermal Source", "persistent_thermal_source"],
                ["Uncertain", "uncertain"],
              ].map(([label, value]) => {
                const count = events.filter(
                  (event) => event.modelPredictedClass === value
                ).length;
                const percentage = events.length
                  ? Math.round((count / events.length) * 100)
                  : 0;

                return (
                  <div className="analytics-row" key={value}>
                    <div>
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="analytics-bar">
                      <i style={{ width: `${percentage}%` }}></i>
                    </div>
                    <small>{percentage}%</small>
                  </div>
                );
              })}
            </div>
          )}

          {dashboardView === "reports" && (
            <div className="dashboard-panel-content">
              <div className="report-card">
                <span>LIVE DATASET</span>
                <strong>NASA FIRMS + OSM + WorldCover</strong>
                <p>
                  Active thermal event intelligence currently available through the GeoFlare API.
                </p>
              </div>

              <div className="report-card">
                <span>EVENT COVERAGE</span>
                <strong>{events.length} active event episodes</strong>
                <p>
                  Each event is associated with satellite observations and spatial context.
                </p>
              </div>

              <div className="report-card">
                <span>MODEL STATUS</span>
                <strong>
                  {events.filter((event) => event.classificationStatus === "CLASSIFIED").length} classified
                </strong>
                <p>
                  Classification status is based on the configured model confidence threshold.
                </p>
              </div>

              <div className="report-note">
                Decision-support assessment. Satellite-derived observations do not independently confirm fire cause.
              </div>
            </div>
          )}
        </aside>
      )}

      {/* ================= BOTTOM STATS ================= */}

      {!panelOpen && dashboardView === "global" && (

        <div className="bottom-stats">

          <div className="stat-card">
            <span>ACTIVE EVENTS</span>
            <strong>127</strong>
            <small>+12% vs last 24h</small>
          </div>

          <div className="stat-card">
            <span>HIGH RISK</span>
            <strong>09</strong>
            <small>+3 vs last 24h</small>
          </div>

          <div className="stat-card">
            <span>PERSISTENT</span>
            <strong>18</strong>
            <small>+5 vs last 24h</small>
          </div>

          <div className="stat-card">
            <span>INDUSTRIAL</span>
            <strong>34</strong>
            <small>+8 vs last 24h</small>
          </div>

        </div>

      )}


      {/* INSTRUCTIONS */}

      {!panelOpen && dashboardView === "global" && (

        <div className="instructions">
          Drag to rotate • Scroll to explore • Click an event
        </div>

      )}

    </div>
  );
}

export default App;
