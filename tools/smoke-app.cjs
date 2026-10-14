const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const isolated = path.join(root, 'release', 'smoke-profile');
fs.mkdirSync(path.join(isolated, 'lolPing', 'emote-cache'), {recursive:true});
app.setPath('appData', isolated);
app.setPath('userData', path.join(isolated, 'userData'));
Object.defineProperty(app, 'isPackaged', {value:true});
Object.defineProperty(process, 'resourcesPath', {value:path.join(root, 'release', 'win-unpacked', 'resources')});
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
fs.writeFileSync(path.join(isolated, 'lolPing', 'settings.json'), JSON.stringify({enabledOnStart:false,allowInternet:false,rejoinRoom:false,autoUpdateCheck:false}));
const bytes = fs.readFileSync(path.join(root, 'tests','main','fixtures','sync.webp'));
const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0,32);
fs.writeFileSync(path.join(isolated,'lolPing','emote-cache',hash+'.webp'),bytes);
const errors=[];
app.on('web-contents-created', (_e,wc) => wc.on('render-process-gone', (_e,d)=>errors.push(d.reason)));
require(path.join(process.resourcesPath,'app.asar','out','main','index.js'));
setTimeout(async()=>{
  try {
    const windows = BrowserWindow.getAllWindows();
    const overlay=windows.find(w=>w.webContents.getURL().includes('/overlay/'));
    if (!overlay) throw new Error('overlay missing');
    const url='lolping://emotes/'+hash+'.webp';
    const decoded=await overlay.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(new Error('image failed'));img.src=${JSON.stringify(url)};})`);
    overlay.webContents.send('emote:spawn',{owner:'smoke',art:{kind:'custom',url,animated:false},x:200,y:200});
    await new Promise(resolve=>setTimeout(resolve,350));
    const displayed=await overlay.webContents.executeJavaScript(`(()=>{const e=document.querySelector('.emote img');return {found:!!e,width:e?.naturalWidth,question:!!document.querySelector('.emote .bubble')};})()`);
    if(!displayed.found || displayed.width!==100 || displayed.question || errors.length) throw new Error(JSON.stringify({decoded,displayed,errors}));
    fs.writeFileSync(path.join(root,'release','smoke-result.json'),JSON.stringify({ok:true,electron:process.versions.electron,decoded,displayed,windows:windows.length},null,2));
    app.quit();
  } catch(e) {fs.writeFileSync(path.join(root,'release','smoke-result.json'),JSON.stringify({ok:false,error:String(e),errors}));app.exit(1);}
},5000);
setTimeout(()=>app.exit(2),20000).unref();
