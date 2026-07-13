interface SidebarProps {
  pages: Record<string, { title: string; description: string }>;
  active: string;
  onNavigate: (key: string) => void;
  isOpen: boolean;
}

export default function Sidebar({ pages, active, onNavigate, isOpen }: SidebarProps) {
  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-sidebar transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } flex flex-col h-full`}
    >
      <div className="p-6 border-b border-brand-border/50 lg:hidden">
        <h2 className="text-xl font-bold text-white tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-blue-400">
          AAPSD
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-2 px-4">
          {Object.entries(pages).map(([key, { title }]) => {
            const isActive = active === key;
            return (
              <li key={key}>
                <button
                  onClick={() => onNavigate(key)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group flex items-center gap-3 ${
                    isActive
                      ? 'bg-brand-primary/20 text-brand-primary shadow-[inset_4px_0_0_0_#00F0FF]'
                      : 'text-brand-muted hover:text-white hover:bg-brand-surfaceHover'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? 'bg-brand-primary animate-glow' : 'bg-transparent group-hover:bg-brand-border'}`}
                  ></span>
                  <span className="font-medium tracking-wide">{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-6 border-t border-brand-border/50 text-xs text-brand-muted text-center">
        Agentic AI v2.0
      </div>
    </aside>
  );
}
