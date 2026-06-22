const { app, BrowserWindow, dialog, Menu, MenuItem } = require('electron')
const isDev = require('electron-is-dev')
const { autoUpdater } = require('electron-updater')
const DiscordRPC = require('discord-rpc')
const fs = require('fs')
const path = require('path')

function isOSWin64() {
  return (
    process.arch === 'x64' ||
    process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')
  )
}

let pluginName
switch (process.platform) {
  case 'win32':
    switch (process.arch) {
      case 'ia32':
      case 'x32':
        pluginName = 'flash/windows/32/pepflashplayer.dll'
        break
      case 'x64':
        pluginName = 'flash/windows/64/pepflashplayer.dll'
        break
    }
    break
  case 'linux':
    switch (process.arch) {
      case 'ia32':
      case 'x32':
        pluginName = 'flash/linux/32/libpepflashplayer.so'
        break
      case 'x64':
        pluginName = 'flash/linux/64/libpepflashplayer.so'
        break
    }

    app.commandLine.appendSwitch('no-sandbox')
    break
  case 'darwin':
    pluginName = 'flash/mac/PepperFlashPlayer.plugin'
    break
}
app.commandLine.appendSwitch(
  'ppapi-flash-path',
  path.join(__dirname, pluginName)
)
//app.commandLine.appendSwitch("disable-http-cache");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let fsmenu
let session

function makeMenu() {
  fsmenu = new Menu()
  fsmenu.append(
    new MenuItem({
      label: 'На полный экран',
      accelerator: 'CmdOrCtrl+F',
      click: () => {
        let fsbool = mainWindow.isFullScreen() ? false : true
        mainWindow.setFullScreen(fsbool)
      },
    })
  )
  fsmenu.append(
    new MenuItem({
      label: 'Отключить/включить звук',
      click: () => {
        let ambool = mainWindow.webContents.audioMuted ? false : true
        mainWindow.webContents.audioMuted = ambool
      },
    })
  )
  fsmenu.append(
    new MenuItem({
      label: 'Очистить кэш',
      accelerator: 'CmdOrCtrl+D',
      click: () => {
        clearCache()
      },
    })
  )
  fsmenu.append(
    new MenuItem({
      label: 'Обновить страницу',
      click: () => {
        mainWindow.webContents.session.clearCache().then(() => {
          mainWindow.reload()
        })
      },
    })
  )
  fsmenu.append(
    new MenuItem({
      label: 'Выйти из аккаунта',
      click: () => {
        // xfootball хранит токен авторизации в localStorage под ключом
        // 'footballToken'. Сносим его и перезагружаем — NameInputScene увидит
        // отсутствие токена и покажет форму входа.
        mainWindow.webContents
          .executeJavaScript('localStorage.removeItem("footballToken")')
          .then(() => mainWindow.reload())
      }
    })
  )
}

function clearCache() {
  if (mainWindow !== null) {
    mainWindow.webContents.session.clearCache()
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1225,
    height: 823,
    title: 'xfootball',
    icon: __dirname + '/build/icon.png',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      plugins: true,
    },
  })

  mainWindow.setMenu(null)
  session = mainWindow.webContents.session

  // Фиксируем заголовок окна — иначе Electron перетирает его на <title>
  // загруженной страницы.
  mainWindow.on('page-title-updated', (e) => e.preventDefault())

  // Чистим кэш при каждом запуске клиента — игроки всегда получают свежие
  // ассеты, без необходимости вручную нажимать "Очистить кэш".
  session.clearCache().then(() => {
    mainWindow.loadURL('http://45.150.238.108/')
  })

// const clientId = '778659542627254303'
// DiscordRPC.register(clientId)
// const rpc = new DiscordRPC.Client({ transport: 'ipc' })
// const startTimestamp = new Date()
// rpc.on('ready', () => {
//   rpc.setActivity({
//     details: `Football`,
//     state: `Клиент приложение`,
//     startTimestamp,
//     largeImageKey: `main-logo`,
//   })
// })
// rpc.login({ clientId }).catch(console.error)


  // mainWindow.webContents.openDevTools()

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

app.on('ready', function () {
  createWindow()
  makeMenu()
  Menu.setApplicationMenu(fsmenu)
})

app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})


