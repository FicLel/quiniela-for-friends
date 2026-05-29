'use client'

export default function SoccerAnimation() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-8">
      {/* Soccer ball with bounce animation */}
      <div className="animate-bounce">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          {/* Ball circle */}
          <circle cx="60" cy="60" r="56" fill="white" stroke="#1a1a1a" strokeWidth="4" />

          {/* Centre pentagon (black) */}
          <polygon
            points="60,30 73,52 66,76 54,76 47,52"
            fill="#1a1a1a"
          />

          {/* Top-left patch */}
          <polygon
            points="30,42 42,34 50,50 38,56 26,52"
            fill="#1a1a1a"
          />

          {/* Top-right patch */}
          <polygon
            points="90,42 78,34 70,50 82,56 94,52"
            fill="#1a1a1a"
          />

          {/* Bottom-left patch */}
          <polygon
            points="32,78 44,86 50,72 38,64 26,68"
            fill="#1a1a1a"
          />

          {/* Bottom-right patch */}
          <polygon
            points="88,78 76,86 70,72 82,64 94,68"
            fill="#1a1a1a"
          />

          {/* Bottom patch */}
          <polygon
            points="60,96 47,88 50,74 70,74 73,88"
            fill="#1a1a1a"
          />
        </svg>
      </div>

      {/* Goal frame with pulse animation */}
      <div className="animate-pulse">
        <svg
          width="200"
          height="130"
          viewBox="0 0 200 130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          {/* Grass base */}
          <rect x="0" y="110" width="200" height="20" fill="#15803d" rx="2" />

          {/* Goal frame — posts and crossbar */}
          <rect x="20" y="20" width="8" height="90" fill="white" stroke="#d1d5db" strokeWidth="1" rx="2" />
          <rect x="172" y="20" width="8" height="90" fill="white" stroke="#d1d5db" strokeWidth="1" rx="2" />
          <rect x="20" y="20" width="160" height="8" fill="white" stroke="#d1d5db" strokeWidth="1" rx="2" />

          {/* Net — vertical lines */}
          <line x1="44" y1="28" x2="44" y2="110" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="64" y1="28" x2="64" y2="110" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="84" y1="28" x2="84" y2="110" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="104" y1="28" x2="104" y2="110" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="124" y1="28" x2="124" y2="110" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="144" y1="28" x2="144" y2="110" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="164" y1="28" x2="164" y2="110" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />

          {/* Net — horizontal lines */}
          <line x1="28" y1="44" x2="172" y2="44" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="28" y1="64" x2="172" y2="64" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="28" y1="84" x2="172" y2="84" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />

          {/* Field markings on grass */}
          <line x1="100" y1="110" x2="100" y2="130" stroke="white" strokeWidth="2" opacity="0.6" />
          <rect x="60" y="110" width="80" height="12" stroke="white" strokeWidth="2" fill="none" opacity="0.4" />
        </svg>
      </div>

      {/* Tagline */}
      <p className="text-lg font-semibold tracking-wide text-green-100">
        Your match. Your predictions.
      </p>
    </div>
  )
}
