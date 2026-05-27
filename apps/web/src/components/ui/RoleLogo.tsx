'use client';

import { RoleColors, type RoleType } from '@/lib/role-colors';

interface RoleLogoProps {
  role?: RoleType;
  size?: number;
  className?: string;
}

/**
 * RPB Logo with dynamic role-based coloring
 * Uses the SVG vector directly to allow perfect scaling and dynamic fill coloring.
 */
export function RoleLogo({
  role = 'DEFAULT',
  size = 64,
  className = '',
}: RoleLogoProps) {
  const roleColor = RoleColors[role];
  const colorHex = 'hex' in roleColor ? roleColor.hex : roleColor.primary;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 800 800"
        width={size}
        height={size}
        aria-hidden="true"
        aria-label="Logo RPB"
        className="object-contain"
      >
        <g
          id="star"
          style={{
            color: role === 'DEFAULT' ? 'var(--rpb-primary)' : colorHex,
          }}
        >
          <path
            d="M400,100 L470.5,315.5 L700,315.5 L515.25,450.25 L585.75,665.75 L400,531 L214.25,665.75 L284.75,450.25 L100,315.5 L329.5,315.5 Z"
            fill="currentColor"
            stroke="#ea580c"
            strokeWidth="8"
            strokeLinejoin="round"
          />
        </g>

        <g
          id="horse-body"
          style={{
            color: role === 'DEFAULT' ? 'var(--rpb-secondary)' : colorHex,
          }}
        >
          <path
            d="M329.5,315.5 C329.5,315.5 250,450 200,480 C180,500 200,550 250,560 C240,580 200,600 250,650 C270,670 300,620 330,610 C350,650 330,700 380,750 C390,740 400,700 400,650 C430,650 450,680 480,700 L550,680 C530,660 510,640 520,620 C550,620 600,650 650,630 L620,600 C650,580 700,600 700,550 L650,530 C680,500 730,520 750,480 C750,450 700,430 680,450 C700,400 750,400 770,350 C770,320 720,310 700,330 C720,290 750,280 730,260 C710,240 650,270 620,290 C640,250 680,230 660,200 C640,180 590,210 560,230 C580,190 620,170 600,150 C580,130 530,160 500,180 C520,140 550,120 520,110 C500,100 470,130 450,150 C470,120 480,80 440,90 C420,100 420,150 430,180 C410,220 400,300 329.5,315.5 M220,230 L400,380"
            fill="currentColor"
          />
        </g>

        <g id="horse-flames" fill="var(--rpb-primary)">
          <path d="M230,240 L410,390 L420,370 C440,370 460,350 470,320 C480,290 470,260 450,240 C440,220 450,180 430,170 C400,170 380,210 360,250 L230,240 Z M480,140 C500,150 520,130 530,120 C510,140 490,170 500,200 C530,210 550,190 570,170 C550,200 530,230 540,260 C570,270 600,250 620,230 C600,260 580,290 590,320 C620,330 650,310 670,290 C650,320 630,350 640,380 C670,390 700,370 720,350 C700,380 680,410 690,440 C720,450 740,430 740,430 L690,480 C710,500 700,520 680,510 L630,540 C650,560 640,580 620,570 L570,600 C590,620 580,640 560,630 L510,650 C530,660 510,670 500,660 L460,670 Z" />
          <path d="M270,470 C290,460 310,470 320,480 L370,450 C390,440 410,440 430,450 C430,430 410,410 390,410 C370,410 350,420 330,430 L270,470 Z M350,460 L380,470 L350,480 L320,470 Z M280,510 L300,500 L280,490 Z" />
          <path d="M310,510 C340,510 370,500 400,490 C420,480 440,470 460,470 C470,490 460,520 440,540 C410,560 380,550 350,540 C320,530 290,530 270,540 C260,520 280,510 310,510 Z M440,560 C460,570 480,570 500,560 C520,540 540,540 560,550 C570,570 560,600 540,620 C510,640 480,630 450,620 C420,610 390,610 370,620 C360,600 380,590 410,590 C430,580 450,570 440,560 Z M400,570 C420,580 440,580 460,570 L490,560 L460,550 C440,550 420,560 400,570 Z M350,600 C370,610 390,610 410,600 L440,590 L410,580 C390,580 370,590 350,600 Z M310,650 C330,660 350,660 370,650 L400,640 L370,630 C350,630 330,640 310,650 Z" />
        </g>
      </svg>
      {role !== 'DEFAULT' && (
        <span
          className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
          style={{
            backgroundColor:
              'hex' in roleColor ? roleColor.hex : roleColor.primary,
          }}
          title={'name' in roleColor ? roleColor.name : 'RPB'}
        />
      )}
    </div>
  );
}

/**
 * Simple color badge for role indication
 */
export function RoleBadge({ role }: { role: RoleType }) {
  const roleColor = RoleColors[role];
  if (role === 'DEFAULT' || !('name' in roleColor)) return null;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: roleColor.hex }}
    >
      {roleColor.name}
    </span>
  );
}
