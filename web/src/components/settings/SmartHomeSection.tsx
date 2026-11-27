import { House, RefreshCw, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { extractErrorMessage } from '../../utils/error';
import { api } from '../../api/client';
import { ConfirmDialog } from '../common';
import { Button } from '../ui/button';

interface Entity {
  id: string;
  name: string;
  state: string;
  kind: 'switch' | 'scene' | 'read-only';
}

interface SmartHomeData {
  configured: boolean;
  entities: Entity[];
}

function stateLabel(state: string): string {
  switch (state) {
    case 'on':
      return '已开启';
    case 'off':
      return '已关闭';
    case 'unavailable':
      return '不可用';
    case 'unknown':
      return '未知';
    default:
      return state;
  }
}

export function SmartHomeSection() {
  const [data, setData] = useState<SmartHomeData>();
  const [failure, setFailure] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailure('');
    try {
      const result = await api.get<SmartHomeData>('/api/smart-home');
      if (!signal?.aborted) setData(result);
    } catch (error) {
      if (!signal?.aborted) {
        setFailure(extractErrorMessage(error));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const action =
    selected?.state === 'on' && selected.kind === 'switch'
      ? 'turn_off'
      : 'turn_on';

  const confirm = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/api/smart-home/commands', {
        entityId: selected.id,
        action,
      });
      toast.success('Home Assistant 已接收操作');
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSelected(null);
      await refresh();
      setSubmitting(false);
    }
  };

  const devices =
    data?.entities.filter((entity) => entity.kind !== 'scene') ?? [];
  const scenes =
    data?.entities.filter((entity) => entity.kind === 'scene') ?? [];

  return (
    <div className="product-feature-frame space-y-5 px-4 pb-12 pt-5 sm:px-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="product-page-title">智能家居</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看已授权设备，控制开关并运行场景。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading || submitting}
        >
          <RefreshCw className="size-4" /> 刷新
        </Button>
      </header>
      <section className="product-device-provider flex items-start gap-3">
        <House className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Home Assistant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? '正在读取设备状态'
              : data?.configured
                ? `已读取 ${data.entities.length} 个实体`
                : '等待管理员连接家庭中枢'}
          </p>
        </div>
        {data?.configured && !failure && (
          <span className="product-device-status">已连接</span>
        )}
      </section>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      {!loading && !failure && !data?.configured && (
        <p className="text-sm text-muted-foreground">
          在服务端配置 Home Assistant
          地址、令牌文件和可访问的实体后，设备会显示在此处。
        </p>
      )}
      {data?.configured && !failure && (
        <>
          {scenes.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">场景</h2>
              <div className="flex flex-wrap gap-2">
                {scenes.map((scene) => (
                  <Button
                    key={scene.id}
                    variant="outline"
                    size="sm"
                    disabled={loading || submitting}
                    onClick={() => setSelected(scene)}
                  >
                    <Zap className="size-4" /> {scene.name}
                  </Button>
                ))}
              </div>
            </section>
          )}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">已授权设备</h2>
            {devices.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无已授权设备。</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {devices.map((device) => (
                <article
                  key={device.id}
                  className="product-device-card space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {device.id}
                    </span>
                    {device.kind === 'read-only' && (
                      <span className="product-device-status">只读</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold">{device.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {stateLabel(device.state)}
                  </p>
                  {device.kind === 'switch' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        loading ||
                        submitting ||
                        !['on', 'off'].includes(device.state)
                      }
                      onClick={() => setSelected(device)}
                    >
                      {device.state === 'on' ? '关闭设备' : '开启设备'}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      <ConfirmDialog
        open={selected !== null}
        onClose={() => {
          if (!submitting) setSelected(null);
        }}
        onConfirm={confirm}
        title={
          selected?.kind === 'scene'
            ? '运行场景'
            : action === 'turn_on'
              ? '开启设备'
              : '关闭设备'
        }
        message={`确认对「${selected?.name ?? ''}」执行此操作？`}
        confirmText="执行"
        loading={submitting}
      />
    </div>
  );
}
