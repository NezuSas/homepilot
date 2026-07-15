/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',

        // ── Semantic status tokens ──────────────────────────────
        // Use success/warning/danger everywhere instead of
        // green-*/amber-*/red-* hardcoded Tailwind color names.
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))'
        },
        'light-active': {
          DEFAULT: 'hsl(var(--light-active))',
          foreground: 'hsl(var(--light-active-foreground))'
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        modal: 'var(--radius-modal)',
        pill: 'var(--radius-pill)'
      },
      fontSize: {
        nano: ['0.5rem', { lineHeight: '0.75rem' }],
        micro: ['0.625rem', { lineHeight: '0.875rem' }],
        label: ['0.6875rem', { lineHeight: '1rem' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        body: ['0.875rem', { lineHeight: '1.375rem' }],
        'body-compact': ['0.8125rem', { lineHeight: '1.125rem' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem' }],
        'card-title': ['0.9375rem', { lineHeight: '1.25rem' }],
        'section-title': ['1.125rem', { lineHeight: '1.5rem' }],
        'panel-title': ['1.25rem', { lineHeight: '1.625rem' }],
        'view-title': ['1.5rem', { lineHeight: '1.875rem' }],
        'display-title': ['1.875rem', { lineHeight: '2.125rem' }],
        'hero-title': ['2.25rem', { lineHeight: '2.5rem' }],
        'hero-title-lg': ['3rem', { lineHeight: '1' }],
        'widget-title-fluid': ['clamp(1.15rem,3.1cqi,2rem)', { lineHeight: '1.05' }],
        'widget-title-compact-fluid': ['clamp(1rem,2.4cqi,1.55rem)', { lineHeight: '1.08' }],
        'widget-title-small-fluid': ['clamp(0.9rem,2cqi,1.25rem)', { lineHeight: '1.12' }],
        'dashboard-section-title-fluid': ['clamp(1.35rem,2.5cqi,1.85rem)', { lineHeight: '1.08' }],
        'widget-caption-fluid': ['clamp(0.72rem,1.45cqi,0.98rem)', { lineHeight: '1.2' }],
        'widget-body-fluid': ['clamp(0.72rem,3.5cqi,0.95rem)', { lineHeight: '1.2' }],
        'widget-body-lg-fluid': ['clamp(0.72rem,3.4cqi,1rem)', { lineHeight: '1.2' }],
        'widget-metric-fluid': ['clamp(1.75rem,18cqi,2.25rem)', { lineHeight: '1' }],
        'clock-caption-fluid': ['clamp(0.55rem,1.3cqi,0.82rem)', { lineHeight: '1.15' }],
        'clock-label-fluid': ['clamp(0.49rem,1.2cqi,0.72rem)', { lineHeight: '1.1' }],
        'clock-micro-fluid': ['clamp(0.48rem,1.18cqi,0.66rem)', { lineHeight: '1.1' }],
        'clock-seconds-fluid': ['clamp(0.54rem,1.6cqi,0.86rem)', { lineHeight: '1.1' }],
        'clock-period-fluid': ['clamp(0.44rem,1.2cqi,0.66rem)', { lineHeight: '1.1' }],
        'clock-time-2xl-fluid': ['clamp(4rem,17cqi,8.4rem)', { lineHeight: '0.92' }],
        'clock-time-xl-fluid': ['clamp(3.35rem,13.5cqi,6.7rem)', { lineHeight: '0.94' }],
        'clock-time-lg-fluid': ['clamp(2.75rem,10.5cqi,5.5rem)', { lineHeight: '0.96' }],
        'clock-time-md-fluid': ['clamp(2.35rem,8cqi,4.5rem)', { lineHeight: '0.98' }],
        'clock-analog-label-fluid': ['clamp(0.58rem,1.3cqi,0.78rem)', { lineHeight: '1.1' }],
        'clock-analog-time-fluid': ['clamp(2.5rem,8.2cqi,4.45rem)', { lineHeight: '0.95' }],
        'clock-minimal-label-fluid': ['clamp(0.48rem,1.1cqi,0.65rem)', { lineHeight: '1.1' }],
        'clock-minimal-time-fluid': ['clamp(2.35rem,8.5cqi,4.7rem)', { lineHeight: '0.95' }],
        'clock-digital-label-fluid': ['clamp(0.53rem,1.25cqi,0.72rem)', { lineHeight: '1.1' }],
        'clock-digital-body-fluid': ['clamp(0.52rem,1.35cqi,0.78rem)', { lineHeight: '1.15' }],
        'clock-digital-micro-fluid': ['clamp(0.38rem,0.95cqi,0.5rem)', { lineHeight: '1' }]
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
