/* global $, Plotly */
const Mustache = require('mustache')
const ipc = require('electron').ipcRenderer

const fs = require('fs')
const path = require('path')

const Task = require('./src/task.js')
const Edge = require('./src/edge.js')
const Point = require('./src/point.js')

const $edges = $('#edges')
const $edgesCount = $('#edges-count')

let gd
let task = new Task()

$(document).ready(function () {
  gd = Plotly.d3.select('#plot').node()

  task.edgesArr = [
    [-1, -2, 0, 0],
    [0, 0, 1, -2],
    [1, -2, 2, 1],
    [2, 1, 3, 0],
    [3, 0, 4, 1],
    [4, 1, 5, -3],
    [5, -3, 6, 2],
    [6, 2, 0, 3],
    [0, 3, -2, 0],
    [0, 0, 2, 1],
    [2, 1, 4, 1],
    [4, 1, 6, 2]
  ]

  $edges.on('click', 'a', function (e) {
    e.preventDefault()

    let $el = $(this)

    task.removeByHash($el.data('hash'))
    $el.remove()
    syncEdgeChanges()
  })

  syncEdgeChanges()

  $('#open-file').click(function (e) {
    ipc.send('open-file-dialog')
  })

  $('#save-file').click(function (e) {
    ipc.send('save-file-dialog')
  })

  ipc.on('opened-file', (event, file) => {
    fs.readFile(file, 'utf-8', function (err, data) {
      let arr = JSON.parse(data)

      task.edgesArr = arr

      syncEdgeChanges()
    })
  })
  ipc.on('saved-file', (event, file) => {
    fs.writeFileSync(file, JSON.stringify(task.edgesArr))
  })
})

window.onresize = function () {
  Plotly.Plots.resize(gd)
}

function syncEdgeChanges () {
  console.log('path length', task.connectedGraphPath.length)
  $edges.empty()
  $edgesCount.text(task.edges.length)

  for (let edge of task.edges) {
    $edges.append(Mustache.render($('#template-edge-label').html(), edge.objWithHash))
  }

  Plotly.purge(gd)

  let data = []

  let graph = {
    x: [],
    y: [],
    type: 'scatter'
  }

  for (let edge of task.connectedGraphPath) {
    if (graph.x.length === 0) {
      graph.x.push(edge.from.x)
      graph.y.push(edge.from.y)
    }

    graph.x.push(edge.to.x)
    graph.y.push(edge.to.y)
  }

  data.push(graph)

  let d = new Date()

  let layout = {
    title: 'Планарный граф' + d.getTime()
  }

  let options = {
    staticPlot: true
  }

  Plotly.plot(gd, data, layout, options)
}
