const hash = require('object-hash')
const _ = require('underscore')
const Point = require('./point.js')

class Edge {
  constructor (from, to) {
    this._from = from
    this._to = to
  }

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

  get arr () {
    return _.values(this.obj)
  }

  get objWithHash () {
    return Object.assign(this.obj, {hash: this.hash})
  }

  get hash () {
    return hash(this.obj)
  }

  get clone () {
    return new Edge(this.from.clone, this.to.clone)
  }

  get reverse () {
    return new Edge(this.to.clone, this.from.clone)
  }

  isEqual (edge) {
    return (this.hasPoint(edge.from) && this.hasPoint(edge.to))
  }

  hasPoint (point) {
    return (this.from.isEqual(point) || this.to.isEqual(point))
  }

  asidePoint (point) {
    if (this.from.isEqual(point)) {
      return this.to.clone
    }

    if (this.to.isEqual(point)) {
      return this.from.clone
    }

    return null
  }
}

module.exports = Edge
