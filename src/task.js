const Edge = require('./edge.js')
const Point = require('./point.js')

const _ = require('underscore')

class Task {
  constructor () {
    this._edges = []
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
      this.addEdge(Edge.createFromArr(item))
    }
  }

  addEdge (edge) {
    this._edges.push(edge)

    return true
  }

  removeByHash (h) {
    this._edges = this._edges.filter(edge => edge.hash !== h)
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
        visited[edge.hash] = edge
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
}

module.exports = Task
