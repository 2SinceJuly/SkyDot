import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { House, Plug, Puzzle, Server } from 'lucide-react';

import { McpServersPage } from './McpServersPage';
import { PluginsPage } from './PluginsPage';
import { SkillsPage } from './SkillsPage';
import { SmartHomeSection } from '../components/settings/SmartHomeSection';
import { useAuthStore } from '../stores/auth';

const sections = [
  { key: 'smart-home', label: '智能家居', icon: House },
  { key: 'skills', label: 'Skills 技能', icon: Puzzle },
  { key: 'mcp', label: 'MCP 服务器', icon: Server },
  { key: 'plugins', label: 'Plugins 插件', icon: Plug },
] as const;

export function CapabilitiesPage() {
  const { section } = useParams<{ section?: string }>();
  const canManageSystem = useAuthStore((s) =>
    s.hasPermission('manage_system_config'),
  );
  const availableSections = sections.filter(
    ({ key }) => key !== 'smart-home' || canManageSystem,
  );
  if (!availableSections.some((item) => item.key === section)) {
    return (
      <Navigate to={`/capabilities/${availableSections[0].key}`} replace />
    );
  }

  return (
    <div className="product-advanced-page min-h-full bg-background">
      <div className="sticky top-0 z-20 bg-background px-4">
        <div className="product-feature-frame product-feature-tabs">
          <span className="mr-2 text-sm font-medium text-foreground">
            能力库
          </span>
          {availableSections.map(({ key, label, icon: Icon }) => (
            <NavLink
              key={key}
              to={`/capabilities/${key}`}
              className={({ isActive }) =>
                `inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-primary font-medium text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {section !== 'smart-home' && (
        <p className="product-feature-frame px-4 pt-3 text-xs text-muted-foreground">
          到具体智能体的“能力配置”中
          <Link
            className="text-primary underline-offset-4 hover:underline"
            to="/agent-profiles"
          >
            选择要启用的资源
          </Link>
          。
        </p>
      )}
      {section === 'smart-home' && <SmartHomeSection />}
      {section === 'skills' && <SkillsPage />}
      {section === 'mcp' && <McpServersPage />}
      {section === 'plugins' && <PluginsPage />}
    </div>
  );
}
