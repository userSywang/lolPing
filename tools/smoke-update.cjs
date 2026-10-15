// Read-only live update check using an isolated older-version profile. Never downloads or installs.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname,'..'), profile = path.join(root,'release','update-smoke-profile');
const currentVersion = process.env.LOLPING_SMOKE_CURRENT_VERSION || '0.5.4';
const targetVersion = process.env.LOLPING_SMOKE_TARGET_VERSION || '0.5.5';
if (![currentVersion,targetVersion].every(v=>/^\d+\.\d+\.\d+$/.test(v))) throw Error('Use stable numeric smoke-test versions');
fs.mkdirSync(path.join(profile,'lolPing'),{recursive:true});
app.setPath('appData',profile); app.setPath('userData',path.join(profile,'userData'));
Object.defineProperty(app,'isPackaged',{value:true}); app.getVersion = () => currentVersion;
Object.defineProperty(process,'resourcesPath',{value:path.join(root,'release','win-unpacked','resources')});
BrowserWindow.prototype.show = function(){}; BrowserWindow.prototype.showInactive = function(){}; BrowserWindow.prototype.focus = function(){};
fs.writeFileSync(path.join(profile,'lolPing','settings.json'),JSON.stringify({enabledOnStart:false,allowInternet:false,rejoinRoom:false,autoUpdateCheck:false}));
require(path.join(process.resourcesPath,'app.asar','out','main','index.js'));
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
setTimeout(async()=>{
  try {
    const settings = BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/settings/'));
    if (!settings) throw Error('Settings window missing');
    const initial = await settings.webContents.executeJavaScript('window.settingsApi.getUpdate()');
    if (!initial) throw Error('Installed updater disabled');
    await settings.webContents.executeJavaScript('window.settingsApi.checkForUpdates()');
    let state;
    for(let i=0;i<80;i++) {
      state=await settings.webContents.executeJavaScript('window.settingsApi.getUpdate()');
      if(state?.phase!=='checking') break;
      await wait(500);
    }
    if(state?.phase!=='available'||state.version!==targetVersion||state.notesUrl!==`https://github.com/userSywang/lolPing/releases/tag/v${targetVersion}`)
      throw Error('Unexpected live update result: '+JSON.stringify(state));
    fs.writeFileSync(path.join(root,'release','update-smoke-result.json'),JSON.stringify({ok:true,simulatedInstalledVersion:currentVersion,state,downloaded:false,installed:false},null,2));
    app.quit();
  } catch(e) {
    fs.writeFileSync(path.join(root,'release','update-smoke-result.json'),JSON.stringify({ok:false,error:String(e)})); app.exit(1);
  }
},3500);
setTimeout(()=>app.exit(2),55000).unref();
