const hash = require('object-hash')

// Класс, реализующий точку
class Point {
  // Координаты точки
  constructor (x = 0, y = 0) {
    this._x = x
    this._y = y
  }

  // Встроенный компаратор снизу вверх, слева направо
  static comparator (a, b) {
    return (a.x === b.x) ? (a.y < b.y) : (a.x < b.x)
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

  // Хеш экземпляра объекта для быстрого сопоставления их между собой в групповых операциях
  get hash () {
    return hash(this.obj)
  }

  // Проверка на эквивалентность в обход вычисления хеша
  isEqual (point) {
    return (this.x === point.x && this.y === point.y)
  }
}

module.exports = Point
