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
const Slabs = require('./src/slabs.js')

const $edges = $('#edges')
const $edgesCount = $('#edges-count, #graph-edges-count')
const $vertexesCount = $('#graph-vertexes-count')
const $facetsCount = $('#graph-facets-count')
const $newEdge = $('#new-edge')
const $point = $('#point')
const $pointDelete = $('#point-delete')
const $checkboxSlabs = $('#show-slabs')
const $checkboxFacets = $('#show-facets')
const $answer = $('#answer')

let template = {}

let gd
let task = new Task()
let slabs = null
let localizePoint = null

// Граф, с которым можно работать
let isWorkableGraph = false

$(document).ready(function () {
  template = {
    edgeLabel: $('#template-edge-label').html(),
    edge: $('#template-edge').html(),
    answer: $('#template-point-answer').html()
  }

  gd = Plotly.d3.select('#plot').node()

  /* task.edgesArr = [
    [-1, -2, 0, 0],
    [0, 0, 1, -2],
    [1, -2, 2, 1],
    [2, 1, 3, 0],
    [3, 0, 4, 1],
    [4, 1, 5, -3],
    [5, -3, 6, 2],
    [6, 2, 0, 3],
    [-2, 0, -1, -2],
    [0, 3, -2, 0],
    [0, 0, 2, 1],
    [2, 1, 4, 1],
    [4, 1, 6, 2]
  ] */

  $edges.on('click', 'a', function (e) {
    e.preventDefault()

    let $el = $(this)

    task.removeByHash($el.data('hash'))
    $el.remove()
  })

  $checkboxSlabs.on('change', task.syncCallback)
  $checkboxFacets.on('change', task.syncCallback)

  $point.validator().on('submit', (e) => {
    if (e.isDefaultPrevented()) {
      $.notify({
        title: 'Некорректные данные',
        message: 'Не все поля заполнены должным образом'
      }, {
        type: 'danger'
      })

      localizePoint = null
      return
    }

    e.preventDefault()

    if (_.isNull(slabs)) {
      $.notify({
        title: 'Некорректный граф',
        message: 'В данный момент локализовать точку невозможно'
      }, {
        type: 'danger'
      })

      localizePoint = null
      return
    }

    let x = parseFloat($point.find('#point-x').val())
    let y = parseFloat($point.find('#point-y').val())

    localizePoint = new Point(x, y)

    task.syncCallback()
  })

  $pointDelete.click(function (e) {
    e.preventDefault()

    $point.find('#point-x').val('')
    $point.find('#point-y').val('')

    localizePoint = null

    task.syncCallback()
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
  $vertexesCount.text(task.points.length)

  for (let edge of task.edges) {
    $edges.append(Mustache.render(template.edgeLabel, edge.objWithHash))
  }

  isWorkableGraph = true

  if (!task.isCiclicGraph) {
    isWorkableGraph = false

    $.notify({
      title: 'Ошибка входных данных!',
      message: 'Граф не является цикличным.'
    }, {
      type: 'danger'
    })
  }

  console.time('connected graph path')
  let pathEdges = task.connectedGraphPath
  console.timeEnd('connected graph path')
  let data = []

  if (!pathEdges.length) {
    isWorkableGraph = false

    $.notify({
      title: 'Неверные входные данные!',
      message: 'Граф не является связным! Н - невозможно.'
    }, {
      type: 'danger'
    })
  }

  if (pathEdges.length && isWorkableGraph) {
    let graph = {
      x: [],
      y: [],
      type: 'scatter',
      name: 'Граф',
      marker: {
        size: 8,
        color: '#3333FF'
      },
      line: {
        width: 2,
        color: '#3333FF'
      }
    }

    for (let edge of pathEdges) {
      if (graph.x.length === 0) {
        graph.x.push(edge.from.x)
        graph.y.push(edge.from.y)
      }

      graph.x.push(edge.to.x)
      graph.y.push(edge.to.y)
    }

    if ($checkboxSlabs.prop('checked')) {
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
          name: `y = ${value}`,
          line: {
            width: 1,
            color: '#33CC99'
          }
        })
      }
    }

    data.push(graph)
  } else {
    for (let edge of task.edges) {
      data.push({
        x: [edge.from.x, edge.to.x],
        y: [edge.from.y, edge.to.y],
        type: 'scatter'
      })
    }
  }

  if (isWorkableGraph) {
    $facetsCount.text(task.facets)

    console.time('slabs precalc')
    slabs = null
    slabs = new Slabs(task.edges)
    console.timeEnd('slabs precalc')

    let facets = {
      x: [],
      y: [],
      mode: 'markers+text',
      type: 'scatter',
      text: [],
      name: 'Грани',
      textposition: 'top center',
      marker: {
        size: 15,
        color: '#CC3300'
      }
    }

    for (let i = 0, f = slabs.facets; i < f.length; ++i) {
      facets.x.push(f[i].x)
      facets.y.push(f[i].y)
      facets.text.push(`Грань № ${i + 1}`)
    }

    if ($checkboxFacets.prop('checked')) {
      data.push(facets)
    }

    if (!_.isNull(localizePoint)) {
      let point = {
        x: [localizePoint.x],
        y: [localizePoint.y],
        mode: 'markers',
        type: 'scatter',
        name: 'Исследуемая точка',
        marker: {
          size: 10,
          color: 'red'
        }
      }

      data.push(point)

      let result = slabs.localizePoint(localizePoint)
      let o = {
        message: ''
      }

      switch (result.type) {
        case 'on vertex':
          o.message = 'точка расположена в вершине графа.'
          break

        case 'on edge':
          o.message = 'точка расположена на ребре ' + Mustache.render(template.edge, result.edge)
          break

        case 'in':
          o.message = `точка расположена внутри графа, грань № ${result.slab.facet + 1}, заключенная в полосе [${result.slab.from}, ${result.slab.to}] между рёбрами ` + Mustache.render(template.edge, result.edges.left) +
            ' и ' +
            Mustache.render(template.edge, result.edges.right)

          break

        case 'out':
          o.message = `точка расположена снаружи графа, грань № ${result.facet + 1} (внешняя)`
          break

        default:
          o.message = 'Ошибка'
      }

      $answer.html(Mustache.render(template.answer, o))
    } else {
      $answer.html('')
    }

    for (let edge of slabs.paths) {
      break
      data.push({
        x: [edge.from.x, edge.to.x],
        y: [edge.from.y, edge.to.y],
        type: 'scatter'
      })
    }
  } else {
    $facetsCount.text('н/д')
    slabs = null
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
