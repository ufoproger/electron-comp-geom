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

  get clone () {
    return new Point(this.x, this.y)
  }

  get obj () {
    return {
      x: this.x,
      y: this.y
    }
  }

  get hash () {
    return hash(this.obj)
  }

  isEqual (point) {
    return (this.x === point.x && this.y === point.y)
  }
}

module.exports = Point
