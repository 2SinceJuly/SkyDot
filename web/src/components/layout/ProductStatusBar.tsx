import { BarChart3, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PocketTrigger } from '../../features/pocket/PocketPanel';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

export function ProductStatusBar({
  theme,
  onToggleTheme,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const connection = useConnectionStatus();
  const label =
    connection === 'connected'
      ? '已连接服务端'
      : connection === 'offline'
        ? '网络已断开'
        : '正在连接服务端';
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? '浅色' : '深色';

  return (
    <div className="product-status-bar">
      <div className="product-status-links">
        <span
          role="status"
          className="product-service-status"
          data-state={connection}
        >
          {label}
        </span>
        <Link to="/usage" className="product-status-action">
          <BarChart3 />
          用量
        </Link>
      </div>
      <div className="product-status-links">
        <PocketTrigger />
        <button
          type="button"
          className="product-status-action"
          aria-label={`切换到${themeLabel}模式`}
          onClick={onToggleTheme}
        >
          <ThemeIcon />
          {themeLabel}
        </button>
      </div>
    </div>
  );
}
