import { contextBridge, ipcRenderer } from 'electron';
import { CHAT_CH, type ChatApi } from '../shared/chat';
const api: ChatApi = {
  get: () => ipcRenderer.invoke(CHAT_CH.get),
  preferences: (p) => ipcRenderer.invoke(CHAT_CH.preferences, p),
  send: (text) => ipcRenderer.invoke(CHAT_CH.send, text),
  preview: (text) => ipcRenderer.invoke(CHAT_CH.preview, text),
  close: () => ipcRenderer.send(CHAT_CH.close),
};
contextBridge.exposeInMainWorld('chatApi', api);
