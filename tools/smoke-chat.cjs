const { app, BrowserWindow, globalShortcut } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), isolated = path.join(root, 'release', 'chat-smoke-profile');
fs.mkdirSync(path.join(isolated, 'lolPing'), { recursive: true });
app.setPath('appData', isolated); app.setPath('userData', path.join(isolated, 'userData'));
Object.defineProperty(app, 'isPackaged', { value: true });
Object.defineProperty(process, 'resourcesPath', { value: path.join(root, 'release', 'win-unpacked', 'resources') });
BrowserWindow.prototype.show = function () {}; BrowserWindow.prototype.showInactive = function () {}; BrowserWindow.prototype.focus = function () {};
fs.writeFileSync(path.join(isolated, 'lolPing', 'settings.json'), JSON.stringify({ enabledOnStart: false, allowInternet: false, rejoinRoom: false, autoUpdateCheck: false }));
const errors = [];
app.on('web-contents-created', (_e, w) => {
  w.on('render-process-gone', (_e, d) => errors.push(d.reason));
  w.on('console-message', (event) => { if (event.level === 'error') errors.push(event.message); });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
require(path.join(process.resourcesPath, 'app.asar', 'out', 'main', 'index.js'));
setTimeout(async () => {
  try {
    const settings = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/settings/'));
    const overlay = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/overlay/'));
    if (!settings || !overlay) throw Error('application windows missing');
    await settings.webContents.executeJavaScript('window.settingsApi.openChat()'); await wait(1800);
    const composer = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/chat/'));
    if (!composer) throw Error('composer missing');
    const ui = await composer.webContents.executeJavaScript('({title:document.title,api:!!window.chatApi,textarea:!!document.querySelector("#message")})');
    if (!ui.api || !ui.textarea) throw Error('composer UI failed');
    const sizes = [];
    for (const size of [12, 32]) {
      overlay.webContents.send('chat:clear', null);
      await composer.webContents.executeJavaScript(`window.chatApi.preferences({fontSize:${size},opacity:1,enabled:true,position:'fixed'}).then(()=>window.chatApi.preview('猫猫缩放测试'))`);
      await wait(400);
      sizes.push(await overlay.webContents.executeJavaScript(`(()=>{const b=document.querySelector('#chats .cat-bubble'),t=b?.querySelector('.cat-bubble__text');return b?{width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,font:getComputedStyle(t).fontSize,textHeight:t.getBoundingClientRect().height,frame:getComputedStyle(b).borderImageSource}:null})()`));
    }
    if (sizes.some((s) => !s) || Math.abs(sizes[1].height / sizes[0].height - 32 / 12) > .08) throw Error('font and frame did not scale together');
    const ime = await composer.webContents.executeJavaScript(`(()=>{const m=document.querySelector('#message');m.value='私密输入测试';m.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));m.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true}));m.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));return m.value;})()`);
    await wait(100);
    if (composer.isDestroyed() || ime !== '私密输入测试') throw Error('IME confirmation submitted unexpectedly');
    const result = await composer.webContents.executeJavaScript(`window.chatApi.send('没有房间时不能发送')`);
    if (result.ok) throw Error('sent outside a room');
    const shot = await composer.webContents.capturePage(); fs.writeFileSync(path.join(root, 'release', 'chat-composer-preview.png'), shot.toPNG());
    overlay.webContents.send('chat:clear', null); await wait(100);
    if (await overlay.webContents.executeJavaScript('document.querySelectorAll("#chats .chat-message").length')) throw Error('clear failed');
    const shortcuts = { open: globalShortcut.isRegistered('Control+Alt+Return'), hide: globalShortcut.isRegistered('Control+Alt+Backspace') };
    if (!shortcuts.open || !shortcuts.hide) throw Error('shortcuts unavailable');
    await composer.webContents.executeJavaScript('window.chatApi.close()'); await wait(100);
    if (!composer.isDestroyed()) throw Error('draft window retained');
    if (fs.readFileSync(path.join(isolated, 'lolPing', 'settings.json'), 'utf8').includes('私密输入测试')) throw Error('draft persisted in settings');
    if (errors.length) throw Error('renderer errors: ' + errors.join(';'));
    fs.writeFileSync(path.join(root, 'release', 'chat-smoke-result.json'), JSON.stringify({ ok: true, ui, sizes, shortcuts, imeSafe: true, noTranscript: true, cleared: true }, null, 2));
    app.quit();
  } catch (e) {
    fs.writeFileSync(path.join(root, 'release', 'chat-smoke-result.json'), JSON.stringify({ ok: false, error: String(e), errors })); app.exit(1);
  }
}, 4000);
setTimeout(() => app.exit(2), 25000).unref();
