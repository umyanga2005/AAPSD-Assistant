import HealthStatus from './HealthStatus.js';

export default function Header() {
  return (
    <header className="header">
      <span className="header__title">AAPSD Assistant</span>
      <HealthStatus />
    </header>
  );
}
