
function unique(value, index, self) {
  return self.indexOf(value) === index;
}

function rowReduce(reducee, reducer, enteringVar) {
	const factor = -1 * (reducee[enteringVar] / reducer[enteringVar]);
	return Object.keys(reducee).reduce((a, k) => {
		a[k] = reducee[k] + factor * reducer[k];
		return a;
	}, {});
}

function minPositiveElement(arr) {
	arr = arr.filter(d => d > 0);
	if (arr.length == 0) {
		return false;
	} else {
		return Math.min(...arr);
	}
}

function canReadOffSolutions(tableau) {
	let nRowsReduced = 0,
		nVarsIsolated = 0;

	tableau.forEach(function(r) {
		let sumNonZero = 0;
		Object.keys(r).forEach(function(v) {
			if (v != 'constant') {
				if (r[v] != 0) {
					sumNonZero++;
				}
			}
		})
		// console.log(sumNonZero);
		if (sumNonZero <= 1) {
			nRowsReduced++;
		}
	})

	// console.log(`nRowsReduced = ${nRowsReduced}`);
	// console.log(tableau[1]);


	if (nRowsReduced < tableau.length) {
		return false;
	}

	const vars = Object.keys(tableau[0]).filter(v => v != 'constant');

	vars.forEach(function(v) {
		let sumNonZero = 0;
		tableau.forEach(function(r) {
			if (r[v] != 0) {
				sumNonZero ++;
			}
		})
		if (sumNonZero <= 1) {
			nVarsIsolated++;
		}
	})

	return (nVarsIsolated == vars.length);

}

function rowOperation(tableau) {

	// Sort rows.
	function firstNonZeroIndex(obj) {
		return Object.values(obj).findIndex(d => (d != 0));
	}
	tableau = tableau.sort(function(a, b) {
		return firstNonZeroIndex(a) - firstNonZeroIndex(b);
	})

	// Find first column in need of reduction.
	const vars = Object.keys(tableau[0]).filter(v => v != 'constant');
	let opVar,
		opVarFound = false;
	vars.forEach(function(v) {
		if (opVarFound) {
			return;
		}
		let sumNonZero = 0;
		tableau.forEach(function(r) {
			if (r[v] != 0) {
				sumNonZero ++;
			}
		})
		if (sumNonZero > 1) {
			opVar = v;
			opVarFound = true;
		}
	})

	if (!opVarFound) {
		console.warn('Too much under-determinacy. Cannot solve (1).')
		return tableau;
	}

	// Find row to keep non-zero.
	let positiveOpVarRows = [],
		positiveRowsTaken = [];
	opVarFound = false;
	vars.forEach(function(v) {
		if (opVarFound) {
			return;
		}
		if (v == opVar) {
			tableau.forEach(function(r, i) {
				if (r[v] != 0) {
					positiveOpVarRows.push(i);
				}
			})
			opVarFound = true;
		} else {
			tableau.forEach(function(r, i) {
				if (r[v] != 0) {
					positiveRowsTaken.push(i);
				}
			})
		}
	})
	let eligibleRows = positiveOpVarRows.filter(r => !positiveRowsTaken.includes(r));
	

	if (eligibleRows.length == 0) {
		// console.log('TABLEAU WITH NO ELIGIBLE ROWS');
		// console.log(tableau.map(r => `opVar ${r[opVar]} constant ${r.constant}`));
		// console.log(canReadOffSolutions(tableau));

		let lowerBounds = [0],
			upperBounds = [];

		// Use notation ax + bs = c. The opVar is s.

		let tempTableau = tableau.filter(r => r[opVar] != 0);

		let nRowsWith2NonZeroElements = 0;
		tempTableau.forEach(function(r) {

			if (r[opVar] != 0) {
				
				// Check how many non-zero elements there are in the row.
				let sumNonZero = 0;
				Object.keys(r).forEach(function(v) {
					if (v != 'constant') {
						if (r[v] != 0) {
							sumNonZero++;
						}
					}
				})
				
				// console.log(sumNonZero);
				// console.log(tempTableau);

				if (sumNonZero == 2) {

					let a = Object.values(r)[firstNonZeroIndex(r)],
						b = r[opVar],
						c = r.constant;

					if (a*b > 0) {
						upperBounds.push(c / b);
					} else if (a*b < 0) {
						lowerBounds.push(c / b);
					}

				} else {
					console.warn('Too much under-determinacy. Cannot solve.')
					// console.log(tableau);
				}
			}
		})

		let lowerBound = Math.max(...lowerBounds),
			upperBound = upperBounds.length > 0 ? Math.min(...upperBounds) : Infinity;

		// console.log(lowerBound + ' < ' + upperBound);

		if (lowerBound > upperBound) {
			console.warn('Lower bound larger than upper bound!');
		} else {
			tableau.forEach(function(r) {
				if (r[opVar] != 0) {
					r.constant = r.constant - r[opVar]*lowerBound;
					r[opVar] = 0;
				}
			})
		}

	} else {
		
		let pivotRow = eligibleRows[0];

		// Reduce rows.
		for (let r = 0; r < tableau.length; r++) {
			if (r != pivotRow) {
				tableau[r] = rowReduce(
					tableau[r],
					tableau[pivotRow],
					opVar
				)
			}
		}

	}

	return tableau;

}

class LinearProgram {
	constructor(parameters) {
		this.objective = parameters.objective;
		this.constraints = parameters.constraints;
		this.direction = parameters.direction;
		this.working = {};
	}

	extractOptimisationVars() {
		// Get vars used in objective function.
		let vars = Object.keys(this.objective);

		// Get vars used in constraints.
		for (const constraint of this.constraints) {
			vars = vars.concat(Object.keys(constraint.coefficients));
		}

		// Remove duplicates.
		vars = vars.filter(unique);

		this.working.vars = vars;
	}

	introduceSlackVars() {
		var nSlacks = 0;

		this.working.constraints = [...this.constraints];

		let vars = this.working.vars;

		this.working.constraints.forEach(function(c) {

			// Convert inequalities to upper bounds.
			if (['>='].includes(c.relation)) {

				c.relation = c.relation.replace('>', '<');
				c.constant *= -1;
				Object.keys(c.coefficients).forEach(function(variable) {
					c.coefficients[variable] *= -1;
				})
			}

			// Where necessary, create a slack variable.
			if (['<='].includes(c.relation)) {
			
				const slackVarName = `Slack${nSlacks}`;

				// Create a slack variable.
				vars.push(slackVarName);
				nSlacks++;

				// Update constraint.
				c.coefficients[slackVarName] = 1;
				c.relation = '=';
			}

		})
	}

	introduceObjectiveVar() {
		this.working.vars = ['Objective'].concat(this.working.vars);

		const objective = this.objective;

		let objectiveConstraint = {Objective: 1};
		Object.keys(this.objective).forEach(function(p) {
			objectiveConstraint[p] = objective[p] * -1;
		})

		this.working.constraints = [
			{
				coefficients: objectiveConstraint,
				relation: '=',
				constant: 0
			}
		].concat(this.working.constraints);
	}

	createTableau() {
		const template = {};
		this.working.vars.forEach(function(p) {
			template[p] = 0;
		})
		template.constant = 0;

		const nEquations = this.working.constraints.length;
		let tableau = [];

		for (let k = 0; k < nEquations; k++) {
			tableau.push({
				...template,
				...this.working.constraints[k].coefficients,
				constant: this.working.constraints[k].constant
			});
		}

		this.working.matrices = [tableau];
	}

	isOptimal() {
		
		const 	[ latestTableau ] = [...this.working.matrices.slice(-1)],
				firstRow = {...latestTableau[0]};
		delete 	firstRow.constant;

		let 	isOptimal = true;

		for (const variable in firstRow) {
			isOptimal = isOptimal && (firstRow[variable] >= 0);
			// console.log(variable + ': ' + firstRow[variable]);
		}

		return isOptimal;
	}

	pivot() {

		const 	[ tableau ] = [...this.working.matrices.slice(-1)],
				firstRow = {...tableau[0]};
		delete 	firstRow.constant;

		// Select entering variable.

		let eligibleVars = Object.keys(firstRow).filter(function(d) {
			return firstRow[d] < 0;
		})

		if (eligibleVars.length == 0) {
			return;
		}
		
		let enteringVar = eligibleVars[0];

		// Check for unboundedness.
		
		let allNonPositive = true;
		tableau.forEach(function(r) {
			allNonPositive = (allNonPositive && r[enteringVar] <=0);
		})
		if (allNonPositive) {
			return 'UNBOUNDED';
		}
		
		// Choose pivot row.
		
		const nConstraints = this.working.constraints.length;
		let ratios = [];
		for (let k = 1; k < nConstraints; k++) {
			ratios.push(
				tableau[k].constant / tableau[k][enteringVar]
			);
		}
		if (!minPositiveElement(ratios)) {
			return('NO_POSITIVE_RATIOS');
		}
		const pivotRow = ratios.indexOf(minPositiveElement(ratios)) + 1;
		// console.log(pivotRow);

		// Perform pivot.
		for (let k = 0; k < nConstraints; k++) {
			if (k != pivotRow) {
				tableau[k] = rowReduce(
					tableau[k],
					tableau[pivotRow],
					enteringVar
				)
			}
		}
				
		this.working.matrices.push([...tableau]);

		return 'SUCCESS';

	}

	getBasicSolution() {

		let 	[ tableau ] = [...this.working.matrices.slice(-1)],
				firstRow = {...tableau[0]};

		const objective = this.objective;
		// console.log(tableau);

		// Set basic variables to 0.
		let nonBasicVars = this.working.vars
			.filter(d => (firstRow[d] != 0 && d != 'Objective'));
		for (let k = 0; k < tableau.length; k++) {
			for (const v of nonBasicVars) {
				tableau[k][v] = 0;
			}
		}

		let solution = {};

		// Extract objective value.
		solution.Objective = tableau[0].constant;

		// Perform Gauss-Jordan elimination.
		// console.log(this.working.vars);
		const maxIter = 20;
		let nIter = 0;
		while (!canReadOffSolutions(tableau) && nIter < maxIter) {
			tableau = rowOperation(tableau);
			nIter++;
		}
		console.log(`Gauss-Jordan elimination took ${nIter} iterations.`);

		this.working.vars
			.filter(d => (d != 'Objective' && d.slice(0,5) != 'Slack'))
			.forEach(d => {

				// If non-basic variable...
				if (firstRow[d] != 0) {
					solution[d] = 0;
				}

				// Else if basic variable...
				else {
					let relevantRow = tableau.findIndex(
						r => (r[d] != 0)
					);
					solution[d] = tableau[relevantRow].constant / tableau[relevantRow][d];
				}

			})

		// Round solution.
		Object.keys(solution)
			.forEach(v => {
				solution[v] = Math.round(10000 * solution[v]) / 10000;
			})

		return solution;

	}

	solve() {

		// SETUP
		this.extractOptimisationVars();
		this.introduceSlackVars();
		this.introduceObjectiveVar();
		this.createTableau();

		// PIVOT UNTIL OPTIMAL
		const maxIters = 50;
		let nIters = 0;
		while (!this.isOptimal() && nIters < maxIters) {
			let result = this.pivot();
			nIters++;

			if (result == 'UNBOUNDED') {
				console.warn(`UNBOUNDED FEASIBLE REGION\n
					The simplex method aborted.`)
				break;
			} else if (result == 'NO_POSITIVE_RATIOS') {
				console.warn(`NO POSITIVE RATIOS\n
					The simplex method aborted.`)
				break;
			}
		}

		if (this.isOptimal()) {
			console.log(`Simplex method converged in ${nIters} iterations.`);
		} else {
			console.warn(`Simplex method failed to converge in ${nIters} iterations.`);
		}
		
		// console.log(this.working.matrices);

		console.log(this.getBasicSolution());

		// console.log(this.isOptimal());
		// console.log(this.working.matrices);
		// console.log(this.working.constraints);
	}
}

export default LinearProgram;