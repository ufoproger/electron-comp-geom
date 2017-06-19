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

// Элементы страницы
const $edges = $('#edges > tbody')
const $edgesCount = $('#edges-count, #graph-edges-count')
const $vertexesCount = $('#graph-vertexes-count')
const $facetsCount = $('#graph-facets-count')
const $newEdge = $('#new-edge')
const $point = $('#point')
const $pointDelete = $('#point-delete')
const $checkboxSlabs = $('#show-slabs')
const $checkboxFacets = $('#show-facets')
const $answer = $('#answer')

// Шаблоны
let template = {}

// Область графика
let gd
// Логика работы с графом
let task = new Task()
// Метод полос
let slabs = null
// Точка, которую необходимо локализовать
let localizePoint = null
// Граф, с которым можно работать
let isWorkableGraph = false

// Когда страница готова
$(document).ready(function () {
  // Инициализируем шаблоны
  template = {
    edgeLabel: $('#template-edge-label').html(),
    edgeRow: $('#template-edge-row').html(),
    edge: $('#template-edge').html(),
    answer: $('#template-point-answer').html()
  }

  // Выделяем под график место
  gd = Plotly.d3.select('#plot').node()
  /*
  task.edgesArr = [
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
  ]
  */
  // Удаление рёбер в таблице
  $edges.on('click', 'a', function (e) {
    // Прерываем цепочку вызовов
    e.preventDefault()

    // Уходим в строку таблицы
    let $el = $(this).closest('tr')

    // Удаляем ребро
    task.removeByHash($el.data('hash'))
    // И строку
    $el.remove()
  })

  // Чекбоксы внешнего вида графика
  $checkboxSlabs.on('change', task.syncCallback)
  $checkboxFacets.on('change', task.syncCallback)

  // Валидация формы локализации точки
  $point.validator().on('submit', (e) => {
    // Если была ошибка валидации
    if (e.isDefaultPrevented()) {
      // Сообщаем
      $.notify({
        title: 'Некорректные данные',
        message: 'Не все поля заполнены должным образом'
      }, {
        type: 'danger'
      })

      // Нечего локализовать
      localizePoint = null
      return
    }

    e.preventDefault()

    // Если метод полос не применим
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

    // Получаем координаты точки
    let x = parseFloat($point.find('#point-x').val())
    let y = parseFloat($point.find('#point-y').val())

    // Задаем новую точку для локализации
    localizePoint = new Point(x, y)

    // Пока обновить график
    task.syncCallback()
  })

  // Удаление точки, которую необходимо локализовать
  $pointDelete.click(function (e) {
    e.preventDefault()

    $point.find('#point-x').val('')
    $point.find('#point-y').val('')

    localizePoint = null

    task.syncCallback()
  })

  // Добавление ребра в граф
  $newEdge.validator().on('submit', (e) => {
    // Если ошибка валидации, то сообщаем об этом
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
    // Иначе получаем координаты ребра
    let xFrom = parseFloat($newEdge.find('#new-edge-from-x').val())
    let yFrom = parseFloat($newEdge.find('#new-edge-from-y').val())
    let xTo = parseFloat($newEdge.find('#new-edge-to-x').val())
    let yTo = parseFloat($newEdge.find('#new-edge-to-y').val())

    // Пытаем добавить
    try {
      task.addEdge(new Edge(new Point(xFrom, yFrom), new Point(xTo, yTo)))

      $.notify({
        message: 'Ребро успешно добавлено.'
      })
    } catch (e) {
      // Добавить не получилось
      $.notify({
        title: 'Ошибка добавления ребра!',
        message: e.message
      }, {
        type: 'danger'
      })
    }
  })

  // Пользователь хочет открыть файл с графом
  $('#open-file').click(function (e) {
    ipc.send('open-file-dialog')
  })

  // Пользователь хочет сохранить граф
  $('#save-file').click(function (e) {
    ipc.send('save-file-dialog')
  })

  // Пользователь выбрал файл с графом
  ipc.on('opened-file', (event, file) => {
    // Читаем файл
    fs.readFile(file, 'utf-8', function (err, data) {
      // Пытаемся его загрузить
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

  // Пользователь выбрал файл для сохранения
  ipc.on('saved-file', (event, file) => {
    fs.writeFileSync(file, JSON.stringify(task.edgesArr))
  })
})

// При изменение размера окна изменяем размер графика
window.onresize = function () {
  Plotly.Plots.resize(gd)
}

// Обновляем график при обновлении состава графа
task.syncCallback = () => {
  // Обволяем контент с информацией о графике
  $edges.empty()
  $edgesCount.text(task.edges.length)
  $vertexesCount.text(task.points.length)

  for (let edge of task.edges) {
    $edges.append(Mustache.render(template.edgeRow, edge.objWithHash))
  }

  // Предполагаем, что граф корректный
  isWorkableGraph = true

  // Если граф не цикличный
  if (!task.isCiclicGraph) {
    isWorkableGraph = false

    $.notify({
      title: 'Ошибка входных данных!',
      message: 'Граф не является цикличным.'
    }, {
      type: 'danger'
    })
  }

  // Строим график графа
  console.time('connected graph path')
  let pathEdges = task.connectedGraphPath
  console.timeEnd('connected graph path')
  let data = []

  // Если не удалось построить, то граф нам не подходит
  if (!pathEdges.length) {
    isWorkableGraph = false

    $.notify({
      title: 'Неверные входные данные!',
      message: 'Граф не является связным! Н - невозможно.'
    }, {
      type: 'danger'
    })
  }

  // Если всё ок, выводим граф
  if (pathEdges.length && isWorkableGraph) {
    let graph = {
      x: [],
      y: [],
      type: 'scatter',
      name: 'Граф',
      marker: {
        size: 8,
        color: '#00ccff'
      },
      line: {
        width: 3,
        color: '#00ccff'
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

    // Если надо вывести границы полос, то выводим
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
            width: 2,
            color: '#194d00'
          }
        })
      }
    }

    data.push(graph)
  } else {
    // Иначе выводим рёбра графа для наглядности того, почему он нам не подходит
    for (let edge of task.edges) {
      data.push({
        x: [edge.from.x, edge.to.x],
        y: [edge.from.y, edge.to.y],
        type: 'scatter',
        name: 'Ребро'
      })
    }
  }

  // Если граф корректный
  if (isWorkableGraph) {
    // Вычисляем кол-во граней
    $facetsCount.text(task.facets)

    // Предобработка метода полос
    console.time('slabs precalc')
    slabs = null
    slabs = new Slabs(task.edges)
    console.timeEnd('slabs precalc')

    // Визуально обозначаем на графе где какая грань
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

    // Если надо вывести на график грани - выводим
    if ($checkboxFacets.prop('checked')) {
      data.push(facets)
    }

    // Если есть точка, которую надо локализовать
    if (!_.isNull(localizePoint)) {
      let point = {
        x: [localizePoint.x],
        y: [localizePoint.y],
        mode: 'markers',
        type: 'scatter',
        name: 'Исследуемая точка',
        marker: {
          size: 10,
          color: '#bf00ff'
        }
      }

      data.push(point)

      // Локализуем
      let result = slabs.localizePoint(localizePoint)
      let o = {
        message: ''
      }

      // Выводим ответ
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

  // Если граф есть, то выводим его
  if (task.edges.length) {
    Plotly.plot(gd, data, layout, options)
  }
}
