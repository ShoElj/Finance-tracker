/** Cartoon school scene for the landing page: classroom, corridor, canteen, bell, snacks and students. */
export function SchoolIllustration() {
  return (
    <svg viewBox="0 0 480 360" role="img" aria-labelledby="school-illustration-title" className="h-auto w-full">
      <title id="school-illustration-title">
        Cartoon school with a classroom, a ringing bell, a canteen full of snacks, students running and a prefect on patrol
      </title>
      <rect width="480" height="360" rx="28" fill="#dbeafe" />
      <circle cx="420" cy="54" r="26" fill="#facc15" />
      <ellipse cx="110" cy="60" rx="46" ry="16" fill="#fff" opacity="0.9" />
      <ellipse cx="250" cy="42" rx="34" ry="12" fill="#fff" opacity="0.8" />
      <rect y="250" width="480" height="110" fill="#86d36b" />
      <path d="M0 268 Q240 240 480 268 V360 H0Z" fill="#6cc04f" />

      {/* Classroom block */}
      <rect x="28" y="110" width="200" height="150" rx="10" fill="#fde68a" stroke="#1e3a8a" strokeWidth="4" />
      <path d="M18 116 L128 64 L238 116 Z" fill="#ef4444" stroke="#1e3a8a" strokeWidth="4" strokeLinejoin="round" />
      <rect x="96" y="80" width="64" height="22" rx="6" fill="#fff" stroke="#1e3a8a" strokeWidth="3" />
      <text x="128" y="96" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1e3a8a">SCHOOL</text>
      {[48, 104, 160].map((x) => (
        <rect key={x} x={x} y="130" width="44" height="36" rx="5" fill="#bfdbfe" stroke="#1e3a8a" strokeWidth="3" />
      ))}
      <rect x="104" y="196" width="44" height="64" rx="6" fill="#92400e" stroke="#1e3a8a" strokeWidth="3" />
      <circle cx="140" cy="230" r="3" fill="#facc15" />

      {/* Bell */}
      <g transform="translate(206 52) rotate(-14)">
        <path d="M0 30 Q0 4 18 2 Q36 4 36 30 L40 36 H-4 Z" fill="#facc15" stroke="#1e3a8a" strokeWidth="3.5" strokeLinejoin="round" />
        <circle cx="18" cy="40" r="5" fill="#1e3a8a" />
        <path d="M-12 8 l-8 -6 M-14 22 h-10 M50 8 l8 -6 M52 22 h10" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Canteen stall */}
      <rect x="292" y="150" width="160" height="110" rx="8" fill="#fff7ed" stroke="#1e3a8a" strokeWidth="4" />
      <path d="M282 150 h180 l-10 -34 h-160 Z" fill="#22c55e" stroke="#1e3a8a" strokeWidth="4" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${292 + i * 32} 150 q16 18 32 0`} fill={i % 2 ? "#22c55e" : "#fff"} stroke="#1e3a8a" strokeWidth="3" />
      ))}
      <text x="372" y="140" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">CANTEEN</text>
      <rect x="300" y="208" width="144" height="16" rx="4" fill="#a16207" stroke="#1e3a8a" strokeWidth="3" />
      <text x="322" y="204" fontSize="22">🍩</text>
      <text x="356" y="204" fontSize="22">🥧</text>
      <text x="390" y="204" fontSize="22">🍜</text>
      <text x="420" y="204" fontSize="20">🥤</text>

      {/* Path */}
      <path d="M126 260 Q220 300 300 262" stroke="#e5d3b3" strokeWidth="26" fill="none" strokeLinecap="round" />

      {/* Students running to the canteen */}
      <Person x={196} y={262} shirt="#ef4444" bottom="#1e3a8a" skin="#8d5524" stride={1} />
      <Person x={246} y={274} shirt="#2563eb" bottom="#b08d57" skin="#6b3e1f" stride={-1} puffs />
      <text x="262" y="268" fontSize="16">🍪</text>

      {/* Prefect on patrol */}
      <Person x={96} y={272} shirt="#f8fafc" bottom="#1e3a8a" skin="#5c3317" stride={0} sash trousers />
      <rect x="68" y="324" width="56" height="18" rx="9" fill="#fff" stroke="#1e3a8a" strokeWidth="2.5" />
      <text x="96" y="337" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1e3a8a">PREFECT</text>
    </svg>
  );
}

/** A small cartoon student in school uniform; (x, y) is the top of the head. */
function Person({
  x,
  y,
  shirt,
  bottom,
  skin,
  stride,
  puffs = false,
  sash = false,
  trousers = false,
}: {
  x: number;
  y: number;
  shirt: string;
  bottom: string;
  skin: string;
  stride: number;
  puffs?: boolean;
  sash?: boolean;
  trousers?: boolean;
}) {
  const ink = { stroke: "#1e3a8a", strokeWidth: 2.5, strokeLinejoin: "round" as const };
  const legColor = trousers ? bottom : skin;
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="52" rx="14" ry="4" fill="#000" opacity="0.15" />
      <rect x="-7" y="34" width="5" height="16" rx="2" fill={legColor} {...ink} transform={`rotate(${stride * 18} -4.5 34)`} />
      <rect x="2" y="34" width="5" height="16" rx="2" fill={legColor} {...ink} transform={`rotate(${-stride * 18} 4.5 34)`} />
      <rect x="-14" y="21" width="5" height="13" rx="2.5" fill={shirt} {...ink} transform={`rotate(${20 + stride * 25} -11.5 21)`} />
      <rect x="9" y="21" width="5" height="13" rx="2.5" fill={shirt} {...ink} transform={`rotate(${-20 - stride * 25} 11.5 21)`} />
      <rect x="-9" y="30" width="18" height="8" rx="2" fill={bottom} {...ink} />
      <rect x="-10" y="19" width="20" height="15" rx="5" fill={shirt} {...ink} />
      {sash && <path d="M-8 20 L8 33" stroke="#dc2626" strokeWidth="4" />}
      {puffs && (
        <>
          <circle cx="-10" cy="1" r="5" fill="#1c1209" {...ink} />
          <circle cx="10" cy="1" r="5" fill="#1c1209" {...ink} />
        </>
      )}
      <circle cx="0" cy="9" r="11" fill={skin} {...ink} />
      <path d="M-11 9 Q-11 -2 0 -2 Q11 -2 11 9 Q8 3 0 3 Q-8 3 -11 9 Z" fill="#1c1209" {...ink} />
      <circle cx="-4" cy="10" r="1.6" fill="#1e293b" />
      <circle cx="4" cy="10" r="1.6" fill="#1e293b" />
      <path d="M-3.5 14 Q0 17 3.5 14" stroke="#1e293b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  );
}
