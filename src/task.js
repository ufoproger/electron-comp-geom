const Edge = require('./edge.js')
const Point = require('./point.js')

const lineIntersect = require('line-intersect')

const _ = require('underscore')

class Task {
  constructor () {
    this._edges = []
    this.syncCallback = () => { console.log('unimplemented sync callback') }
  }

  get edges () {
    return this._edges
  }

  get points () {
    let points = {}

    for (let edge of this.edges) {
      for (let key of ['from', 'to']) {
        if (!_.has(points, edge[key].hash)) {
          points[edge[key].hash] = edge[key].clone
        }
      }
    }

    return _.values(points)
  }

  get edgesArr () {
    let arr = []

    for (let edge of this.edges) {
      arr.push(edge.arr)
    }

    return arr
  }

  set edgesArr (arr) {
    this._edges = []

    for (let item of arr) {
      this.addEdge(Edge.createFromArr(item), false)
    }

    this.syncCallback()
  }

  addEdge (edge, sync = true) {
    if (edge.length === 0) {
      throw new TypeError('Ребро нулевой длины')
    }

    for (let e of this.edges) {
      if (e.isEqual(edge)) {
        throw new TypeError('Такое ребро уже имеется')
      }
    }

    if (!this.testPlanarWithEdge(edge)) {
      throw new TypeError('Нарушение планарности графа')
    }

    this._edges.push(edge)

    if (sync) {
      this.syncCallback()
    }

    return true
  }

  removeByHash (h) {
    this._edges = this._edges.filter(edge => edge.hash !== h)
    this.syncCallback()
  }

  get connectedGraphPath () {
    if (this.edges.length === 0) {
      return []
    }

  // Список посещённых вершин
    let visited = {}
  // Маршрут, которым посещаются все вершины (через одно ребро можно проходить неограниченное число раз)
    let path = []

  // Начинаем с первого ребра и сразу помечаем вершины посещенными
    path.push(this.edges[0].clone)
    visited[path[0].hash] = path[0].clone

  // Пытаемся посетить вершины, пока все не посещены
    for (let len = this.edges.length; _.values(visited).length !== len;) {
    // Берем вершину из конца пути
      let point = _.last(path).to.clone
    // Флажок успешного поиска вершины, из которой можно продолжить путь
      let isOk = false

    // Перебираем все рёбра графа
      for (let edge of this.edges) {
      // Проверяем, является ли ребро продолжением нашего маршрута
        let asidePoint = edge.asidePoint(point)

      // Если не является или ведёт в посещенную вершину, то поищем другое
        if (_.isNull(asidePoint) || _.has(visited, edge.hash) || _.has(visited, edge.reverse.hash)) {
          continue
        }

      // Нашли подходящее ребро, которое включаем в маршрут
        visited[edge.hash] = edge.clone
        path.push(new Edge(point, asidePoint))
        isOk = true
        break
      }

    // Маршрут линейно строится, отправляемся проверять количество найденных вершин
      if (isOk) {
        continue
      }

    // Иначе мы в тупике и надо отойти по нашему маршруту назад до тех пор, пока не найдется вершина, из которой доступа не посещённая вершина
      for (let i = path.length - 1; i >= 0; --i) {
        let backPoint = path[i].from.clone

        for (let edge of this.edges) {
          let asidePoint = edge.asidePoint(backPoint)

          if (_.isNull(asidePoint) || _.has(visited, edge.hash) || _.has(visited, edge.reverse.hash)) {
            continue
          }

          isOk = true
          break
        }

        path.push(new Edge(path[i].to.clone, backPoint))

        if (isOk) {
          break
        }
      }

      if (!isOk) {
        return []
      }
    }

    return path
  }

  get isConnectedGraph () {
    return this.connectedGraphPath.length !== 0
  }

  testPlanarWithEdge (edge) {
    for (let e of this.edges) {
      var result = lineIntersect.checkIntersection(
        e.from.x, e.from.y, e.to.x, e.to.y,
        edge.from.x, edge.from.y, edge.to.x, edge.to.y
      )

      if (result.type !== 'intersecting') {
        continue
      }

      let point = new Point(result.point.x, result.point.y)

      if (e.hasPoint(point) && edge.hasPoint(point)) {
        continue
      }

      return false
    }

    return true
  }

  get isPlanarGraph () {
    for (let edge of this.edges) {
      if (!this.testPlanarWithEdge(edge)) {
        return false
      }
    }

    return true
  }

  axeValues (name) {
    let axe = ''

    switch (name) {
      case 'x':
      case 'X':
        axe = 'x'
        break

      case 'y':
      case 'Y':
        axe = 'y'
        break

      default:
        throw new RangeError('Неверное название оси координат')
    }

    let values = _.pluck(this.points, axe)

    values.sort((a, b) => a - b)

    return _.uniq(values, true)
  }

  get xValues () {
    return this.axeValues('x')
  }

  get yValues () {
    return this.axeValues('y')
  }
}

module.exports = Task
