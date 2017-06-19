const _ = require('underscore')
const Point = require('./point.js')
const Edge = require('./edge.js')

const lineIntersect = require('line-intersect')
const Queue = require('queue-fifo')

// Класс, реализующий метод полос
class Slabs {
  // Инициализация со списком рёбер
  constructor (edges) {
    if (!edges.length) {
      throw new Error('Нет графа!')
    }

    // Вычисляем границы графы по оси абсцисс
    this._range = {
      min: edges[0].from.x,
      max: edges[0].from.x
    }
    // Список вершин для работы метода
    this._edges = []
    // Список горизонтальных линий, которые делят плоскость на полосы
    this._values = []

    // Обрабатываем все исходные рёбра
    for (let edge of edges) {
      // Переориентируем рёбра снизу вверх, т.к. будет заметать плоскость снизу вверх по оси ординат
      this._edges.push(edge.sort)

      // Выбираем точки для разбиления плоскости на полосы
      for (let key of ['from', 'to']) {
        if (this._values.indexOf(edge[key].y) === -1) {
          this._values.push(edge[key].y)
        }
      }

      // Попутно выясняем ширину полосы, которой заметаем
      for (let key of ['min', 'max']) {
        this._range[key] = Math[key](
          this._range[key],
          Math[key](edge.from.x, edge.to.x)
        )
      }
    }

    // Сортируем полосы снизу вверх
    this._values.sort((a, b) => a - b)

    // Сортируем по оси абсцисс верхнюю вершину ребра, чтобы быстрее находить пересечения с трапециями в полосе
    this._edges.sort((a, b) => a.to.x === b.to.x ? a.from.x - b.from.x : a.to.x - b.to.x)
    this._slabs = []

    // Собираем информацию о полосах
    for (let i = 1; i < this._values.length; ++i) {
      this._slabs.push({
        // Нижняя прямая
        from: this._values[i - 1],
        // Верхняя прямая
        to: this._values[i],
        // Середина полосы
        middle: (this._values[i] + this._values[i - 1]) * 0.5,
        // Массив рёбер слева направо, с которыми пересекается середина полосы
        edges: []
      })
    }

    // Нахождение пересечений с рёбрами на границах полосы
    let borders = {
      top: this.intersectingOnY(this._slabs[0].from),
      bottom: null
    }

    // Найденные пути между полосами
    this._paths = []

    // Обрабатываем каждую полосу
    for (let slab of this._slabs) {
      // Находим пересечения по середине
      slab.edges = this.intersectingOnY(slab.middle)

      // Т.к. поднимаемся снизу вверх, то верхняя границу нижней полосы - это нижняя граница верхней полосы
      borders.bottom = borders.top
      borders.top = this.intersectingOnY(slab.to)

      // Сопоставление рёбер на границах полосы
      let indexes = {
        top: 0,
        bottom: 0
      }

      // Пробегаем все трапеции, которые засекли в полосе
      for (let i = 1; i < slab.edges.length; ++i) {
        // Левая сторона трапеции
        let left = slab.edges[i - 1]
        // Правая сторона трапеции
        let right = slab.edges[i]

        // Пытаемся построить пути из середины текущий трапеции на границы со смежными трапециями
        for (let key in borders) {
          let border = borders[key]

          // Пока средняя трапеция не совпала с граничной
          while (border[indexes[key]].edge.hash !== left.edge.hash) {
            indexes[key]++
          }

          // Пока мы на смежных трапециях, строим пути
          while (border[indexes[key]].edge.hash !== right.edge.hash) {
            let e = new Edge(
              new Point((left.value + right.value) * 0.5, slab.middle),
              new Point(
                (border[indexes[key]].value + border[indexes[key] + 1].value) * 0.5,
                (key === 'top' ? slab.to : slab.from)
              )
            )

            // Сохраняем путь
            this.pushPath(e, left, right, slab)
            indexes[key]++
          }
        }
      }
    }

    // Чистим черновые пути
    this.processPaths()
  }

  // Обход путей в глубину для нахождения компонент связности
  pathsDfs (number, start) {
    // Заводим очереть FIFO
    let q = new Queue()

    // Добавляем начальную точку
    q.enqueue(start)

    // Пока не обошли все смежные вершны
    while (q.size()) {
      // Переходим в вершиу
      let point = q.peek()
      q.dequeue()

      // И находим все смежные вершины
      for (let path of this._paths) {
        if (path.number || !path.edge.hasPoint(point)) {
          continue
        }

        // Помечаем путь номером компоненты связности
        path.number = number
        q.enqueue(path.edge.asidePoint(point))
      }
    }
  }

  // Чистка черного варианта путей
  processPaths () {
    let number = 0

    // Считаем количество компонент связности
    for (let i = 0; i < this._paths.length; ++i) {
      let path = this._paths[i]

      if (!path.number) {
        this.pathsDfs(++number, path.edge.from)
      }
    }

    // Если компонент связности больше, чем граней (мусорные компоненты на внешней грани)
    let badNumbers = []

    // Пока не сравняем количество компонент и количество граней
    for (let facets = this.facetsCount; number >= facets; --number) {
      let badNumber = 0

      for (let path of this._paths) {
        // Обрабатываем каждый шаг
        let edge = path.edge.sort

        // Проводим из него вертикальную линию вниз
        edge._to = edge.from.clone
        edge._from._y = this._slabs[0].from

        // Если линия не попала в граф, то этот шаг снаружи и его можно удалить
        if (!this.isIntersectWithEdges(edge)) {
          badNumber = path.number
          badNumbers.push(badNumber)

          break
        }
      }

      if (!badNumber) {
        continue
      }

      // Удаляем мусорные шаги
      this._paths = this._paths.filter(path => path.number !== badNumber)
    }

    // Храним из каждой грани по одной точке
    let facets = []

    for (let i = 1, len = this.facetsCount; facets.length < len; ++i) {
      if (badNumbers.indexOf(i) !== -1) {
        continue
      }

      facets.push(i)
    }

    for (let path of this._paths) {
      path.facet = facets.indexOf(path.number)
    }

    this._facets = []

    for (let i = 0; i < this.facetsCount - 1; ++i) {
      this._facets.push(null)
    }

    for (let path of this._paths) {
      if (_.isNull(this._facets[path.facet])) {
        this._facets[path.facet] = path.edge.to
      }
    }

    let facet = this._edges[0].from

    facet._x--
    facet._y--

    this._facets.push(facet)
  }

  // Список всех вершин графа
  get points () {
    let points = {}

    for (let edge of this._edges) {
      for (let key of ['from', 'to']) {
        if (!_.has(points, edge[key].hash)) {
          points[edge[key].hash] = edge[key].clone
        }
      }
    }

    return _.values(points)
  }

  // Список визуальных точек, по одной на грань
  get facets () {
    return this._facets
  }

  // Добавление шага между трапециями в методе полос
  pushPath (edge, left, right, slab) {
    // Если при шаге наступаем на ребро графа, то вырождаем шаг в точку
    if (this.isIntersectWithEdges(edge)) {
      edge._to = edge.from
    }

    // Если такого шага не было
    for (let path of this._paths) {
      if (path.edge.hash === edge.hash) {
        return
      }
    }

    // Добавляем его
    this._paths.push({
      slab: slab.middle,
      edges: {
        left,
        right
      },
      edge,
      facet: 0,
      number: 0
    })
  }

  // Пересечение с ребрами на горизонтальной прямой
  intersectingOnY (y) {
    let result = []

    for (let edge of this._edges) {
      let value = this.intersectingEdgeOnY(edge, y)

      if (_.isNull(value)) {
        continue
      }

      result.push({
        edge,
        value
      })
    }

    return result
  }

  // Пересечение ребра с горизонтальной прямой
  intersectingEdgeOnY (edge, y) {
    var result = lineIntersect.checkIntersection(
      edge.from.x, edge.from.y, edge.to.x, edge.to.y,
      this._range.min, y, this._range.max, y
    )

    switch (result.type) {
      case 'colinear':
        return (edge.from.x + edge.to.x) * 0.5

      case 'intersecting':
        return result.point.x
    }

    return null
  }

  // Пересечение ребра с рёбрами графа
  isIntersectWithEdges (edge) {
    for (let e of this._edges) {
      let result = lineIntersect.checkIntersection(
        edge.from.x, edge.from.y, edge.to.x, edge.to.y,
        e.from.x, e.from.y, e.to.x, e.to.y
      )

      if (result.type === 'intersecting') {
        return true
      }
    }

    return false
  }

  // Все найденные маршруты между трапециями
  get paths () {
    let paths = []

    for (let path of this._paths) {
      paths.push(path.edge)
    }

    return paths
  }

  // Подсчёт количества граней по формуле Евклида
  get facetsCount () {
    return (2 - this.points.length + this._edges.length)
  }

  // Задача локализации точки в ППЛГ
  localizePoint (point) {
    // Исключительные случаи, когда точка лежит на самом графе
    for (let edge of this._edges) {
      if (edge.containsPoint(point)) {
      // if (lineIntersect.colinearPointWithinSegment(point.x, point.y, edge.from.x, edge.from.y, edge.to.x, edge.to.y)) {
        if (edge.hasPoint(point)) {
          return {type: 'on vertex'}
        } else {
          return { type: 'on edge', edge: edge.clone }
        }
      }
    }

    for (let slab of this._slabs) {
      // Если точка точно лежит за пределами полосы
      if (point.y < slab.from || point.y > slab.to) {
        continue
      }

      let line = this.intersectingOnY(point.y)

      for (let i = 1; i < line.length; ++i) {
        if (point.x >= line[i - 1].value && point.x <= line[i].value) {
          return {
            type: 'in',
            slab: {
              facet: this.searchPathsFacet(slab, line[i - 1].edge, line[i].edge),
              from: slab.from,
              to: slab.to
            },
            edges: {
              left: line[i - 1].edge,
              right: line[i].edge
            }
          }
        }
      }

      break
    }

    return {
      type: 'out',
      facet: this.facetsCount
    }
  }

  // Определяем принадлежность точки грани по трапеции в полосе
  searchPathsFacet (slab, left, right) {
    for (let path of this._paths) {
      if (path.slab === slab.middle && path.edges.left.edge.hash === left.hash && path.edges.right.edge.hash === right.hash) {
        return path.facet
      }
    }

    return this.facetsCount - 1
  }
}

module.exports = Slabs
