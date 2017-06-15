/* global $, Plotly */
const Mustache = require('mustache')
const {Task, Point, Edge} = require('./classes.js')
const ipc = require('electron').ipcRenderer

const $edges = $('#edges')
const $edgesCount = $('#edges-count')

let gd
let task = new Task()

$(document).ready(function () {
  task.addEdge(new Edge(new Point(1, 0), new Point(2, 2)))

  $edges.on('click', 'a', function (e) {
    e.preventDefault()

    let $el = $(this)

    task.removeByHash($el.data('hash'))
    $el.remove()
    syncEdgeChanges()
  })

  syncEdgeChanges()

  let trace1 = {
    x: [1, 2, 3, 4],
    y: [10, 15, 13, 17],
    type: 'scatter'
  }

  let trace2 = {
    x: [1, 2, 3, 4],
    y: [16, 5, 11, 9],
    type: 'scatter'
  }

  let data = [trace1, trace2]
  let gd3 = Plotly.d3.select('#plot')

  gd = gd3.node()

  let layout = {
    title: 'Планарный граф'
  }

  let options = {
    staticPlot: true
  }

  Plotly.plot(gd, data, layout, options)
})

window.onresize = function () {
  Plotly.Plots.resize(gd)
}

function syncEdgeChanges () {
  $edges.empty()
  $edgesCount.text(task.edges.length)

  for (let edge of task.edges) {
    $edges.append(Mustache.render($('#template-edge-label').html(), edge.objWithHash))
  }
}
