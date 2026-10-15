import { Button, Slider } from '@fluentui/react-components';
import { Keyboard24Regular, Timer24Regular, ResizeLarge24Regular, Cursor24Regular } from '@fluentui/react-icons';
import type { ChatAppearance, ChatMode, ChatPreferences } from '../../../shared/chat';
import type { Update } from '../useAppState';
import { api } from '../api';
import { SettingRow, SwitchRow } from './rows';

export function ChatSection({ chat, update }: { chat: ChatPreferences; update: Update }) {
  const set = (mode: ChatMode, patch: Partial<ChatAppearance>) => void update({ chat: mode === 'announcement'
    ? { ...chat, announcement: { ...chat.announcement, ...patch } } : { ...chat, ...patch } });
  return <>
    <SettingRow icon={<Keyboard24Regular />} title="小气泡输入" description="Ctrl+Alt+Enter 呼出，框内切换通道；Enter 发送，Esc 收起。Ctrl+Alt+Backspace 隐藏所有消息。">
      <Button onClick={() => void api.openChat()}>打开小气泡</Button>
    </SettingRow>
    <p className="desc">下面的设置只影响自己桌面的显示。两种通道可同时使用；正文端到端加密，不保存聊天记录。互发公告需双方更新。</p>
    {(['random', 'announcement'] as const).map((mode) => {
      const p = mode === 'announcement' ? chat.announcement : chat;
      const label = mode === 'announcement' ? '固定公告' : '随机悄悄话';
      const range = (title: string, key: 'fontSize' | 'opacity' | 'duration' | 'x' | 'y', min: number, max: number, step: number, factor: number, suffix: string) =>
        <SettingRow icon={key === 'duration' ? <Timer24Regular /> : <ResizeLarge24Regular />} title={title}>
          <Slider aria-label={label + title} min={min} max={max} step={step} value={Math.round(p[key] * factor)}
            onChange={(_, d) => set(mode, { [key]: d.value / factor })} style={{ width: 160 }} />
          <span className="value">{Math.round(p[key] * factor)}{suffix}</span>
        </SettingRow>;
      return <div key={mode} data-chat-mode={mode}>
        <h3>{label}</h3>
        <SwitchRow icon={<Keyboard24Regular />} title={'显示' + label} description={mode === 'announcement' ? '每人保留最新一句，自动排列；替换后重新计时。' : '短暂弹出，最多同时显示三条，不会覆盖公告。'}
          checked={p.enabled} onChange={(enabled) => set(mode, { enabled })} />
        {range('字号与猫猫大小', 'fontSize', 12, 32, 1, 1, ' px')}
        <SettingRow icon={<ResizeLarge24Regular />} title="文字颜色">
          <input aria-label={label + '文字颜色'} type="color" value={p.color} onChange={(e) => set(mode, { color: e.target.value })} />
        </SettingRow>
        {range('透明度', 'opacity', 30, 100, 5, 100, '%')}
        {range('自动消失', 'duration', mode === 'announcement' ? 5 : 3, mode === 'announcement' ? 600 : 15, 1, 1, ' 秒')}
        {mode === 'random' ? <SettingRow icon={<Cursor24Regular />} title="出现位置">
          <select aria-label="悄悄话出现位置" value={p.position} onChange={(e) => set(mode, { position: e.target.value as ChatAppearance['position'] })}>
            <option value="random">屏幕内随机</option><option value="mouse">我的鼠标附近</option>
          </select>
        </SettingRow> : <>
          {range('公告位置 · 左右', 'x', 0, 100, 1, 100, '%')}
          {range('公告位置 · 上下', 'y', 0, 100, 1, 100, '%')}
        </>}
        <SettingRow icon={<ResizeLarge24Regular />} title="快捷样式">
          <Button onClick={() => set(mode, { fontSize: 16, opacity: .6 })}>低调摸鱼</Button>
          <Button onClick={() => set(mode, { fontSize: 24, opacity: 1 })}>俏皮一点</Button>
        </SettingRow>
      </div>;
    })}
  </>;
}
