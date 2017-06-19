const electron = require('electron')

const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipc = electron.ipcMain
const dialog = electron.dialog

const _ = require('underscore')

const path = require('path')
const url = require('url')

let mainWindow

// Обрабатываем создание главного окна программы
function createWindow () {
  // Создаём экземпляр окна
  mainWindow = new BrowserWindow()

  // Загружаем в окно страницу с программой
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // При закрытии окна освобождаем память
  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

// Реагируем на событие готовности ядра приложения
app.on('ready', createWindow)

// Событие закрытия всех окон программы
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Если программа висит в фоне и её запускают
app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

// Запрос на диалог открытия файла
ipc.on('open-file-dialog', function (event) {
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{
      name: 'Список рёбер',
      extensions: ['edgeslist']
    }]
  }, function (files) {
    if (_.isArray(files) && files.length > 0) {
      event.sender.send('opened-file', files[0])
    }
  })
})

// Запрос на сохранение файла
ipc.on('save-file-dialog', function (event) {
  const options = {
    title: 'Сохранение списка рёбер',
    filters: [{
      name: 'Список рёбер',
      extensions: ['edgeslist']
    }]
  }
  dialog.showSaveDialog(options, function (filename) {
    event.sender.send('saved-file', filename)
  })
})
