const Edge = require('./edge.js')
const Point = require('./point.js')
const lineIntersect = require('line-intersect')

const _ = require('underscore')

// Класс, реализующий обработку графа, его наполнение и контроль корректности
class Task {
  constructor () {
    // Список рёбер
    this._edges = []
    // При изменении списка рёбер (состава графа) вызывается коллбек
    this.syncCallback = () => { console.log('Unimplemented sync callback') }
  }

  get edges () {
    return this._edges
  }

  // Список вершин графа (без дублирования)
  get points () {
    let points = {}

    // Пробегаем по всех рёбрам
    for (let edge of this.edges) {
      // Просматриваем концы ребра
      for (let key of ['from', 'to']) {
        // Если этого конца ещё нет в списке, то добавляем
        if (!_.has(points, edge[key].hash)) {
          points[edge[key].hash] = edge[key].clone
        }
      }
    }

    // Возвращаем массив с вершинами графа
    return _.values(points)
  }

  // Предполагая, что граф == ППЛГ, вычисляем количество граней по формуле Евклида
  get facets () {
    return (2 - this.points.length + this.edges.length)
  }

  // Экспорт списка рёбер в 2-мерный массив N x 4
  get edgesArr () {
    let arr = []

    for (let edge of this.edges) {
      arr.push(edge.arr)
    }

    return arr
  }

  // Импорт списка рёбер из 2-мерного массива N x 4
  set edgesArr (arr) {
    this._edges = []

    for (let item of arr) {
      this.addEdge(Edge.createFromArr(item), false)
    }

    this.syncCallback()
  }

  // Добавление ребра в граф
  addEdge (edge, sync = true) {
    // Если ребро вырождается в точку, то отсекаем
    if (edge.length === 0) {
      throw new TypeError('Ребро нулевой длины')
    }

    // Если такое ребро уже добавлено, то отсекаем
    for (let e of this.edges) {
      if (e.isEqual(edge)) {
        throw new TypeError('Такое ребро уже имеется')
      }
    }

    // Если ребро пересекается с каким-нибудь из рёбер графа (нарушает планарность), то отсекаем
    if (!this.testPlanarWithEdge(edge)) {
      throw new TypeError('Нарушение планарности графа')
    }

    // Добавляем ребро
    this._edges.push(edge)

    // Если все рёбра добавлены, то сообщаем о изменении состава графа
    if (sync) {
      this.syncCallback()
    }

    return true
  }

  // Удаление ребра по его хешу
  removeByHash (h) {
    // Удаляем ребро по хешу
    this._edges = this._edges.filter(edge => edge.hash !== h)
    // Сообщаем об изменении состава графа
    this.syncCallback()
  }

  // Проверка графа на связность. Возвращается массив с обходом графа через все вершины одним маршрутов (с повторениями рёбер)
  get connectedGraphPath () {
    // Если графа нет, то и маршрута нет
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

  // Проверка графа на связность
  get isConnectedGraph () {
    return this.connectedGraphPath.length !== 0
  }

  // Проверка графа на пересечение с указанным ребром (нарушение планарности)
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

  // Проверка графа на планарность
  get isPlanarGraph () {
    for (let edge of this.edges) {
      if (!this.testPlanarWithEdge(edge)) {
        return false
      }
    }

    return true
  }

  // Проверка графа на цикличность
  get isCiclicGraph () {
    // Запомним сколько раз каждая вершина встречается в графе
    let points = {}

    // Пробежим по всем рёбрам
    for (let edge of this.edges) {
      // Обработаем начало и конец ребра
      for (let key of ['from', 'to']) {
        let h = edge[key].hash

        // Если эту вершину уже находили, то увеличиваем количество
        if (_.has(points, h)) {
          points[h]++
        // Иначе помечаем, что встретили впервые
        } else {
          points[h] = 1
        }
      }
    }

    // Пробежим по массиву найденных вершин
    for (let key in points) {
      // Если есть вершина, из которой вышло только 1 ребро, то граф ациклический
      if (points[key] < 2) {
        return false
      }
    }

    // Иначе граф циклический
    return true
  }

  axeName (name) {
    switch (name) {
      case 'x':
      case 'X':
        return 'x'

      case 'y':
      case 'Y':
        return 'y'

      default:
        throw new RangeError('Неверное название оси координат')
    }
  }

  axeValues (name) {
    let values = _.pluck(this.points, this.axeName(name))

    values.sort((a, b) => a - b)

    return _.uniq(values, true)
  }

  get xValues () {
    return this.axeValues('x')
  }

  get yValues () {
    return this.axeValues('y')
  }

  // Минимакс графа по заданной оси
  axeRange (name) {
    let values = this.axeValues(name)

    if (!values.length) {
      values = [0]
    }

    return {
      min: values[0],
      max: _.last(values)
    }
  }

  get xRange () {
    return this.axeRange('x')
  }

  get yRange () {
    return this.axeRange('y')
  }
}
module.exports = Task
