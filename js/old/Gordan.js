/* Licensed under MIT: https://github.com/tavuntu/gordan/blob/master/LICENSE.md
*/

/**
 * Returns an Object containing Gordan API, some functions are "private"
 */
const Gordan = (() => {
  const DEFAULT_GRANULARITY = 0.1;
  const API = {
    /**
     * Adds 2 rows
     * @param {number[]} row1 - The first row to add
     * @param {number[]} row2 - The second row to add
     * @param {number} invert1 - If not falsy, the first row gets inverted
     * @param {number} invert2 - If not falsy, the second row gets inverted
     * @returns {number[]} The 2 rows added
     */
    addRows(row1, row2, invert1, invert2) {
      let row3 = []
  
      row3 = row1.map((item, i) => {
        return row1[i] * (invert1 ? -1 : 1) + row2[i] * (invert2 ? -1 : 1)
      })
  
      return row3
    },
    /**
     * Multiplies a row for a value
     * @param {number[]} row - The row to multiply
     * @param {number} value - The value to multiply each of the row elements
     * @returns {number[]} The multiplied row
     */
    multiplyRow(row, value) {
      return row.map(item => item * value)
    },
    /**
     * Divides a row for a value
     * @param {number[]} row - The row to divide
     * @param {number} value - The value to divide each of the row elements
     * @returns {number[]} The divided row
     */
    divideRow(row, value) {
      return row.map(item => item / value)
    },
    /**
     * Takes an augmented matrix and returns the identity matrix
     * @param {number[][]} matrix - The augmented matrix
     * @param {number} index - Used for recursive internal logic,
     * this function calls itself in order to solve the matrix row by row
     * @returns {number[][]} The indentity matrix + solution coefficients
     */
    solveByGaussJordan(matrix, i = 0) {
      if (i == matrix.length) {
        return fixedPrecisionMatrix(matrix)
      }
  
      let m = [...matrix]
      let currentRow = m[i]
      let pivot = currentRow[i]
  
      m[i] = this.divideRow(currentRow, pivot)
  
      m = m.map((item, mapIndex) => {
        if (mapIndex == i) { // ignore already processed row
          return item
        } else {
          return this.addRows(this.multiplyRow(m[i], -item[i]), item)
        }
      })
  
      return this.solveByGaussJordan(m, i + 1)
    },
    /**
     * Takes an augmented matrix and returns only the solution coefficients
     * @param {number[][]} matrix - The augmented matrix
     * this function calls itself in order to solve the matrix row by row
     * @returns {number[]} The solution coefficients
     */
    getSymbolValues(matrix) {
      return this.solveByGaussJordan(matrix).map(row => {
        return row[row.length - 1]
      })
    },
    /**
     * Takes an augmented matrix and returns only the solution coefficients
     * @param {number[]} points - The list of points on the plane
     * @returns {{x, y}[]} The normalized ({x, y}) points
     */
    normalizePoints(points) {
      return points.map(item => {
        return {
          x: item.x || item[0],
          y: item.y || item[1]
        }
      })
    },
    /**
     * Takes a list of points and creates the regression augmented matrix
     * @param {number[]} points - The list of points on the plane
     * @param {number} degreeOfEquation - A number greater than zero
     * @returns {number[][]} The regression augmented matrix
     */
    getRegressionMatrixFromPoints(points, degreeOfEquation) {
      if (degreeOfEquation < 1) {
        return 'Degree of equation must be at least 1'
      }
  
      let regressionMatrix = []
  
      for (let i = 0; i <= degreeOfEquation; i++) {
        regressionMatrix[i] = []
  
        for (let power = 0; power <= degreeOfEquation; power++) {
          regressionMatrix[i].push(getRegressionCoefficient(i, power, points))
        }
        regressionMatrix[i].push(getRegressionResult(i, points))
      }
  
      return regressionMatrix
    },
    /**
     * Returns the limits on the plane for the given points
     * @param {number[]} points - The list of points on the plane
     * @param {string} axis - "x" or "y"
     * @returns {object} Object with min and max limits
     */
    getRange(points, axis) {
      let normalizedPoints = API.normalizePoints(points).map(item => item[axis])
  
      return {
        min: Math.min(...normalizedPoints),
        max: Math.max(...normalizedPoints)
      }
    },
    /**
     * Generates a list of points for an Nth grade equation (ax^N + bx^(N - 1) + cx^(N - 2) + ...)
     * @param {number[]} points - The list of points on the plane
     * @param {number} degreeOfEquation - A number greater than zero
     * @param {number} granularity - The regression curve resolution
     * @returns {x, y}[] The list of points on the plane to draw the curve
     */
    getRegressionPath(points, degreeOfEquation, granularity = DEFAULT_GRANULARITY) {
      let curvePoints = []
      let regressionMatrix = this.getRegressionMatrixFromPoints(points, degreeOfEquation)
      let curveCoefficients = this.getSymbolValues(regressionMatrix)
      let range = this.getRange(points, 'x')
  
      for (let x = range.min; x <= range.max; x += granularity) {
        let y = 0
  
        for (let i = 0; i < curveCoefficients.length; i++) {
          let c = curveCoefficients[i]
          y += c * Math.pow(x, i)
        }
        curvePoints.push({x, y})
      }
  
      return curvePoints
    },
    /**
     * Calls Gordan.getRegressionPath for a second degree equation
     * @param {number[]} points - The list of points on the plane
     * @returns {x, y}[] The list of points on the plane to draw the curve
     */
    getQuadraticRegressionCurve(points, degree = 2, granularity = DEFAULT_GRANULARITY) {
      return this.getRegressionPath(points, degree, granularity)
    },
    /**
     * Calls Gordan.getRegressionPath for a linear grade equation
     * @param {number[]} points - The list of points on the plane
     * @returns {x, y}[] The list of points on the plane to draw the line
     */
    getLinearRegressionRect(points, degree = 1, granularity = DEFAULT_GRANULARITY) {
      return this.getRegressionPath(points, degree, granularity)
    }
  }

  /**
   * Generates a new number with the specified precision, used in this library to
   * workaround issues like 2.000000000001 or -1.99999999999992
   * @param {number} n - Number to process
   * @param {number} decimals - Number of digits after the point for the new number
   * @returns {number} The processed number
   */
  const short = (n, decimals = 3) => {
    return Number(n.toFixed(decimals))
  }

  /**
   * Creates a new identity matrix with no looseness values (like -1.99999999999992)
   * @param {number[][]} m  - The number to process
   * @returns {number[][]} The processed matrix
   */
  const fixedPrecisionMatrix = m => {
    return m.map(item => (
      [
        ...item.splice(0, item.length - 1),
        short(item[item.length - 1], 8)
      ]
    ))
  }

  /**
   * Generates variable coefficients for the regression matrix
   * @param {number} rowIndex - The row where the solution coefficient needs to be generated
   * @param {number} power - The exponential for x,
   * @param {number[number[]|{x, y}]} points - The list of points on the plane
   * @returns {number} The variable coefficient for the given row
   */
  const getRegressionCoefficient = (rowIndex, power, points) => {
    let pts = API.normalizePoints(points)

    return pts.map(p => {
      return Math.pow(p.x, power + rowIndex)
    }).reduce((a, b) => a + b)
  }

  /**
   * Generates the solution coefficients for the regression matrix
   * @param {number} power - The exponential for x
   * @param {number} points - The list of points on the plane
   * @returns {number} The solution coefficient for the given row
   */
  const getRegressionResult = (power, points) => {
    let pts = API.normalizePoints(points)

    return pts.map(p => {
      return Math.pow(p.x, power) * p.y
    }).reduce((a, b) => a + b)
  }

  return API;
})();

export default Gordan;
