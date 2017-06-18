const _ = require('underscore')
const Point = require('./point.js')
const Edge = require('./edge.js')

const lineIntersect = require('line-intersect')
const Queue = require('queue-fifo')
class Slabs {
  constructor (edges) {
    if (!edges.length) {
      throw new Error('Нет графа!')
    }

    this._range = {
      min: edges[0].from.x,
      max: edges[0].from.x
    }
    this._edges = []
    this._values = []

    for (let edge of edges) {
      // Переориентируем рёбра снизу вверх, т.к. будет заметать плоскость снизу вверх по оси ординат
      this._edges.push(edge.sort)

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

    this._values.sort((a, b) => a - b)

    // Сортируем по оси абсцисс верхнюю вершину ребра, чтобы быстрее находить пересечения с трапециями в полосе
    this._edges.sort((a, b) => a.to.x === b.to.x ? a.from.x - b.from.x : a.to.x - b.to.x)
    this._slabs = []

    for (let i = 1; i < this._values.length; ++i) {
      this._slabs.push({
        from: this._values[i - 1],
        to: this._values[i],
        middle: (this._values[i] + this._values[i - 1]) * 0.5,
        edges: []
      })
    }

    let borders = {
      top: this.intersectingOnY(this._slabs[0].from),
      bottom: null
    }

    this._paths = []

    for (let slab of this._slabs) {
      slab.edges = this.intersectingOnY(slab.middle)

      borders.bottom = borders.top
      borders.top = this.intersectingOnY(slab.to)

      let indexes = {
        top: 0,
        bottom: 0
      }

      for (let i = 1; i < slab.edges.length; ++i) {
        let left = slab.edges[i - 1]
        let right = slab.edges[i]

        for (let key in borders) {
          let border = borders[key]

          while (border[indexes[key]].edge.hash !== left.edge.hash) {
            indexes[key]++
          }

          while (border[indexes[key]].edge.hash !== right.edge.hash) {
            let e = new Edge(
              new Point((left.value + right.value) * 0.5, slab.middle),
              new Point(
                (border[indexes[key]].value + border[indexes[key] + 1].value) * 0.5,
                (key === 'top' ? slab.to : slab.from)
              )
            )

            this.pushPath(e, left, right, slab)
            indexes[key]++
          }
        }
      }
    }

    this.processPaths()
  }

  pathsDfs (number, start) {
    let q = new Queue()

    q.enqueue(start)

    while (q.size()) {
      let point = q.peek()
      q.dequeue()

      for (let path of this._paths) {
        if (path.number || !path.edge.hasPoint(point)) {
          continue
        }

        path.number = number
        q.enqueue(path.edge.asidePoint(point))
      }
    }
  }

  processPaths () {
    let number = 0

    for (let i = 0; i < this._paths.length; ++i) {
      let path = this._paths[i]

      if (!path.number) {
        this.pathsDfs(++number, path.edge.from)
      }
    }

    let badNumbers = []

    for (let facets = this.facetsCount; number >= facets; --number) {
      let badNumber = 0

      for (let path of this._paths) {
        let edge = path.edge.sort

        edge._to = edge.from.clone
        edge._from._y = this._slabs[0].from

        if (!this.isIntersectWithEdges(edge)) {
          badNumber = path.number
          badNumbers.push(badNumber)

          break
        }
      }

      if (!badNumber) {
        continue
      }

      this._paths = this._paths.filter(path => path.number !== badNumber)
    }

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

  get facets () {
    return this._facets
  }

  pushPath (edge, left, right, slab) {
    if (this.isIntersectWithEdges(edge)) {
      edge._to = edge.from
    }

    for (let path of this._paths) {
      if (path.edge.hash === edge.hash) {
        return
      }
    }

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

  get paths () {
    let paths = []

    for (let path of this._paths) {
      paths.push(path.edge)
    }

    return paths
  }

  get facetsCount () {
    return (2 - this.points.length + this._edges.length)
  }

  localizePoint (point) {
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
