import HealthStatus from './HealthStatus.js';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="glass-header h-16 flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-brand-muted hover:text-white transition-colors focus:outline-none"
          aria-label="Open Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            <span className="text-brand-dark font-bold text-lg leading-none">A</span>
          </div>
          <span className="text-xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-muted hidden sm:inline-block">
            AAPSD ASSISTANT
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <HealthStatus />
        <div className="h-8 w-8 rounded-full bg-brand-surfaceHover border border-brand-border flex items-center justify-center">
          <span className="text-brand-muted text-sm">US</span>
        </div>
      </div>
    </header>
  );
}
