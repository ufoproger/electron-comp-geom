const hash = require('object-hash')
const _ = require('underscore')
const Point = require('./point.js')

// Класс, реализующий отрезок на плоскости (с обобщением на ребро графа)
class Edge {
  // Исходные координаты отрезка
  constructor (from, to) {
    this._from = from
    this._to = to
  }

  // Создание экземпляра отрезка из одномерного массива с 4 числами
  static createFromArr (arr) {
    if (!_.isArray(arr) || arr.length !== 4) {
      return false
    }

    for (let number of arr) {
      if (!_.isFinite(number)) {
        return false
      }
    }

    let edge = new Edge(
      new Point(arr[0], arr[1]),
      new Point(arr[2], arr[3])
    )

    return edge
  }

  get from () {
    return this._from
  }

  get to () {
    return this._to
  }

  get obj () {
    return {
      x_from: this.from.x,
      y_from: this.from.y,
      x_to: this.to.x,
      y_to: this.to.y
    }
  }

  // Одномерный массив с координатами
  get arr () {
    return _.values(this.obj)
  }

  get objWithHash () {
    return Object.assign(this.obj, {hash: this.hash})
  }

  get hash () {
    // return `${this.from.x},${this.from.y}:${this.to.x},${this.to.y}`
    return hash(this.obj)
  }

  get clone () {
    return new Edge(this.from.clone, this.to.clone)
  }

  // Переворачиваем отрезок задом наперед
  get reverse () {
    return new Edge(this.to.clone, this.from.clone)
  }

  // Евклидова длина
  get length () {
    return Math.sqrt(Math.pow(this.to.x - this.from.x, 2) + Math.pow(this.to.y - this.from.y, 2), 2)
  }

  // Проверка эквивалентности
  isEqual (edge) {
    return (this.hasPoint(edge.from) && this.hasPoint(edge.to))
  }

  // Точка является одной из вершин этого ребра
  hasPoint (point) {
    return (this.from.isEqual(point) || this.to.isEqual(point))
  }

  // Точка либо является вершиной, либо лежит на ребре
  containsPoint (point) {
    let p = {}

    for (let key of ['x', 'y']) {
      p[key] = (point[key] - this.to[key]) / (this.from[key] - this.to[key])
    }

    let len = Math.abs(p.x - p.y)

    if (len > 1e-3 || p.x < 0 || p.x > 1) {
      return false
    }

    return true
  }

  // Противоположный конец отрезка заданного конца
  asidePoint (point) {
    // Если задано начало отрезка, то возвращаем конец
    if (this.from.isEqual(point)) {
      return this.to.clone
    }

    // Если задан конец отрезка, то возвращаем начало
    if (this.to.isEqual(point)) {
      return this.from.clone
    }

    // Иначе это какое-то недоразумение
    return null
  }

  // Упорядочиваем отрезок так, чтобы начало было снизу
  get sort () {
    return Point.comparator(this.from, this.to) ? this.clone : this.reverse
  }
}

module.exports = Edge
