
function multiply(object, factor) {

	let newObject = {...object};

	Object.keys(newObject).forEach(function(d) {
		newObject[d] *= factor;
	})

	return newObject;

}

function unique(value, index, self) {
  return self.indexOf(value) === index;
}

class LinearProgram {
	constructor(parameters) {
		this.objective = parameters.objective;
		this.constraints = parameters.constraints;
		this.direction = parameters.direction;
		this.standardForm = {};
		this.tableaus = [];
		this.result = {};
		this.result.solutions = [];
	}

	toStandardForm() {

		// 1 - Make optimisation direction 'maximisation'.

		this.standardForm.direction = 'max';
		if (this.direction == 'min') {
			this.standardForm.objective = multiply(this.objective, -1);
		} else {
			this.standardForm.objective = {...this.objective};
		}
		
		// 2 - Convert inequality constraints to upper bounds.

		this.standardForm.constraints = [];
		for (let k = 0; k < this.constraints.length; k++) {
			this.standardForm.constraints.push({...this.constraints[k]});
		}
		this.standardForm.constraints.forEach(function(c) {

			if (['>='].includes(c.relation)) {

				c.relation = c.relation.replace('>', '<');
				c.constant *= -1;
				Object.keys(c.coefficients).forEach(function(variable) {
					c.coefficients[variable] *= -1;
				})
			}
		})

		// 3 - Add slack variables to convert constraints to equalities.

		let nSlacks = 0;
		this.standardForm.constraints.forEach(function(c) {

			if (['<='].includes(c.relation)) {
			
				const slackVarName = `Slack${nSlacks}`;

				// Create a slack variable.
				nSlacks++;

				// Update constraint.
				c.coefficients[slackVarName] = 1;
				c.relation = '=';
			}
		})

		// 4 - Assume (for now) that all variables are non-negative.

	}

	extractVars() {
		// Get vars used in objective function.
		let vars = Object.keys(this.objective);

		// Get vars used in constraints.
		for (const constraint of this.constraints) {
			vars = vars.concat(Object.keys(constraint.coefficients));
		}

		// Remove duplicates.
		vars = vars.filter(unique);

		this.standardForm.vars = vars;
	}

	setupTableau() {

		let t = {}; // t for tableau

		let { vars,
			  constraints,
			  objective } = this.standardForm;

		let { subset,
			  multiply,
			  inv,
			  transpose,
			  subtract } = math;

		// Create initial basis.
		t.basic = vars.filter(d => d.slice(0,5) == 'Slack');
		t.nonbasic = vars.filter(d => !t.basic.includes(d));
		t.basicIndices = [];
		t.nonbasicIndices = [];
		for (let v = 0; v < vars.length; v++) {
			if (t.basic.includes(vars[v])) {
				t.basicIndices.push(v);
			} else {
				t.nonbasicIndices.push(v);
			}
		}

		// Create A.
		this.standardForm.A = [];
		for (let c = 0; c < constraints.length; c++) {
			let row = [];
			for (let v = 0; v < vars.length; v++) {
				row.push(constraints[c].coefficients.hasOwnProperty(vars[v])
							? constraints[c].coefficients[vars[v]]
							: 0);
			}
			this.standardForm.A.push(row);
		}

		// Create c.
		this.standardForm.c = [];
		for (let v = 0; v < vars.length; v++) {
			this.standardForm.c
				.push(objective.hasOwnProperty(vars[v]) ? [objective[vars[v]]] : [0]);
		}

		// Create b.
		this.standardForm.b = [];
		for (let c = 0; c < constraints.length; c++) {
			this.standardForm.b
				.push([constraints[c].constant]);
		}

		// Create B.
		let { A } = this.standardForm;
		t.B = [];
		for (let i = 0; i < A.length; i++) {
			let row = [];
			for (let j = 0; j < A[0].length; j++) {
				if (t.basicIndices.includes(j)) {
					row.push(A[i][j]);
				}
			}
			t.B.push(row);
		}

		// Store B inverse for efficiency.
		t.Binv = inv(t.B);

		// Find basic solution.
		t.x_B = multiply(t.Binv, this.standardForm.b);

		// Subset c.
		t.c_B = subset(this.standardForm.c, math.index(t.basicIndices, 0));

		// Find objective value.
		t.z = multiply( transpose(t.c_B), t.x_B );

		// Find coordinate vectors.
		t.y = multiply(t.Binv, this.standardForm.A);

		// Find reduced cost coefficients.
		t.z_minus_c = subtract(
						multiply( transpose(t.c_B), t.y ),
						transpose(this.standardForm.c)
					  )

		this.tableaus.push(t);

	}

	step2() {

		let t = this.tableaus.slice(-1)[0];

		// console.log(t.z_minus_c[0]);
		// console.log(t.z_minus_c[0].some(d => d < 0));

		if (t.z_minus_c[0].some(d => d < 0)) {
			return 4; // Go to Step 4
		} else {
			return 3; // Go to Step 3
		}

	}

	step3() {

		let t = this.tableaus.slice(-1)[0];

		let { subset } = math;

		if (false) {
			// To be implemented:
			// If there exists an artificial variable with a positive
			// value then the problem is infeasible. Stop.
		} else {

			if (t.z_minus_c[0].every(d => d > 0)) {

				this.result.found = true;
				this.result.status = 'UniqueOptimalSolution';
				this.storeLatestSolution();
				return false;

			} else {

				// NB: Ambiguity in the algorithm instructions.
				// In case of error, warrants a closer study.

				let allRows = [...Array(this.standardForm.constraints.length).keys()],
					zeroIndex = t.z_minus_c[0].findIndex(d => d == 0),
					coordinates = subset(t.y, math.index(allRows, zeroIndex));


				if (coordinates.some(d => d[0] > 0)) {

					this.result.found = true;
					this.result.status = 'MultipleOptimalBasicSolutions';
					this.storeLatestSolution();
					let isCycling = this.removeDuplicateSolutions();
					return isCycling ? false : 5;

				} else {

					this.result.found = true;
					this.result.status = 'MultipleOptimalNonbasicSolutions';
					this.storeLatestSolution();
					return false;

				}
			}
		}
	}

	step4() {

		let t = this.tableaus.slice(-1)[0];

		let { subset } = math;

		for (let j = 0; j < this.standardForm.vars.length; j ++) {

			if (t.z_minus_c[0][j] < 0) {
				
				let allRows = [...Array(this.standardForm.constraints.length).keys()],
					coordinates = subset(t.y, math.index(allRows, j));
				
				if (coordinates.every(d => d[0] <= 0)) {

					this.result.found = false;
					this.result.status = 'Unbounded';
					return false;
				
				} else {

					return 5;

				}
			}
		}
	}

	step5() {

		let t = this.tableaus.slice(-1)[0];

		let { A,
			  vars,
			  constraints } = this.standardForm;

		let { subset,
			  subtract,
			  multiply,
			  transpose } = math;

		// Select variable to enter the basis (the pivot column).
		
		t.z_minus_c = math.round(t.z_minus_c, 10);
		let min_z_minus_c = Math.min(...subset(t.z_minus_c[0], math.index(t.nonbasicIndices)));
		let k = t.z_minus_c[0].findIndex(function(d, i) {
			return d == min_z_minus_c && !t.basicIndices.includes(i);
		});
		// console.log(t.basicIndices)
		// console.log(t.z_minus_c)
		// console.log(math.round(t.z_minus_c, 10))
		// console.log(k)

		// Select variable to leave the basis (the pivot row).
		
		let r,
			minVal = Infinity;
		
		for (let i = 0; i < t.y.length; i ++) {
			if (t.y[i][k] > 0) {
				if ( ( t.x_B[i][0] / t.y[i][k] ) < minVal ) {
					minVal = ( t.x_B[i][0] / t.y[i][k] );
					r = i;
				}
			}
		}

		// Step 6 - Update the tableau.

		// Make a deep copy of the tableau.
		
		let tNew = JSON.parse(JSON.stringify(t));

		// Update basis variables.
		tNew.basic = t.basic.map(function(d) {
			if (d == t.basic[r]) {
				return vars[k];
			} else {
				return d;
			}
		})
		tNew.nonbasic = vars.filter(d => !tNew.basic.includes(d));
		tNew.basicIndices = tNew.basic.map(d => vars.indexOf(d));
		tNew.nonbasicIndices = tNew.nonbasic.map(d => vars.indexOf(d));

		this.verbose && console.log(`Basic Variables: ${tNew.basic.join(', ')}`);
		
		// Update B.
		tNew.B = [];
		for (let i = 0; i < A.length; i++) {
			let row = [];
			tNew.basicIndices.forEach(function(j) {
				row.push(A[i][j])
			})
			tNew.B.push(row);
		}

		// Update c_B.
		tNew.c_B = subset(this.standardForm.c, math.index(tNew.basicIndices, 0));

		// Update rows of tableau (y).
		for (let c = 0; c < constraints.length; c++) {
			
			if (c == r) { // Update pivot row

				let pivotElement = t.y[r][k];
				for (let v = 0; v < vars.length; v++) {
					tNew.y[c][v] = tNew.y[c][v] / pivotElement;
				}

			} else { // Update another row

				let rowMultiplier = t.y[c][k] / t.y[r][k];
				for (let v = 0; v < vars.length; v++) {
					tNew.y[c][v] = t.y[c][v] - (rowMultiplier * t.y[r][v]);
				}
			}
		}

		// Update z_minus_c.
		for (let v = 0; v < vars.length; v++) {
			let rowMultiplier = t.z_minus_c[0][k] / t.y[r][k];
			tNew.z_minus_c[0][v] = t.z_minus_c[0][v] - (rowMultiplier * t.y[r][v]);
		}


		// Update x_B.
		for (let c = 0; c < constraints.length; c++) {
			if (c == r) {

				let pivotElement = t.y[r][k];
				tNew.x_B[c][0] = t.x_B[c][0] / pivotElement;

			} else {

				let rowMultiplier = t.y[c][k] / t.y[r][k];
				tNew.x_B[c][0] = t.x_B[c][0] - (rowMultiplier * t.x_B[r][0]);

			}
		}

		// Update z.
		tNew.z = t.z - ( ( t.x_B[r][0] / t.y[r][k] ) * t.z_minus_c[0][k] );

		this.tableaus.push(tNew);

		// console.log(this.tableaus)

		return 2;
	}

	storeLatestSolution() {
		let t = this.tableaus.slice(-1)[0];
		this.result.objective = math.round(t.z, 10);
		let solution = {};
		for (let v = 0; v < t.nonbasic.length; v++) {
			solution[t.nonbasic[v]] = 0;
		}
		for (let v = 0; v < t.basic.length; v++) {
			solution[t.basic[v]] = math.round(t.x_B[v][0], 10);
		}
		this.result.solutions.push(solution);
	}

	isSameSolution(a, b) {
		let { vars } = this.standardForm,
			isDifference = false;

		vars.forEach(function(v) {
			if (a[v] != b[v]) {
				isDifference = true;
			}
		})

		return !isDifference;
	}

	removeDuplicateSolutions() {

		// If only one solution so far, do nothing.

		if (this.result.solutions.length == 1) {
			return false;
		}

		// Else, remove duplicate solutions.

		let { solutions } = this.result,
			uniqueSolutions = [solutions[0]],
			uniqueSolutionIndices = [0],
			duplicatesFound = false;

		// Compare each solution...
		for (let i = 1; i < solutions.length; i++) {
			
			let s = solutions[i],
				isUnique = true;

			// ...to all existing unique solutions.
			for (let j = 0; j < uniqueSolutions.length; j ++) {

				if (this.isSameSolution(s, uniqueSolutions[j])) {
					isUnique = false;
					duplicatesFound = true;
				}
			}

			if (isUnique) {
				uniqueSolutions.push(s);
			}
		}

		this.result.solutions = uniqueSolutions;

		return duplicatesFound;
	}

	step(stepNumber) {

		switch(stepNumber) {
			case 2:
				this.verbose && console.log(`Step ${stepNumber}`);
				return this.step2();
			case 3:
				this.verbose && console.log(`Step ${stepNumber}`);
				return this.step3();
			case 4:
				this.verbose && console.log(`Step ${stepNumber}`);
				return this.step4();
			case 5:
				this.verbose && console.log(`Step ${stepNumber}`);
				return this.step5()
			default:
				return false;
		}
	}

	solve(verbose = false) {

		this.verbose = verbose;

		// Put LP into standard form.
		this.toStandardForm();

		// Check b >= 0.
		if (this.standardForm.constraints.some(d => d.constant < 0)) {
			this.result.found = false;
			this.result.status = 'NegativeStandardFormConstants';
			return;
		}

		// Extract variables.
		this.extractVars();

		// Check # variables >= # constraints.
		let { vars, constraints } = this.standardForm;
		if (vars.length < constraints.length) {
			this.result.found = false;
			this.result.status = 'MoreConstraintsThanVariables';
			return;
		}


		// 1 - Construct inital simplex tableau.

		// Assume for now that initial basis can be formed by slack variables.
		if (this.constraints.some(d => d.relation == '=')) {
			this.result.found = false;
			this.result.status = 'CannotFormInitialBasisWithSlackVariables';
			return;
		}

		this.setupTableau();

		if (this.verbose) {
			let t = this.tableaus.slice(-1)[0];
			console.log(`Basic Variables: ${t.basic.join(', ')}`);
		}
		
		// 2. Loop until solved or error reached.

		const maxIters = 100;
		let nIters = 0,
			nPivots = 0,
			nextStep = 2;
		while (nextStep && nIters < maxIters) {
			if (nextStep == 5) {
				nPivots++;
			}
			nextStep = this.step(nextStep, verbose);
			nIters++;
		}

		if (this.result.found) {
			this.verbose && console.log('Solution(s) FOUND.');
		} else {
			this.verbose && console.log('Solution(s) NOT FOUND.')
		}
		this.verbose && console.log(`Used ${nPivots} pivots, ${nIters} iterations.`);

		this.result.nPivots = nPivots;
		this.result.nIters = nIters;	
	}
}

export default LinearProgram;