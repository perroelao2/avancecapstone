// En Electron, la ventana (el HTML/JS) no tiene permiso directo para conectarse a MySQL por seguridad.
// Este archivo (preload.js) funciona como un puente seguro entre la ventana y el archivo main.js.
const { contextBridge, ipcRenderer } = require('electron');

// Exponemos un objeto global llamado "window.api" para que desde renderer.js
// podamos llamar a las funciones de base de datos usando: window.api.invoke('nombre-funcion', datos)
contextBridge.exposeInMainWorld('api', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data)
});
