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

      {/* Students */}
      <g>
        <circle cx="200" cy="286" r="16" fill="#ef4444" stroke="#1e3a8a" strokeWidth="3" />
        <circle cx="195" cy="282" r="2.5" fill="#1e3a8a" />
        <circle cx="205" cy="282" r="2.5" fill="#1e3a8a" />
        <path d="M194 291 q6 5 12 0" stroke="#1e3a8a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M178 290 h-14 M180 298 h-20" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      </g>
      <g>
        <circle cx="246" cy="300" r="16" fill="#2563eb" stroke="#1e3a8a" strokeWidth="3" />
        <circle cx="241" cy="296" r="2.5" fill="#fff" />
        <circle cx="251" cy="296" r="2.5" fill="#fff" />
        <path d="M240 305 q6 5 12 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <text x="236" y="276" fontSize="16">🍪</text>
      </g>

      {/* Prefect */}
      <g>
        <circle cx="96" cy="300" r="17" fill="#334155" stroke="#1e3a8a" strokeWidth="3" />
        <path d="M84 290 L108 312" stroke="#facc15" strokeWidth="6" />
        <circle cx="91" cy="296" r="2.5" fill="#fff" />
        <circle cx="101" cy="296" r="2.5" fill="#fff" />
        <rect x="68" y="320" width="56" height="18" rx="9" fill="#fff" stroke="#1e3a8a" strokeWidth="2.5" />
        <text x="96" y="333" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1e3a8a">PREFECT</text>
      </g>
    </svg>
  );
}
