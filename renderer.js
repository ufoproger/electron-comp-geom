/* global $, Plotly */
require('bootstrap-notify')
require('bootstrap-validator')

const Mustache = require('mustache')
const ipc = require('electron').ipcRenderer

const fs = require('fs')

const _ = require('underscore')

const Task = require('./src/task.js')
const Edge = require('./src/edge.js')
const Point = require('./src/point.js')

const $edges = $('#edges')
const $edgesCount = $('#edges-count')
const $newEdge = $('#new-edge')
const $point = $('#point')

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
  })

  $point.validator().on('submit', (e) => {
    if (e.isDefaultPrevented()) {
      $.notify({
        title: 'Некорректные данные',
        message: 'Не все поля заполнены должным образом'
      }, {
        type: 'danger'
      })

      return
    }

    e.preventDefault()
  })

  $newEdge.validator().on('submit', (e) => {
    if (e.isDefaultPrevented()) {
      $.notify({
        title: 'Некорректные данные',
        message: 'Не все поля заполнены должным образом'
      }, {
        type: 'danger'
      })

      return
    }

    e.preventDefault()

    let xFrom = parseFloat($newEdge.find('#new-edge-from-x').val())
    let yFrom = parseFloat($newEdge.find('#new-edge-from-y').val())
    let xTo = parseFloat($newEdge.find('#new-edge-to-x').val())
    let yTo = parseFloat($newEdge.find('#new-edge-to-y').val())

    try {
      task.addEdge(new Edge(new Point(xFrom, yFrom), new Point(xTo, yTo)))

      $.notify({
        message: 'Ребро успешно добавлено.'
      })
    } catch (e) {
      $.notify({
        title: 'Ошибка добавления ребра!',
        message: e.message
      }, {
        type: 'danger'
      })
    }
  })

  $('#open-file').click(function (e) {
    ipc.send('open-file-dialog')
  })

  $('#save-file').click(function (e) {
    ipc.send('save-file-dialog')
  })

  ipc.on('opened-file', (event, file) => {
    fs.readFile(file, 'utf-8', function (err, data) {
      try {
        task.edgesArr = JSON.parse(data)
      } catch (e) {
        $.notify({
          title: 'Ошибка добавления списка рёбер из файла!',
          message: e.message
        }, {
          type: 'danger'
        })
      }
    })
  })

  ipc.on('saved-file', (event, file) => {
    fs.writeFileSync(file, JSON.stringify(task.edgesArr))
  })
})

window.onresize = function () {
  Plotly.Plots.resize(gd)
}

task.syncCallback = () => {
  $edges.empty()
  $edgesCount.text(task.edges.length)

  for (let edge of task.edges) {
    $edges.append(Mustache.render($('#template-edge-label').html(), edge.objWithHash))
  }

  let pathEdges = task.connectedGraphPath
  let data = []

  if (pathEdges.length) {
    let graph = {
      x: [],
      y: [],
      type: 'scatter',
      name: 'Граф'
    }

    for (let edge of pathEdges) {
      if (graph.x.length === 0) {
        graph.x.push(edge.from.x)
        graph.y.push(edge.from.y)
      }

      graph.x.push(edge.to.x)
      graph.y.push(edge.to.y)
    }

    data.push(graph)

    let xRange = {
      from: task.xValues[0],
      to: _.last(task.xValues)
    }

    for (let value of task.yValues) {
      data.push({
        x: [xRange.from - 1, xRange.to + 1],
        y: [value, value],
        type: 'scatter',
        mode: 'lines',
        name: `y = ${value}`
      })
    }
  } else {
    $.notify({
      title: 'Неверные входные данные!',
      message: 'Граф не является связным! Н - невозможно.'
    }, {
      type: 'danger'
    })

    for (let edge of task.edges) {
      data.push({
        x: [edge.from.x, edge.to.x],
        y: [edge.from.y, edge.to.y],
        type: 'scatter'
      })
    }
  }

  let layout = {
    title: 'Координатная плоскость'
  }

  let options = {
    staticPlot: true
  }

  Plotly.purge(gd)
  Plotly.plot(gd, data, layout, options)
}
