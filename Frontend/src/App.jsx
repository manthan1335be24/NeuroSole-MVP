import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const WS_URL = "ws://10.35.167.60:3000";
const HIST = 80;
const MAX_RETRIES = 3;

function makePath(values, W, H) {
  const valid = values.filter(v => v !== null && !isNaN(v) && v !== 0);
  if (valid.length < 2) return { path: "", min: 0, max: 1 };
  let dMin = Math.min(...valid);
  let dMax = Math.max(...valid);
  if (dMax === dMin) { dMin -= 0.5; dMax += 0.5; }
  const pad = Math.max((dMax - dMin) * 0.2, 0.2);
  const min = dMin - pad;
  const max = dMax + pad;
  const range = max - min;
  const pts = values.map((v, i) => ({
    x: (i / (HIST - 1)) * W,
    y: H - ((v - min) / range) * (H - 14) - 7,
  }));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    d += ` C ${cx.toFixed(1)} ${pts[i].y.toFixed(1)},${cx.toFixed(1)} ${pts[i+1].y.toFixed(1)},${pts[i+1].x.toFixed(1)} ${pts[i+1].y.toFixed(1)}`;
  }
  return { path: d, min, max };
}

function EcgCard({ title, value, unit, color, history, normalMin, normalMax, wide = false }) {
  const W = wide ? 580 : 310;
  const H = 110;
  const numVal = parseFloat(value);
  const isOOR = normalMin != null && (numVal < normalMin || numVal > normalMax);
  const dc = isOOR ? "#f43f5e" : color;
  const { path, min, max } = useMemo(() => makePath(history, W, H), [history, W, H]);

  let bandY = 0, bandH = 0;
  if (normalMin != null && max !== min) {
    const range = max - min;
    const y1 = H - ((Math.min(normalMax, max) - min) / range) * (H - 14) - 7;
    const y2 = H - ((Math.max(normalMin, min) - min) / range) * (H - 14) - 7;
    bandY = Math.min(y1, y2);
    bandH = Math.abs(y2 - y1);
  }
  const tipY = useMemo(() => {
    const v = history[history.length - 1] ?? 0;
    const range = max - min || 1;
    return H - ((v - min) / range) * (H - 14) - 7;
  }, [history, min, max]);

  const filterId = `fl${title.replace(/\W/g, "")}`;
  const gradId = `gr${title.replace(/\W/g, "")}`;

  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(8,22,50,0.95) 0%, rgba(3,12,28,0.98) 100%)",
      border: `1px solid ${dc}30`,
      borderRadius: 16,
      padding: "14px 16px 12px",
      boxShadow: `0 6px 30px rgba(0,0,0,0.6), 0 0 0 1px ${dc}12, inset 0 1px 0 ${dc}20`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: "8%", right: "8%", height: "1px",
        background: `linear-gradient(90deg, transparent, ${dc}80, transparent)`,
      }}/>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: dc, boxShadow: `0 0 10px ${dc}` }}/>
          <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 10, letterSpacing: "0.22em", color: `${dc}99`, textTransform: "uppercase" }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 700,
            fontSize: wide ? 28 : 38, color: dc, lineHeight: 1,
            textShadow: `0 0 28px ${dc}99`,
          }} className={isOOR ? "blink" : ""}>
            {value}
          </span>
          <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 11, color: `${dc}55` }}>{unit}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", borderRadius: 8 }}>
        <defs>
          <filter id={filterId} x="-10%" y="-80%" width="120%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dc} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={dc} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="rgba(2,6,18,0.75)" rx="8"/>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={`h${f}`} x1="0" y1={H*f} x2={W} y2={H*f} stroke={`${dc}0c`} strokeWidth="1" strokeDasharray="3,8"/>
        ))}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={`v${f}`} x1={W*f} y1="0" x2={W*f} y2={H} stroke={`${dc}08`} strokeWidth="1" strokeDasharray="2,10"/>
        ))}
        {bandH > 0 && (
          <rect x={0} y={bandY} width={W} height={Math.max(bandH, 1)} fill={`${color}12`}/>
        )}
        {path && (
          <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradId})`}/>
        )}
        <path d={path} fill="none" stroke={dc} strokeWidth={wide ? 8 : 10} opacity="0.07" strokeLinecap="round"/>
        <path d={path} fill="none" stroke={dc} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          filter={`url(#${filterId})`}/>
        {history.length > 2 && (
          <circle cx={W} cy={tipY} r={3.5} fill={dc}
            style={{ filter: `drop-shadow(0 0 8px ${dc})` }}/>
        )}
      </svg>
    </div>
  );
}

function FootDiagram({ heel }) {
  const pressure = Math.min(Math.max(heel, 0) / 800, 1);
  const heelR = 74 + Math.round(181 * pressure);
  const heelG = 222 - Math.round(150 * pressure);
  return (
    <div style={{ position: "relative", width: 320, height: 580 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "radial-gradient(ellipse 60% 70% at 50% 55%, rgba(0,180,255,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }}/>
      <svg viewBox="5900 -100 5600 13100" style={{ width: "100%", height: "100%" }}>
        <defs>
          <radialGradient id="heelHeat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgba(${heelR},${heelG},0,${0.6 + pressure * 0.35})`}/>
            <stop offset="55%" stopColor={`rgba(${heelR},${heelG},0,${0.12 * pressure})`}/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <linearGradient id="fOutline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8"/>
            <stop offset="42%" stopColor="#f97316"/>
            <stop offset="100%" stopColor="#34d399"/>
          </linearGradient>
          <linearGradient id="fFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.07"/>
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.04"/>
          </linearGradient>
          <filter id="fGlow" x="-10%" y="-5%" width="120%" height="110%">
            <feGaussianBlur stdDeviation="22" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="nGlow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="14" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g transform="translate(0,12800) scale(1,-1)">
          <path
            d="M7278 10849 c-274 -24 -541 -111 -740 -242 -390 -254 -598 -686 -575 -1192 26 -548 285 -1132 748 -1685 150 -179 326 -343 547 -507 347 -258 494 -386 616 -532 208 -250 309 -491 338 -808 43 -473 -134 -987 -515 -1496 -173 -230 -302 -377 -671 -762 -122 -127 -266 -280 -320 -340 -403 -446 -608 -813 -682 -1220 -22 -125 -26 -442 -5 -555 21 -124 60 -269 97 -364 209 -541 664 -961 1184 -1095 304 -78 594 -66 900 35 670 222 1150 822 1222 1526 11 108 9 170 -22 573 -11 141 -9 200 21 495 59 594 186 1281 379 2050 98 391 172 625 440 1396 325 931 423 1275 476 1664 24 176 24 516 1 669 -96 615 -387 1034 -1082 1556 -808 607 -1632 899 -2357 834 z"
            fill="url(#fFill)" stroke="url(#fOutline)" strokeWidth="55" filter="url(#fGlow)"
          />
          {heel > 8 && (
            <ellipse cx="7278" cy="1900"
              rx={300 + pressure * 500} ry={220 + pressure * 360}
              fill="url(#heelHeat)" opacity={0.9}
            />
          )}
          {[
            "M6721 12785 c-171 -48 -311 -180 -411 -385 -76 -158 -110 -319 -110 -520 0 -289 72 -494 231 -653 147 -148 333 -204 534 -162 250 52 432 259 502 569 20 88 23 362 5 456 -37 186 -119 374 -217 493 -63 76 -171 157 -254 188 -74 28 -206 35 -280 14z",
            "M8098 12296 c-149 -43 -275 -191 -319 -376 -17 -76 -15 -231 5 -310 96 -381 464 -534 705 -293 222 223 211 650 -24 872 -104 98 -250 141 -367 107z",
            "M9048 11705 c-30 -10 -69 -35 -106 -69 -96 -89 -142 -204 -142 -356 0 -196 83 -351 225 -421 59 -29 72 -31 132 -27 113 8 204 72 265 185 78 143 78 363 1 506 -85 155 -233 227 -375 182z",
            "M9880 11071 c-159 -32 -280 -210 -280 -412 0 -132 58 -247 150 -297 38 -20 55 -23 115 -19 39 2 84 11 100 19 91 48 177 168 205 286 28 120 -3 265 -74 349 -47 56 -142 88 -216 74z",
            "M10510 10491 c-47 -15 -85 -39 -121 -78 -50 -53 -74 -96 -99 -181 -18 -61 -22 -90 -18 -175 5 -123 29 -187 93 -246 133 -123 316 -38 392 182 64 184 24 388 -92 469 -43 30 -113 43 -155 29z",
          ].map((d, i) => (
            <path key={i} d={d} fill="#38bdf8" opacity={0.75 - i * 0.04}
              style={{ filter: "drop-shadow(0 0 18px rgba(56,189,248,0.75))" }}/>
          ))}
          <g filter="url(#nGlow)">
            <circle cx="6640" cy="12460" r="140" fill="none" stroke="#38bdf8" strokeWidth="38" opacity="0.25"/>
            <circle cx="6640" cy="12460" r="52" fill="#38bdf8" opacity="0.95"
              style={{ filter: "drop-shadow(0 0 22px #38bdf8)" }}/>
          </g>
          <g filter="url(#nGlow)">
            <circle cx="7278" cy="7100" r="130" fill="none" stroke="#f97316" strokeWidth="38" opacity="0.25"/>
            <circle cx="7278" cy="7100" r="50" fill="#f97316" opacity="0.95"
              style={{ filter: "drop-shadow(0 0 22px #f97316)" }}/>
          </g>
          <g filter="url(#nGlow)">
            <circle cx="7278" cy="1900" r="140" fill="none" stroke="#34d399" strokeWidth="38" opacity="0.25"/>
            <circle cx="7278" cy="1900" r="52" fill="#34d399" opacity="0.95"
              style={{ filter: "drop-shadow(0 0 22px #34d399)" }}/>
          </g>
        </g>
        <text x="6200" y="560" fontFamily="'Fira Code',monospace" fontSize="185" fill="#38bdf8" opacity="0.45" letterSpacing="30">SpO₂</text>
        <text x="7700" y="5800" fontFamily="'Fira Code',monospace" fontSize="185" fill="#f97316" opacity="0.45" letterSpacing="30">TEMP</text>
        <text x="7700" y="11300" fontFamily="'Fira Code',monospace" fontSize="185" fill="#34d399" opacity="0.45" letterSpacing="30">FSR</text>
      </svg>
    </div>
  );
}

function BigStatCard({ label, value, unit, color, sub }) {
  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(8,22,50,0.9) 0%, rgba(3,12,28,0.95) 100%)",
      border: `1px solid ${color}28`,
      borderRadius: 16,
      padding: "18px 20px",
      boxShadow: `0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 ${color}18`,
      flex: 1,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
        background: `linear-gradient(90deg, transparent, ${color}66, transparent)`,
      }}/>
      <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, letterSpacing: "0.28em", color: `${color}77`, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 48, color, lineHeight: 1, textShadow: `0 0 32px ${color}88` }}>{value}</span>
        <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 13, color: `${color}66` }}>{unit}</span>
      </div>
      {sub && <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, letterSpacing: "0.12em", color: `${color}55`, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function ParamRow({ label, value, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0",
      borderBottom: "1px solid rgba(56,189,248,0.06)",
      fontFamily: "'Fira Code',monospace", fontSize: 11,
    }}>
      <span style={{ color: "rgba(148,180,210,0.5)", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ color, fontWeight: 500, letterSpacing: "0.06em" }}>{value}</span>
    </div>
  );
}

function SensorRow({ label, ok }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0",
      borderBottom: "1px solid rgba(56,189,248,0.06)",
      fontFamily: "'Fira Code',monospace", fontSize: 11,
    }}>
      <span style={{ color: "rgba(148,180,210,0.5)", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 10px", borderRadius: 5,
        background: ok ? "rgba(52,211,153,0.08)" : "rgba(244,63,94,0.08)",
        border: `1px solid ${ok ? "rgba(52,211,153,0.22)" : "rgba(244,63,94,0.22)"}`,
        color: ok ? "#34d399" : "#f43f5e",
        fontSize: 9, letterSpacing: "0.18em",
        textShadow: ok ? "0 0 8px #34d399" : "0 0 8px #f43f5e",
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: ok ? "#34d399" : "#f43f5e",
          boxShadow: ok ? "0 0 6px #34d399" : "0 0 6px #f43f5e",
          display: "inline-block",
        }}/>
        {ok ? "ONLINE" : "FAULT"}
      </span>
    </div>
  );
}

function SectionHead({ children, color = "#00d4ff", mt = 0 }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      marginTop: mt, marginBottom: 8, paddingBottom: 7,
      borderBottom: `1px solid ${color}1a`,
    }}>
      <div style={{
        width: 3, height: 16, borderRadius: 2,
        background: `linear-gradient(180deg, ${color}, ${color}44)`,
        flexShrink: 0,
      }}/>
      <span style={{
        fontFamily: "'Fira Code',monospace", fontSize: 10, letterSpacing: "0.3em",
        color: `${color}cc`, textTransform: "uppercase",
      }}>{children}</span>
    </div>
  );
}

// ── Contact Doctor Modal ──────────────────────────────────────────────────────
const DOCTORS = [
  { name: "Dr. Priya Sharma", spec: "Podiatry & Biomechanics", status: "available", avatar: "PS", color: "#34d399" },
  { name: "Dr. Arjun Mehta",  spec: "Orthopedic Surgery",       status: "busy",      avatar: "AM", color: "#fbbf24" },
  { name: "Dr. Leila Hassan", spec: "Sports Medicine",          status: "available", avatar: "LH", color: "#34d399" },
];

function ContactDoctorModal({ onClose, alerts }) {
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const urgency = alerts.some(a => a.lvl === "CRIT") ? "CRITICAL" : alerts.some(a => a.lvl === "WARN") ? "WARNING" : "ROUTINE";
  const urgColor = urgency === "CRITICAL" ? "#f43f5e" : urgency === "WARNING" ? "#fbbf24" : "#34d399";

  const handleSend = () => {
    if (!selected) return;
    setSent(true);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(1,6,16,0.85)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 520,
        background: "linear-gradient(145deg, rgba(6,18,44,0.98) 0%, rgba(2,10,26,0.99) 100%)",
        border: "1px solid rgba(56,189,248,0.18)",
        borderRadius: 20,
        boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(56,189,248,0.08), inset 0 1px 0 rgba(56,189,248,0.12)",
        overflow: "hidden",
      }}>
        {/* Modal header */}
        <div style={{
          padding: "18px 22px",
          borderBottom: "1px solid rgba(56,189,248,0.1)",
          background: "rgba(0,180,255,0.03)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 20, fontWeight: 700, color: "#00d4ff", letterSpacing: "0.12em" }}>
              CONTACT PHYSICIAN
            </div>
            <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, color: "rgba(148,180,210,0.4)", letterSpacing: "0.2em", marginTop: 3 }}>
              SECURE TELEMETRY CHANNEL
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.22)",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer",
            color: "#f43f5e", fontFamily: "'Fira Code',monospace", fontSize: 10,
            letterSpacing: "0.15em",
          }}>✕ CLOSE</button>
        </div>

        {sent ? (
          <div style={{ padding: "40px 28px", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(52,211,153,0.12)",
              border: "2px solid rgba(52,211,153,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 18px",
              fontSize: 28, boxShadow: "0 0 32px rgba(52,211,153,0.3)",
            }}>✓</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 22, fontWeight: 700, color: "#34d399", letterSpacing: "0.1em", marginBottom: 10 }}>
              MESSAGE DISPATCHED
            </div>
            <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 10, color: "rgba(148,180,210,0.5)", letterSpacing: "0.1em", lineHeight: 1.8 }}>
              Your session data & telemetry snapshot<br/>
              have been forwarded to {DOCTORS.find(d => d.name === selected)?.name}.<br/>
              Estimated response: 5–15 minutes.
            </div>
            <button onClick={onClose} style={{
              marginTop: 24, padding: "10px 28px",
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
              borderRadius: 10, cursor: "pointer", color: "#34d399",
              fontFamily: "'Fira Code',monospace", fontSize: 10, letterSpacing: "0.15em",
            }}>CLOSE</button>
          </div>
        ) : (
          <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Urgency banner */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: `${urgColor}0c`,
              border: `1px solid ${urgColor}25`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: urgColor, boxShadow: `0 0 10px ${urgColor}`, flexShrink: 0 }}/>
              <div>
                <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, letterSpacing: "0.2em", color: `${urgColor}bb` }}>
                  SESSION PRIORITY
                </div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700, color: urgColor }}>
                  {urgency} — {alerts.length > 0 ? alerts[0].msg : "ALL PARAMETERS NOMINAL"}
                </div>
              </div>
            </div>

            {/* Doctor selection */}
            <div>
              <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, letterSpacing: "0.22em", color: "rgba(148,180,210,0.45)", marginBottom: 10 }}>
                SELECT PHYSICIAN
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DOCTORS.map(doc => (
                  <div key={doc.name} onClick={() => setSelected(doc.name)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 14px", borderRadius: 12, cursor: "pointer",
                    background: selected === doc.name ? "rgba(56,189,248,0.08)" : "rgba(6,18,40,0.7)",
                    border: `1px solid ${selected === doc.name ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.1)"}`,
                    transition: "all 0.18s ease",
                    boxShadow: selected === doc.name ? "0 0 16px rgba(56,189,248,0.08)" : "none",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: `${doc.color}18`,
                      border: `1px solid ${doc.color}35`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13,
                      color: doc.color, flexShrink: 0,
                    }}>{doc.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 700, color: "#ddeeff" }}>{doc.name}</div>
                      <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, color: "rgba(148,180,210,0.45)", letterSpacing: "0.1em" }}>{doc.spec}</div>
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 5,
                      background: `${doc.color}10`,
                      border: `1px solid ${doc.color}28`,
                      color: doc.color, fontFamily: "'Fira Code',monospace", fontSize: 8, letterSpacing: "0.15em",
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: doc.color, boxShadow: `0 0 5px ${doc.color}` }}/>
                      {doc.status.toUpperCase()}
                    </div>
                    {selected === doc.name && (
                      <div style={{ color: "#38bdf8", fontFamily: "'Fira Code',monospace", fontSize: 16 }}>✓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, letterSpacing: "0.22em", color: "rgba(148,180,210,0.45)", marginBottom: 8 }}>
                ADDITIONAL NOTES (OPTIONAL)
              </div>
              <textarea value={msg} onChange={e => setMsg(e.target.value)}
                placeholder="Describe any symptoms or concerns…"
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(3,12,28,0.9)", border: "1px solid rgba(56,189,248,0.15)",
                  borderRadius: 10, padding: "10px 13px",
                  color: "#c8dff0", fontFamily: "'Fira Code',monospace", fontSize: 11,
                  resize: "none", outline: "none", lineHeight: 1.6,
                }}/>
            </div>

            {/* Send */}
            <button onClick={handleSend} disabled={!selected} style={{
              padding: "13px",
              background: selected ? "linear-gradient(135deg, rgba(0,180,255,0.18), rgba(0,120,200,0.12))" : "rgba(10,24,50,0.6)",
              border: `1px solid ${selected ? "rgba(56,189,248,0.4)" : "rgba(56,189,248,0.1)"}`,
              borderRadius: 12, cursor: selected ? "pointer" : "not-allowed",
              color: selected ? "#00d4ff" : "rgba(148,180,210,0.25)",
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 15,
              letterSpacing: "0.2em",
              boxShadow: selected ? "0 0 20px rgba(0,180,255,0.1), inset 0 1px 0 rgba(56,189,248,0.15)" : "none",
              transition: "all 0.2s ease",
            }}>
              {selected ? "▶  SEND TELEMETRY REPORT" : "SELECT A PHYSICIAN FIRST"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Simulated data for demo mode ──────────────────────────────────────────────
function simStep(prev) {
  const spo2 = Math.max(94, Math.min(100, prev.spo2 + (Math.random() - 0.48) * 0.4));
  const temp = Math.max(35.5, Math.min(38.2, prev.temp + (Math.random() - 0.5) * 0.05));
  const motion = Math.max(0, prev.motion + (Math.random() - 0.5) * 0.3);
  const heel = Math.max(0, Math.min(900, prev.heel + (Math.random() - 0.5) * 40));
  return { spo2, temp, motion, heel, finger: true };
}

export default function App() {
  const socketRef = useRef(null);
  const retriesRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [time, setTime] = useState(new Date());
  const [sec, setSec] = useState(0);

  const [data, setData] = useState({ spo2: 98.2, temp: 36.6, motion: 0.12, heel: 210, finger: true });
  const [spo2H, setSpo2H] = useState(Array(HIST).fill(98.2));
  const [tempH, setTempH] = useState(Array(HIST).fill(36.6));
  const [motionH, setMotionH] = useState(Array(HIST).fill(0));
  const [heelH, setHeelH] = useState(Array(HIST).fill(0));

  // Clock
  useEffect(() => {
    const t = setInterval(() => { setTime(new Date()); setSec(s => s + 1); }, 1000);
    return () => clearInterval(t);
  }, []);

  // WebSocket with limited retries → fallback to demo
  useEffect(() => {
    let timer;
    const connect = () => {
      if (retriesRef.current >= MAX_RETRIES) {
        setDemoMode(true);
        return;
      }
      retriesRef.current += 1;
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;
      ws.onopen = () => { setConnected(true); retriesRef.current = 0; setDemoMode(false); };
      ws.onclose = () => {
        setConnected(false);
        if (retriesRef.current < MAX_RETRIES) {
          timer = setTimeout(connect, 3000);
        } else {
          setDemoMode(true);
        }
      };
      ws.onerror = () => {};
      ws.onmessage = ({ data: raw }) => {
        try {
          const d = JSON.parse(raw);
          const spo2 = Number(d.spo2 || 0);
          const temp = Number(d.temp || 0);
          const motion = Number(d.motion || 0);
          const heel = Number(d.heel || 0);
          setData({ spo2, temp, motion, heel, finger: Boolean(d.finger) });
          setSpo2H(p => [...p.slice(-(HIST - 1)), spo2]);
          setTempH(p => [...p.slice(-(HIST - 1)), temp]);
          setMotionH(p => [...p.slice(-(HIST - 1)), motion]);
          setHeelH(p => [...p.slice(-(HIST - 1)), heel]);
        } catch {}
      };
    };
    connect();
    return () => { clearTimeout(timer); socketRef.current?.close(); };
  }, []);

  // Demo mode simulation
  useEffect(() => {
    if (!demoMode) return;
    const interval = setInterval(() => {
      setData(prev => {
        const next = simStep(prev);
        setSpo2H(p => [...p.slice(-(HIST - 1)), next.spo2]);
        setTempH(p => [...p.slice(-(HIST - 1)), next.temp]);
        setMotionH(p => [...p.slice(-(HIST - 1)), next.motion]);
        setHeelH(p => [...p.slice(-(HIST - 1)), next.heel]);
        return next;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [demoMode]);

  const alerts = useMemo(() => {
    const a = [];
    if (!connected && !demoMode) a.push({ lvl: "CRIT", msg: "TELEMETRY LINK LOST" });
    if ((connected || demoMode) && !data.finger) a.push({ lvl: "WARN", msg: "FINGER ABSENT — SpO₂ UNRELIABLE" });
    if (data.spo2 > 0 && data.spo2 < 95) a.push({ lvl: "CRIT", msg: `SpO₂ CRITICAL LOW: ${data.spo2.toFixed(1)}%` });
    else if (data.spo2 > 0 && data.spo2 < 98) a.push({ lvl: "WARN", msg: `SpO₂ LOW: ${data.spo2.toFixed(1)}%` });
    if (data.temp > 37.5) a.push({ lvl: "WARN", msg: `TEMP ELEVATED: ${data.temp.toFixed(1)}°C` });
    if (data.heel > 600) a.push({ lvl: "INFO", msg: `HIGH HEEL LOAD: ${data.heel.toFixed(0)}` });
    return a;
  }, [connected, demoMode, data]);

  const fmt = s =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const isLive = connected || demoMode;

  return (
    <div style={{
      minHeight: "100vh", background: "#020c18", color: "#8aafc8",
      overflow: "hidden", display: "flex", flexDirection: "column",
      "--mono": "'Fira Code','Courier New',monospace",
      "--display": "'Rajdhani',sans-serif",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Fira+Code:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.92)} }
        @keyframes scan   { 0%{top:-4px} 100%{top:100%} }
        @keyframes shimmer { 0%{left:-100%} 100%{left:200%} }
        .blink { animation: blink 1.1s ease-in-out infinite; }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }
        .scanline::after {
          content: '';
          position: fixed; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.04) 50%, transparent 100%);
          animation: scan 8s linear infinite;
          pointer-events: none; z-index: 9999;
        }
        .bg-grid {
          background-image: radial-gradient(circle, rgba(56,189,248,0.06) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.15); border-radius: 2px; }
        .metric-card { transition: transform 0.2s ease; }
        .metric-card:hover { transform: translateY(-2px); }
        .contact-btn:hover { background: rgba(0,180,255,0.15) !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,180,255,0.15) !important; }
        textarea::placeholder { color: rgba(148,180,210,0.28); }
      `}</style>

      <div className="bg-grid scanline" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}/>
      <div style={{
        position: "fixed", top: -150, left: "15%", right: "15%", height: 300,
        background: "radial-gradient(ellipse, rgba(0,180,255,0.05) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }}/>

      {/* ── HEADER ── */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 28px", height: 60,
        borderBottom: "1px solid rgba(56,189,248,0.1)",
        background: "rgba(2,10,24,0.96)", backdropFilter: "blur(12px)",
        flexShrink: 0, position: "relative", zIndex: 10,
      }}>
        <div style={{
          position: "absolute", bottom: -1, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.35) 30%, rgba(0,212,255,0.6) 50%, rgba(0,212,255,0.35) 70%, transparent 100%)",
        }}/>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 30,10 30,22 16,30 2,22 2,10" fill="none" stroke="#00d4ff" strokeWidth="1.2" opacity="0.6"/>
            <polygon points="16,7 25,12 25,20 16,25 7,20 7,12" fill="rgba(0,212,255,0.08)" stroke="#00d4ff" strokeWidth="1" opacity="0.4"/>
            <circle cx="16" cy="16" r="3.5" fill="#00d4ff" style={{ filter: "drop-shadow(0 0 6px #00d4ff)" }}/>
            <line x1="16" y1="2" x2="16" y2="7" stroke="#00d4ff" strokeWidth="1" opacity="0.5"/>
            <line x1="16" y1="25" x2="16" y2="30" stroke="#00d4ff" strokeWidth="1" opacity="0.5"/>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 19, fontWeight: 700, color: "#00d4ff", letterSpacing: "0.22em", textShadow: "0 0 24px rgba(0,212,255,0.6)" }}>
              NEUROSOLE
            </span>
            <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 8, color: "rgba(148,180,210,0.35)", letterSpacing: "0.25em" }}>
              PODIATRIC TELEMETRY v2.1
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {[{ label: "VITALS", color: "#38bdf8" }, { label: "PRESSURE", color: "#34d399" }, { label: "MOTION", color: "#a78bfa" }].map(({ label, color }) => (
            <div key={label} style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, letterSpacing: "0.22em", color: `${color}80`, display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: color, opacity: 0.7, boxShadow: `0 0 6px ${color}` }}/>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Contact Doctor button */}
          <button className="contact-btn" onClick={() => setShowContact(true)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,180,255,0.08)",
            border: "1px solid rgba(56,189,248,0.3)",
            cursor: "pointer", color: "#38bdf8",
            fontFamily: "'Fira Code',monospace", fontSize: 10, letterSpacing: "0.14em",
            boxShadow: "0 4px 16px rgba(0,180,255,0.08), inset 0 1px 0 rgba(56,189,248,0.1)",
            transition: "all 0.2s ease",
          }}>
            <span style={{ fontSize: 14 }}>⊕</span> CONTACT DOCTOR
          </button>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 21, fontWeight: 700, color: "#e2edff", letterSpacing: "0.06em", lineHeight: 1 }}>
              {time.toLocaleTimeString("en-GB")}
            </div>
            <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 8, color: "rgba(148,180,210,0.38)", letterSpacing: "0.14em", marginTop: 2 }}>
              {time.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              &nbsp; REC {fmt(sec)}
            </div>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "7px 14px", borderRadius: 8,
            border: `1px solid ${isLive ? "rgba(52,211,153,0.25)" : "rgba(244,63,94,0.25)"}`,
            background: isLive ? "rgba(52,211,153,0.06)" : "rgba(244,63,94,0.06)",
            boxShadow: isLive ? "0 0 16px rgba(52,211,153,0.08)" : "0 0 16px rgba(244,63,94,0.08)",
          }}>
            <div className="pulse-dot" style={{
              width: 7, height: 7, borderRadius: "50%",
              background: isLive ? "#34d399" : "#f43f5e",
              boxShadow: isLive ? "0 0 10px #34d399" : "0 0 10px #f43f5e",
            }}/>
            <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 9, letterSpacing: "0.2em", color: isLive ? "#34d399" : "#f43f5e" }}>
              {demoMode ? "DEMO" : connected ? "LIVE" : "NO SIGNAL"}
            </span>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "340px 1fr 340px",
        minHeight: 0, position: "relative", zIndex: 1,
      }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          borderRight: "1px solid rgba(56,189,248,0.08)",
          background: "rgba(3,12,28,0.78)",
          backdropFilter: "blur(8px)",
          padding: "18px 16px",
          display: "flex", flexDirection: "column", gap: 12,
          overflowY: "auto",
        }}>
          <SectionHead color="#38bdf8">Vital Signs</SectionHead>

          {/* Big stat row */}
          <div style={{ display: "flex", gap: 10 }}>
            <BigStatCard label="SpO₂" value={data.spo2.toFixed(1)} unit="%" color={data.spo2 < 95 ? "#f43f5e" : "#38bdf8"} sub={`NORM: 95–100%`}/>
            <BigStatCard label="Temp" value={data.temp.toFixed(1)} unit="°C" color={data.temp > 37.5 ? "#f43f5e" : "#f97316"} sub={`NORM: 36.1–37.5°C`}/>
          </div>

          <div className="metric-card">
            <EcgCard title="SpO₂ — Blood Oxygen" value={data.spo2.toFixed(1)} unit="%" color="#38bdf8" history={spo2H} normalMin={95} normalMax={100}/>
          </div>

          <div className="metric-card">
            <EcgCard title="Skin Temperature" value={data.temp.toFixed(1)} unit="°C" color="#f97316" history={tempH} normalMin={36.1} normalMax={37.5}/>
          </div>

          <SectionHead color="#00d4ff" mt={6}>Parameters</SectionHead>
          <ParamRow label="SpO₂ Threshold" value="95.0 %" color="#38bdf8"/>
          <ParamRow label="Temp Normal" value="36.1–37.5 °C" color="#f97316"/>
          <ParamRow label="Sample Rate" value="60 Hz" color="#00d4ff"/>
          <ParamRow label="Filter" value="IIR LP" color="#00d4ff"/>
          <ParamRow label="Window" value="4 samples" color="#00d4ff"/>

          <SectionHead color="#00d4ff" mt={6}>Session Stats</SectionHead>
          <ParamRow label="SpO₂ Min" value={`${Math.min(...spo2H.filter(v => v > 0), 100).toFixed(1)} %`} color="#38bdf8"/>
          <ParamRow label="SpO₂ Max" value={`${Math.max(...spo2H).toFixed(1)} %`} color="#38bdf8"/>
          <ParamRow label="Peak Heel Load" value={`${Math.max(...heelH).toFixed(0)}`} color="#34d399"/>
        </div>

        {/* ── CENTER ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px", gap: 14, overflowY: "auto",
          background: "radial-gradient(ellipse 60% 65% at 50% 45%, rgba(0,120,200,0.04) 0%, transparent 70%)",
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{
              position: "absolute", inset: -30, borderRadius: "50%",
              border: "1px solid rgba(56,189,248,0.04)", pointerEvents: "none",
            }}/>
            <FootDiagram heel={data.heel}/>
          </div>

          <div style={{ width: "100%" }}>
            <SectionHead color="#a78bfa">Motion — IMU Accelerometer</SectionHead>
            <div className="metric-card">
              <EcgCard title="Motion" value={data.motion.toFixed(2)} unit="m/s²" color="#a78bfa" history={motionH} wide/>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          borderLeft: "1px solid rgba(56,189,248,0.08)",
          background: "rgba(3,12,28,0.78)",
          backdropFilter: "blur(8px)",
          padding: "18px 16px",
          display: "flex", flexDirection: "column", gap: 12,
          overflowY: "auto",
        }}>
          <SectionHead color="#34d399">Plantar Pressure</SectionHead>

          {/* Big stat row */}
          <div style={{ display: "flex", gap: 10 }}>
            <BigStatCard label="Heel FSR" value={data.heel.toFixed(0)} unit="" color={data.heel > 600 ? "#fbbf24" : "#34d399"} sub={`PEAK: ${Math.max(...heelH).toFixed(0)}`}/>
            <BigStatCard label="Motion" value={data.motion.toFixed(2)} unit="m/s²" color="#a78bfa" sub={data.motion > 0.5 ? "WALKING" : "STATIC"}/>
          </div>

          <div className="metric-card">
            <EcgCard title="FSR Heel Load" value={data.heel.toFixed(0)} unit="" color="#34d399" history={heelH}/>
          </div>

          <div className="metric-card">
            <EcgCard title="IMU Motion" value={data.motion.toFixed(2)} unit="m/s²" color="#a78bfa" history={motionH}/>
          </div>

          <SectionHead color="#00d4ff" mt={6}>Pressure Metrics</SectionHead>
          <ParamRow label="Heel Load" value={`${data.heel.toFixed(0)}`} color="#34d399"/>
          <ParamRow label="Peak Load" value={`${Math.max(...heelH).toFixed(0)}`} color="#34d399"/>
          <ParamRow label="Motion RMS" value={`${data.motion.toFixed(2)} m/s²`} color="#a78bfa"/>
          <ParamRow label="Cadence" value={data.motion > 0.5 ? "WALKING" : "STATIC"} color="#a78bfa"/>

          <SectionHead color="#f43f5e" mt={6}>Alerts</SectionHead>
          {alerts.length === 0 ? (
            <div style={{
              padding: "11px 14px", borderRadius: 10,
              border: "1px solid rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.05)",
              fontFamily: "'Fira Code',monospace", fontSize: 10,
              color: "#34d399", letterSpacing: "0.1em",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "inset 0 1px 0 rgba(52,211,153,0.1)",
            }}>
              <span style={{ fontSize: 15 }}>✓</span>
              ALL PARAMETERS NOMINAL
            </div>
          ) : alerts.map((a, i) => {
            const lvlColor = a.lvl === "CRIT" ? "#f43f5e" : a.lvl === "WARN" ? "#fbbf24" : "#38bdf8";
            const icon = a.lvl === "CRIT" ? "⚠" : a.lvl === "WARN" ? "▲" : "ℹ";
            return (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: 10,
                border: `1px solid ${lvlColor}22`, borderLeft: `3px solid ${lvlColor}`,
                background: `${lvlColor}07`,
                fontFamily: "'Fira Code',monospace", fontSize: 10,
                color: lvlColor, letterSpacing: "0.08em",
                display: "flex", alignItems: "center", gap: 8,
              }} className={a.lvl === "CRIT" ? "blink" : ""}>
                <span>{icon}</span>{a.msg}
              </div>
            );
          })}

          <SectionHead color="#00d4ff" mt={6}>Sensor Status</SectionHead>
          <SensorRow label="MAX30102 SpO₂" ok={isLive && data.finger}/>
          <SensorRow label="DS18B20 TEMP" ok={isLive && data.temp > 0}/>
          <SensorRow label="MPU6050 IMU" ok={isLive}/>
          <SensorRow label="FSR HEEL PAD" ok={isLive}/>
          <SensorRow label="WS GATEWAY" ok={connected}/>

          {/* Quick contact panel */}
          <SectionHead color="#38bdf8" mt={6}>Physician On-Call</SectionHead>
          <div style={{
            padding: "14px 14px",
            background: "linear-gradient(145deg, rgba(6,18,44,0.9), rgba(2,10,26,0.95))",
            border: "1px solid rgba(56,189,248,0.14)",
            borderRadius: 14,
          }}>
            {DOCTORS.filter(d => d.status === "available").map(doc => (
              <div key={doc.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: `${doc.color}18`, border: `1px solid ${doc.color}35`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11, color: doc.color,
                }}>{doc.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 700, color: "#ddeeff" }}>{doc.name}</div>
                  <div style={{ fontFamily: "'Fira Code',monospace", fontSize: 8, color: "rgba(148,180,210,0.4)" }}>{doc.spec}</div>
                </div>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: doc.color, boxShadow: `0 0 8px ${doc.color}`,
                }} className="pulse-dot"/>
              </div>
            ))}
            <button className="contact-btn" onClick={() => setShowContact(true)} style={{
              width: "100%", padding: "10px", marginTop: 2,
              background: "rgba(0,180,255,0.08)", border: "1px solid rgba(56,189,248,0.25)",
              borderRadius: 10, cursor: "pointer", color: "#38bdf8",
              fontFamily: "'Fira Code',monospace", fontSize: 10, letterSpacing: "0.15em",
              boxShadow: "inset 0 1px 0 rgba(56,189,248,0.08)",
              transition: "all 0.2s ease",
            }}>
              ⊕ OPEN CONTACT PANEL
            </button>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "7px 28px",
        borderTop: "1px solid rgba(56,189,248,0.08)",
        background: "rgba(2,8,18,0.94)",
        backdropFilter: "blur(8px)",
        fontFamily: "'Fira Code',monospace", fontSize: 9,
        color: "rgba(148,180,210,0.25)", letterSpacing: "0.16em",
        flexShrink: 0, position: "relative", zIndex: 10,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.15) 50%, transparent)" }}/>
        <span>NEUROSOLE — RESEARCH PROTOTYPE · NOT FOR CLINICAL DECISIONS</span>
        <span style={{ color: "rgba(148,180,210,0.15)" }}>{demoMode ? "DEMO MODE — WS UNAVAILABLE" : WS_URL}</span>
      </footer>

      {/* ── CONTACT MODAL ── */}
      {showContact && <ContactDoctorModal onClose={() => setShowContact(false)} alerts={alerts}/>}
    </div>
  );
}