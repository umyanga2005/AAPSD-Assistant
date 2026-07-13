interface SidebarProps {
  pages: Record<string, { title: string; description: string }>;
  active: string;
}

export default function Sidebar({ pages, active }: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav>
        <ul className="sidebar__nav">
          {Object.entries(pages).map(([key, { title }]) => (
            <li key={key}>
              <button
                className={`sidebar__link${active === key ? ' sidebar__link--active' : ''}`}
                disabled
              >
                {title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
