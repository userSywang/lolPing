const { app, BrowserWindow, globalShortcut } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), isolated = path.join(root, 'release', 'chat-smoke-profile');
fs.mkdirSync(path.join(isolated, 'lolPing'), { recursive: true });
app.setPath('appData', isolated); app.setPath('userData', path.join(isolated, 'userData'));
Object.defineProperty(app, 'isPackaged', { value: true });
Object.defineProperty(process, 'resourcesPath', { value: path.join(root, 'release', 'win-unpacked', 'resources') });
// Keep Chromium painting without presenting test windows or stealing the user's focus.
const showInactive = BrowserWindow.prototype.showInactive;
function invisibleShow() { this.setOpacity(0); this.setSkipTaskbar(true); showInactive.call(this); }
BrowserWindow.prototype.show = invisibleShow; BrowserWindow.prototype.showInactive = invisibleShow; BrowserWindow.prototype.focus = function () {};
// An installed client can own the default keys. Exercise OS registration with temporary test keys in that case.
const registeredKeys = new Map(), defaultKeyConflicts = [];
const registerKey = globalShortcut.register.bind(globalShortcut);
globalShortcut.register = (key, callback) => {
  if (registerKey(key, callback)) { registeredKeys.set(key, key); return true; }
  defaultKeyConflicts.push(key);
  const temporary = key.includes('Backspace') ? 'Control+Alt+Shift+F12' : 'Control+Alt+Shift+F11';
  if (!registerKey(temporary, callback)) return false;
  registeredKeys.set(key, temporary); return true;
};
fs.writeFileSync(path.join(isolated, 'lolPing', 'settings.json'), JSON.stringify({ enabledOnStart: false, allowInternet: false, rejoinRoom: false, autoUpdateCheck: false }));
const errors = [];
app.on('web-contents-created', (_e, w) => {
  w.setBackgroundThrottling(false);
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
    const update = await settings.webContents.executeJavaScript('window.settingsApi.getUpdate()');
    if (!update) throw Error('installed updater disabled');
    if (!await settings.webContents.executeJavaScript(`document.body.textContent.includes('userSywang/lolPing')`)) throw Error('update source missing from settings');
    const settingsControls = await settings.webContents.executeJavaScript(`(()=>({channels:document.querySelectorAll('[data-chat-mode]').length,sliders:document.querySelectorAll('[data-chat-mode] input[type=range]').length,defaultDuration:document.querySelector('[data-chat-mode=announcement]')?.textContent.includes('60 秒')}))()`);
    if (settingsControls.channels !== 2 || settingsControls.sliders !== 8 || !settingsControls.defaultDuration) throw Error('independent settings controls missing: '+JSON.stringify(settingsControls));
    await settings.webContents.executeJavaScript(`(()=>{document.querySelector('#chat').scrollIntoView();const slider=document.querySelector('[aria-label="固定字号与猫猫大小"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,'21');slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));})()`); await wait(200);
    const adjusted = await settings.webContents.executeJavaScript(`window.settingsApi.getSettings().then(s=>s.chat.announcement.fontSize)`);
    if (adjusted !== 21) throw Error('appearance slider failed to save: '+adjusted);
    const settingsShot = await settings.webContents.capturePage(); fs.writeFileSync(path.join(root,'release','chat-settings-preview.png'), settingsShot.toPNG());
    await settings.webContents.executeJavaScript('window.settingsApi.openChat()'); await wait(1800);
    const composer = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/chat/'));
    if (!composer) throw Error('composer missing');
    const ui = await composer.webContents.executeJavaScript('({title:document.title,api:!!window.chatApi,textarea:!!document.querySelector("#message"),random:document.querySelector("#random").textContent,fixed:document.querySelector("#announcement").textContent,placeholder:document.querySelector("#message").placeholder})');
    if (!ui.api || !ui.textarea) throw Error('composer UI failed');
    if (ui.random !== '随机' || ui.fixed !== '固定' || ui.placeholder !== '让猫猫说一句...') throw Error('composer wording mismatch');
    const initialBounds = composer.getBounds();
    if (initialBounds.height > 300 || composer.isResizable()) throw Error('composer is still a large window');
    await composer.webContents.executeJavaScript(`document.querySelector('#announcement').click()`); await wait(200);
    if (await composer.webContents.executeJavaScript(`document.querySelector('#message').placeholder`) !== '让猫猫说一句...') throw Error('fixed placeholder mismatch');
    const remembered = await composer.webContents.executeJavaScript(`window.chatApi.get().then(s=>s.preferences.mode)`);
    if (remembered !== 'announcement') throw Error('channel choice not saved');
    await composer.webContents.executeJavaScript(`document.querySelector('#random').click()`); await wait(200);
    const sizes = [];
    for (const size of [12, 32]) {
      overlay.webContents.send('chat:clear', null);
      await composer.webContents.executeJavaScript(`window.chatApi.preferences({fontSize:${size},opacity:1,enabled:true,position:'fixed'}).then(()=>window.chatApi.preview('猫猫缩放测试'))`);
      await wait(400);
      sizes.push(await overlay.webContents.executeJavaScript(`(()=>{const b=document.querySelector('#chats .cat-bubble'),t=b?.querySelector('.cat-bubble__text');return b?{width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,font:getComputedStyle(t).fontSize,textHeight:t.getBoundingClientRect().height,frame:getComputedStyle(b).borderImageSource}:null})()`));
    }
    if (sizes.some((s) => !s) || Math.abs(sizes[1].height / sizes[0].height - 32 / 12) > .08) throw Error('font and frame did not scale together');
    await composer.webContents.executeJavaScript(`window.chatApi.preferences({fontSize:20,duration:3,announcement:{enabled:true,fontSize:16,color:'#201b16',opacity:1,duration:5,position:'fixed',x:.95,y:.9}})`); await wait(100);
    overlay.webContents.send('chat:clear', null);
    const deliver = (peer,text,mode='announcement') => overlay.webContents.send('chat:spawn',{peer,text,mode,name:peer,x:100,y:100});
    deliver('Alice','第一句公告'); deliver('Bob','另一人的公告'); deliver('Alice','短暂悄悄话','random'); await wait(200);
    deliver('Alice','替换我的公告'); await wait(200);
    const simultaneous = await overlay.webContents.executeJavaScript(`(()=>{const nodes=[...document.querySelectorAll('#chats .chat-message')];return {count:nodes.length,text:nodes.map(n=>n.textContent),boxes:nodes.filter(n=>n.dataset.mode==='announcement').map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,visible:getComputedStyle(n).visibility}})}})()`);
    if (simultaneous.count !== 3 || simultaneous.text.some(t=>t.includes('第一句公告')) || !simultaneous.text.some(t=>t.includes('另一人的公告'))) throw Error('announcement replacement affected wrong channel or sender');
    const [a,b] = simultaneous.boxes;
    if (a.visible !== 'visible' || b.visible !== 'visible') throw Error('announcements not painted');
    if (!(a.x+a.w <= b.x || b.x+b.w <= a.x || a.y+a.h <= b.y || b.y+b.h <= a.y)) throw Error('announcements overlap');
    await wait(3100);
    if (await overlay.webContents.executeJavaScript(`document.querySelectorAll('#chats [data-mode=random]').length`)) throw Error('random messages did not expire independently');
    if (await overlay.webContents.executeJavaScript(`document.querySelectorAll('#chats [data-mode=announcement]').length`) !== 2) throw Error('announcements expired with random messages');
    await wait(2100);
    if (await overlay.webContents.executeJavaScript(`document.querySelectorAll('#chats .chat-message').length`)) throw Error('announcements did not expire');
    const ime = await composer.webContents.executeJavaScript(`(()=>{const m=document.querySelector('#message');m.value='私密输入测试';m.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));m.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true}));m.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));return m.value;})()`);
    await wait(100);
    if (composer.isDestroyed() || ime !== '私密输入测试') throw Error('IME confirmation submitted unexpectedly');
    const result = await composer.webContents.executeJavaScript(`window.chatApi.send('没有房间时不能发送')`);
    if (result.ok) throw Error('sent outside a room');
    await composer.webContents.executeJavaScript(`window.dispatchEvent(new Event('focus'))`); await wait(100);
    const fit = await composer.webContents.executeJavaScript(`({body:document.querySelector('main').getBoundingClientRect().height,viewport:innerHeight})`);
    if (fit.body > fit.viewport) throw Error('composer content cropped: '+JSON.stringify(fit));
    const shot = await composer.webContents.capturePage(); fs.writeFileSync(path.join(root, 'release', 'chat-composer-preview.png'), shot.toPNG());
    overlay.webContents.send('chat:clear', null); await wait(100);
    if (await overlay.webContents.executeJavaScript('document.querySelectorAll("#chats .chat-message").length')) throw Error('clear failed');
    const shortcuts = { open: globalShortcut.isRegistered(registeredKeys.get('Control+Alt+Return')), hide: globalShortcut.isRegistered(registeredKeys.get('Control+Alt+Backspace')), defaultKeyConflicts };
    if (!shortcuts.open || !shortcuts.hide) throw Error('shortcuts unavailable');
    await composer.webContents.executeJavaScript('window.chatApi.close()'); await wait(100);
    if (!composer.isDestroyed()) throw Error('draft window retained');
    if (fs.readFileSync(path.join(isolated, 'lolPing', 'settings.json'), 'utf8').includes('私密输入测试')) throw Error('draft persisted in settings');
    if (errors.length) throw Error('renderer errors: ' + errors.join(';'));
    fs.writeFileSync(path.join(root, 'release', 'chat-smoke-result.json'), JSON.stringify({ ok: true, ui, sizes, shortcuts, initialBounds, settingsControls, remembered, simultaneous, independentExpiry: true, imeSafe: true, noTranscript: true, cleared: true }, null, 2));
    app.quit();
  } catch (e) {
    fs.writeFileSync(path.join(root, 'release', 'chat-smoke-result.json'), JSON.stringify({ ok: false, error: String(e), errors })); app.exit(1);
  }
}, 4000);
setTimeout(() => app.exit(2), 25000).unref();
