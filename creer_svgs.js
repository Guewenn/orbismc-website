const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'public', 'img');

const svgs = {
  'gemmes-tas.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
    <defs>
      <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00d2ff" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#00d2ff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="c1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#70f3ff"/><stop offset="50%" stop-color="#00b4d8"/><stop offset="100%" stop-color="#0077b6"/>
      </linearGradient>
      <linearGradient id="c2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#caf0f8"/><stop offset="50%" stop-color="#90e0ef"/><stop offset="100%" stop-color="#0096c7"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="115" r="75" fill="url(#glow1)"/>
    <polygon points="45,140 68,95 95,108 98,145 60,155" fill="url(#c1)"/>
    <polygon points="68,95 82,85 95,108" fill="#e0f7fa"/>
    <polygon points="105,145 125,90 155,102 148,148 118,155" fill="url(#c2)"/>
    <polygon points="125,90 138,78 155,102" fill="#e0f7fa"/>
    <polygon points="75,130 100,55 130,70 120,138 90,148" fill="url(#c1)"/>
    <polygon points="100,55 116,42 130,70" fill="#ffffff"/>
    <polygon points="75,130 100,55 92,135" fill="#90e0ef" opacity="0.8"/>
    <polygon points="135,55 138,45 141,55 151,58 141,61 138,71 135,61 125,58" fill="#ffffff"/>
    <polygon points="55,85 57,78 59,85 66,87 59,89 57,96 55,89 48,87" fill="#ffffff"/>
  </svg>`,

  'gemmes-bourse.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
    <defs>
      <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00d2ff" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#00d2ff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="pouch" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8b263e"/><stop offset="50%" stop-color="#5c1d2e"/><stop offset="100%" stop-color="#3d131e"/>
      </linearGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffe494"/><stop offset="100%" stop-color="#c99738"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="115" r="75" fill="url(#glow2)"/>
    <!-- Pouch Body -->
    <path d="M50 130 C45 165 70 175 100 175 C130 175 155 165 150 130 C145 105 125 100 120 95 C125 80 130 75 125 70 C115 65 110 75 100 75 C90 75 85 65 75 70 C70 75 75 80 80 95 C75 100 55 105 50 130 Z" fill="url(#pouch)"/>
    <!-- Rope -->
    <path d="M78 95 C90 98 110 98 122 95 C125 97 122 101 120 102 C108 105 92 105 80 102 Z" fill="url(#gold)"/>
    <path d="M98 100 L95 125 M102 100 L108 122" stroke="url(#gold)" stroke-width="3" stroke-linecap="round"/>
    <!-- Crystals overflowing -->
    <polygon points="85,75 95,50 110,58 105,80" fill="#00d2ff"/>
    <polygon points="95,50 104,42 110,58" fill="#caf0f8"/>
    <polygon points="108,70 120,48 132,60 122,78" fill="#70f3ff"/>
    <polygon points="120,48 128,42 132,60" fill="#ffffff"/>
    <polygon points="70,82 78,65 90,75 82,88" fill="#0096c7"/>
    <!-- Sparkles -->
    <polygon points="140,45 142,38 144,45 151,47 144,49 142,56 140,49 133,47" fill="#ffffff"/>
  </svg>`,

  'gemmes-coffre.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
    <defs>
      <radialGradient id="glow3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00d2ff" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#00d2ff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="chestWood" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#c87d32"/><stop offset="50%" stop-color="#96521a"/><stop offset="100%" stop-color="#5c2e0b"/>
      </linearGradient>
      <linearGradient id="chestGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffe682"/><stop offset="50%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8a6714"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="110" r="85" fill="url(#glow3)"/>
    <!-- Lower Chest Base -->
    <rect x="40" y="115" width="120" height="55" rx="6" fill="url(#chestWood)"/>
    <rect x="36" y="112" width="128" height="8" rx="2" fill="url(#chestGold)"/>
    <rect x="40" y="115" width="12" height="55" fill="url(#chestGold)"/>
    <rect x="148" y="115" width="12" height="55" fill="url(#chestGold)"/>
    <rect x="94" y="115" width="12" height="55" fill="url(#chestGold)"/>
    <!-- Lock -->
    <rect x="92" y="114" width="16" height="18" rx="3" fill="#ffeaa7"/>
    <circle cx="100" cy="122" r="3" fill="#2d3436"/>
    <!-- Open Lid Raised Up -->
    <path d="M38 90 L100 45 L162 90 L155 105 L100 65 L45 105 Z" fill="url(#chestWood)"/>
    <path d="M36 88 L100 43 L164 88 L158 96 L100 53 L42 96 Z" fill="url(#chestGold)"/>
    <!-- Giant Crystal Heap Inside -->
    <polygon points="55,115 75,85 105,95 95,120" fill="#00b4d8"/>
    <polygon points="75,85 88,72 105,95" fill="#caf0f8"/>
    <polygon points="90,115 110,75 140,85 130,120" fill="#70f3ff"/>
    <polygon points="110,75 125,60 140,85" fill="#ffffff"/>
    <polygon points="125,115 145,88 160,98 150,122" fill="#0096c7"/>
    <!-- Floating Sparkles -->
    <polygon points="60,65 62,58 64,65 71,67 64,69 62,76 60,69 53,67" fill="#ffffff"/>
    <polygon points="145,50 147,42 149,50 157,52 149,54 147,62 145,54 137,52" fill="#ffffff"/>
  </svg>`,

  'badge-vip.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
    <defs>
      <radialGradient id="vGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#2ecc71" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#2ecc71" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="vCard" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#27ae60"/><stop offset="50%" stop-color="#2ecc71"/><stop offset="100%" stop-color="#1abc9c"/>
      </linearGradient>
      <linearGradient id="ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e74c3c"/><stop offset="100%" stop-color="#c0392b"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="115" r="75" fill="url(#vGlow)"/>
    <!-- Ribbon / Lanyard -->
    <path d="M70 15 C85 50 88 85 92 95 M130 15 C115 50 112 85 108 95" stroke="url(#ribbon)" stroke-width="12" stroke-linecap="round"/>
    <rect x="88" y="90" width="24" height="12" rx="3" fill="#bdc3c7"/>
    <!-- Card Body -->
    <rect x="58" y="98" width="84" height="88" rx="10" fill="url(#vCard)" stroke="#a3e4d7" stroke-width="3"/>
    <!-- Text VIP -->
    <text x="100" y="152" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="2">VIP</text>
    <polygon points="100,112 104,122 114,122 106,128 109,138 100,132 91,138 94,128 86,122 96,122" fill="#f1c40f"/>
  </svg>`,

  'badge-elite.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
    <defs>
      <radialGradient id="eGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#3498db" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#3498db" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="eCard" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2980b9"/><stop offset="50%" stop-color="#3498db"/><stop offset="100%" stop-color="#00cec9"/>
      </linearGradient>
      <linearGradient id="ribbonE" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#9b59b6"/><stop offset="100%" stop-color="#8e44ad"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="115" r="75" fill="url(#eGlow)"/>
    <path d="M70 15 C85 50 88 85 92 95 M130 15 C115 50 112 85 108 95" stroke="url(#ribbonE)" stroke-width="12" stroke-linecap="round"/>
    <rect x="88" y="90" width="24" height="12" rx="3" fill="#f1c40f"/>
    <rect x="58" y="98" width="84" height="88" rx="10" fill="url(#eCard)" stroke="#dff9fb" stroke-width="3"/>
    <text x="100" y="152" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="2">ÉLITE</text>
    <polygon points="100,108 108,122 100,132 92,122" fill="#ffffff"/>
    <polygon points="100,108 108,122 100,126" fill="#70a1ff"/>
  </svg>`,

  'badge-legende.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
    <defs>
      <radialGradient id="lGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f39c12" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#e74c3c" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="lCard" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f39c12"/><stop offset="50%" stop-color="#e67e22"/><stop offset="100%" stop-color="#c0392b"/>
      </linearGradient>
      <linearGradient id="goldRib" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffeaa7"/><stop offset="100%" stop-color="#fdcb6e"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="115" r="85" fill="url(#lGlow)"/>
    <!-- Wings behind -->
    <path d="M45 110 C30 90 40 70 65 78 C55 88 55 102 60 115 Z" fill="#f1c40f"/>
    <path d="M155 110 C170 90 160 70 135 78 C145 88 145 102 140 115 Z" fill="#f1c40f"/>
    <path d="M70 15 C85 50 88 85 92 95 M130 15 C115 50 112 85 108 95" stroke="url(#goldRib)" stroke-width="12" stroke-linecap="round"/>
    <rect x="88" y="90" width="24" height="12" rx="3" fill="#e74c3c"/>
    <rect x="58" y="98" width="84" height="88" rx="10" fill="url(#lCard)" stroke="#ffeaa7" stroke-width="3"/>
    <text x="100" y="152" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle" letter-spacing="1">LÉGENDE</text>
    <!-- Crown -->
    <polygon points="90,122 93,112 97,118 100,108 103,118 107,112 110,122" fill="#ffeaa7"/>
  </svg>`,

  'badge-habitue.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
    <defs>
      <radialGradient id="hGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#bdc3c7" stop-opacity="0.35"/><stop offset="100%" stop-color="#bdc3c7" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="hCard" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7f8c8d"/><stop offset="50%" stop-color="#95a5a6"/><stop offset="100%" stop-color="#34495e"/>
      </linearGradient>
      <linearGradient id="ribbonH" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#95a5a6"/><stop offset="100%" stop-color="#7f8c8d"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="115" r="75" fill="url(#hGlow)"/>
    <path d="M70 15 C85 50 88 85 92 95 M130 15 C115 50 112 85 108 95" stroke="url(#ribbonH)" stroke-width="12" stroke-linecap="round"/>
    <rect x="88" y="90" width="24" height="12" rx="3" fill="#7f8c8d"/>
    <rect x="58" y="98" width="84" height="88" rx="10" fill="url(#hCard)" stroke="#ecf0f1" stroke-width="3"/>
    <text x="100" y="152" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="22" fill="#ffffff" text-anchor="middle" letter-spacing="1">HABITUÉ</text>
    <polygon points="100,110 103,118 111,118 105,123 107,131 100,126 93,131 95,123 89,118 97,118" fill="#ecf0f1"/>
  </svg>`
};

for (const [name, content] of Object.entries(svgs)) {
  fs.writeFileSync(path.join(imgDir, name), content, 'utf8');
  console.log('Created: ' + name);
}
