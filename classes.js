const hash = require('object-hash')

class Point {
  constructor (x = 0, y = 0) {
    this._x = x
    this._y = y
  }

  get x () {
    return this._x
  }

  get y () {
    return this._y
  }

  get hash () {
    return hash({
      x: this._x,
      y: this._y
    })
  }
}

class Edge {
  constructor (from, to) {
    this._from = from
    this._to = to
    this._hash = null
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

  get objWithHash () {
    return Object.assign(this.obj, {hash: this.hash})
  }

  get hash () {
    return hash(this.obj)
  }
}

class Task {
  constructor () {
    this._edges = []
  }

  get edges () {
    return this._edges
  }

  addEdge (edge) {
    this._edges.push(edge)

    return true
  }

  removeByHash (h) {
    this._edges = this._edges.filter(edge => edge.hash !== h)
  }
}

exports = Object.assign(exports, {Task, Edge, Point})
