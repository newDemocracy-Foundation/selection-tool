importScripts(
	'https://unpkg.com/javascript-lp-solver/prod/solver.js',
	'/js/math.min.js'
	)

var input,
	categories,
	nPeopleWanted;

function unique(value, index, self) {
  return self.indexOf(value) === index;
}

function deepCopy(arr) {
	let copy = [];
	arr.forEach(function(d) {
		copy.push({...d});
	})
	return copy;
}

function arrayInArray(elementArray, arrayOfArrays) {

	let inArray = false;

	arrayOfArrays.forEach(arr => {
		if (symmetricDifference(arr, elementArray).length == 0) {
			inArray = true;
		}
	})

	return inArray;

}

function symmetricDifference() {
    var sets = [], result = [];
    var args = Array.prototype.slice.call(arguments, 0);
    args.forEach(function(arr) {
        sets.push(new Set(arr));
    });
    args.forEach(function(array, arrayIndex) {
        array.forEach(function(item) {
            var found = false;
            for (var setIndex = 0; setIndex < sets.length; setIndex++) {
                if (setIndex !== arrayIndex) {
                    if (sets[setIndex].has(item)) {
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                result.push(item);
            }
        });
    });
    return result;
}

function duplicateElements(arr) {

	if (arr.length == 1) {
		return false;
	}

	// Else, check for duplicates.

	let uniqueElements = [arr[0]],
		uniqueElementIndices = [0],
		duplicatesFound = false;

	// Compare each solution...
	for (let i = 1; i < arr.length; i++) {
		
		let el = arr[i],
			isUnique = true;

		// ...to all existing unique solutions.
		for (let j = 0; j < uniqueElements.length; j ++) {

			if (isSameObject(el, uniqueElements[j])) {
				isUnique = false;
				duplicatesFound = true;
			}
		}

		if (isUnique) {
			uniqueElements.push(el);
		}
	}

	return duplicatesFound;
}

function isSameObject(a, b) {
	let keys = Object.keys({...Object.keys(a), ...Object.keys(b)}),
		isDifference = false;

	keys.forEach(function(d) {
		if (a[d] != b[d]) {
			isDifference = true;
		}
	})

	return !isDifference;
}

function randomElement(arr, probabilities) {

	if (arr.length == 0) {
		return [];
	}

	let cumProb = 0,
		prob = Math.random(),
		index = 0;

	while (cumProb < prob) {
		cumProb = cumProb + probabilities[index];
		index++;
	}

	return arr[index - 1];
}

// Display error messages.

function log(message, classes = []) {

	postMessage({
		type: 'progress',
		message: message,
		classes: classes
	});
}

function error(message) {
	
	postMessage({
		type: 'error',
		message: message,
		classes: ['error']
	})
}

// Solve LP in another Web Worker.

function solveInWebWorker(model, timeout = 5000) {


	let p = new Promise(resolve => {

		let worker = new Worker('/js/solveLPinWebWorker.js'),
			results = {};

		worker.postMessage([
			model
		])

		worker.onmessage = function(e) {
			if (e.data.type == 'output') {
				results = e.data.output;
				worker.terminate();
				resolve(results);
			}
		}

		setTimeout(function() {
			worker.terminate();
			resolve('TIMED OUT');
		}, timeout);

	})

	return p;

}

function processCategories() {
	
	categories = input.variables.map(d => d.category)
					.filter(unique)
					.map(function(d) {
						return {
							name: d,
							min: 0,
							max: 0,
							selected: 0,
							remaining: 0
						}
					});

	for (const r of input.variables) {
		categories.filter(c => c.name == r.category)[0].min += r.min;
		categories.filter(c => c.name == r.category)[0].max += r.max;
	}

	input.variables.forEach(function(d) {
		d.selected = 0;
		d.remaining = input.people.filter(p => p[d.category] == d.name).length;
	})

}

function categoryMinimumsReached(categories) {
	return categories.every(d => d.selected >= d.min);
}

function _sameAddress(id1, id2) {

	let p1 = input.people.filter(p => p.id == id1)[0],
		p2 = input.people.filter(p => p.id == id2)[0];

	let same = true;
	checkSameAddressColumns.forEach(function(cl) {
		if (p1[cl] != p2[cl]) {
			same = false;
		}
	})

	return same;

}

function _computeHouseholds(people) {

	let IDs = people.map(d => d.id),
		households = {};
	IDs.forEach(function(id) {
		households[id] = null;
	})

	// console.log(IDs);

	// For each person, `households` contains the ID of the
	// earliest person with the same address.

	let counter = 0;
	for (let i = 0; i < IDs.length; i++) {
		if (households[IDs[i]] != null) {
			continue;
		}
		households[IDs[i]] = counter;
		for (let j = i+1; j < IDs.length; j++) {
			if (households[IDs[j]] == null && _sameAddress(IDs[i], IDs[j])) {
				households[IDs[j]] = counter;
			}
		}

		counter++;
	}

	return households;
}

function _setupCommitteeGeneration(
			people,
			categories,
			nPeopleWanted,
			checkSameAddress,
			households) {

	// Create model object.
	let model = {
		optimize: 'target',
		opType: 'max',
		constraints: {},
		variables: {},
		ints: {}
	};

	// For every person, we have a binary variable indicating whether they are
	// in the committee.
	let agentVars = people.map(p => `agent_${p.id}`);
	agentVars.forEach(function(v) {
		model.variables[v] = {
			nSelected: 1,
		};
		model.variables[v][`selected_${v}`] = 1;
		model.variables[v]['target'] = Math.random();
		model.ints[v] = 1;
		model.constraints[`selected_${v}`] = {
			max: 1
		};
	});

	// We have to select exactly `nPeopleWanted` people.
	model.constraints.nSelected = {
		equal: Number(nPeopleWanted)
	}

	// We have to respect category quotas.
	input.variables.forEach(function(d) {
		model.constraints[`cat_${d.category}_${d.name}_min`] = { min: d.min };
		model.constraints[`cat_${d.category}_${d.name}_max`] = { max: d.max };
	})
	people.forEach(function(p) {
		input.variables.forEach(function(d) {
			if (p[d.category] == d.name) {
				model.variables[`agent_${p.id}`][`cat_${d.category}_${d.name}_min`] = 1;
				model.variables[`agent_${p.id}`][`cat_${d.category}_${d.name}_max`] = 1;
			}
			// else {
			// 	model.variables[`agent_${p.id}`][`cat_${d.category}_${d.name}`] = 0;
			// }
		})
	})

	// We might not be able to select multiple people from the same household.
	if (checkSameAddress) {
		let peopleByHousehold = {};
		Object.values(households).forEach(function(h, i) {
			if (!Object.keys(peopleByHousehold).includes(h)) {
				peopleByHousehold[h] = [];
			}
			peopleByHousehold[h].push(i);
		})
		Object.keys(peopleByHousehold).forEach(function(h) {
			if (peopleByHousehold[h].length >= 2) {
				model.constraints[`nFromHousehold_${h}`] = { max: 1 };
				peopleByHousehold[h].forEach(function(p) {
					model.variables[agentVars[p]][`nFromHousehold_${h}`] = 1;
				})
			}
		})
	}

	// Optimise once without any constraints to check if any feasible committees
	// exist at all.
	let results = solver.Solve(model);
	// console.log(model);
	// console.log(results);
	if (!results.feasible) {
		error('No committees were found that satisfy the specified quotas.');
		// But this may also be caused if the solver just fails to find any feasible committees.
	}

	return {
		newCommitteeModel: model,
		agentVars: agentVars,
		feasible: results.feasible
	};
}

function _ilpResultsToCommittee(results, agentVars) {
	if (!results.feasible) {
		error('Result not feasible.')
	} else {
		let committee = [];
		Object.keys(results).forEach(function(v) {
			if (agentVars.includes(v) && results[v] == 1) {
				// committee.push(v.slice(6));
				committee.push(v);
			}
		})
		return committee;
	}
}

async function _generateInitialCommittees(
	model,
	agentVars,
	multiplicativeWeightsRounds) {

	// To speed up the main iteration of the maximin and Nash algorithms, start from
	// a diverse set of feasible committees. In particular, each agent that can be
	// included in any committee will be included in at least one of these committees.

	let committees = [],	// Committees discovered so far.
		coveredAgents = [];	// All agents included in some committee.

	// We begin using a multiplicative-weight stage. Each agent has a weight
	// starting at 1.
	
	let weights = {};
	agentVars.forEach(v => { weights[v] = 1 });

	for (let i = 0; i < multiplicativeWeightsRounds; i++) {
		
		// In each round, we find a feasible committee such that the sum of weights of
		// its members is maximal.
		
		agentVars.forEach(v => {
			model.variables[v].target = weights[v];
		})


		let results = await solveInWebWorker(model);
		// let results = solver.Solve(model);
			// ^ THIS CAN BE QUITE SLOW, NEED TO INVESTIGATE WHY.

		if (results !== "TIMED OUT") {

			let newSet = _ilpResultsToCommittee(results, agentVars);
	
			// We then decrease the weight of each agent in the new committee by a constant
			// factor. As a result, future rounds will strongly prioritise including agents
			// that appear in few committees.

			newSet.forEach(v => {
				weights[v] = weights[v] * 0.8;
			})

			// We rescale the weights, which does not change the conceptual algorithm but
			// prevents floating point problems.

			let sumOfWeights = Object.values(weights).reduce((a, b) => a + b, 0);

			agentVars.forEach(v => {
				weights[v] = weights[v] * (agentVars.length / sumOfWeights)
			})

			if (!arrayInArray(newSet, committees)) {
				
				committees.push(newSet);
				newSet.forEach(v => {
					if (!coveredAgents.includes(v)) {
						coveredAgents.push(v);
					}
				})

			} else {

				// If our committee is already known, make all weights a bit more equal
				// again to mix things up a little.
				agentVars.forEach(v => {
					weights[v] = 0.9 * weights[v] + 0.1;
				})
			}

		} else {

			// If solver times out, randomise weights a bit to mix things up.
			console.log('shaking things up...')
			agentVars.forEach(v => {
				weights[v] = weights[v] + 0.1*Math.random();
			})

		}


		log(`Multiplicative weights phase, round ${i+1}/${multiplicativeWeightsRounds}. Discovered ${committees.length} committees so far.`);
	}

	// If there are any agents that have not been included so far, try to find a
	// committee including this specific agent.

	agentVars.forEach(v => {

		if (!coveredAgents.includes(v)) {

			agentVars.forEach(v1 => {
				model.variables[v1].target = (v == v1) ? 1 : 0;
					// Only care about agent `v` being included.				
			})

			let results = solver.Solve(model);
			let newSet = _ilpResultsToCommittee(results, agentVars);

			if (results.feasible && Object.keys(results).includes(v)) {

				committees.push(newSet);
				newSet.forEach(v1 => {
					if (!coveredAgents.includes(v1)) {
						coveredAgents.push(v1);
					}
				})

			} else {
				log(`Agent ${v.slice(6)} not contained in any feasible committee.`);
			}

		}

	})

	// We assume in this stage that the quotas are feasible.
	if (committees.length == 0) {
		error(`No feasible committees found.`);
	}

	if (coveredAgents.length == agentVars.length) {
		log(`All agents are contained in some feasible committee.`);
	}

	return {
		committees: committees,
		coveredAgents: coveredAgents
	};
}

function _defineEntitlements(
	fairToHouseholds,
	coveredAgents,
	households) {

	let entitlements,
		contributesToEntitlement;

	if (fairToHouseholds) {

		// TODO - assert households is not None
		let householdValues = Object.values(households).filter(unique),
			nHouseholds = householdValues.length;
		// TODO - assert householdValues == set(range(num_households))
		entitlements = householdValues.map(d => `agent_${d}`);
		contributesToEntitlement = {};
		Object.keys(households).forEach(id => {
			contributesToEntitlement[`agent_${id}`] = `agent_${households[id]}`;
		})

	} else {

		entitlements = [...coveredAgents];
		contributesToEntitlement = {};
		coveredAgents.forEach(v => {
			contributesToEntitlement[v] = v;
		})

	}

	return {
		entitlements: entitlements,
		contributesToEntitlement: contributesToEntitlement
	}

}

function _findCommitteeProbabilities(
		committees,
		nEntitlements,
		contributesToEntitlement
	) {

	let probabilities = [],
		model = {
			optimize: 'target',
			opType: 'max',
			constraints: {},
			variables: {}
		};

	committees.forEach((c,i) => {
		model.variables[`committee_${i}_prob`] = {
			sumToOne: 1
		};
		model.variables[`committee_${i}_prob`][`committee_${i}_bound`] = 1;
		model.constraints[`committee_${i}_bound`] = { max: 1 };
	})
	model.constraints.sumToOne = { equal: 1 };

	model.variables['lower'] = {
		lower_bound: 1,
		target: 1
	}

	Object.values(contributesToEntitlement)
		.filter(unique)
		.forEach(e => {
			model.variables.lower[`entitlement_${e}_bound`] = -1;
			model.constraints[`entitlement_${e}_bound`] = { min: 0 };
		})

	committees.forEach((c, i) => {
		c.forEach(v => {
			if (model.variables[`committee_${i}_prob`].hasOwnProperty(`entitlement_${contributesToEntitlement[v]}_bound`)) {
				model.variables[`committee_${i}_prob`]
					[`entitlement_${contributesToEntitlement[v]}_bound`] += 1;
			} else {
				model.variables[`committee_${i}_prob`]
					[`entitlement_${contributesToEntitlement[v]}_bound`] = 1;
			}
		})
	})

	// Optimise model.

	// console.log(model);

	let result = solver.Solve(model);
	if (!result.feasible) {
		error('Probability-finding model not feasible.');
	}

	// Extract probabilities.

	committees.forEach((c,i) => {
		if (result.hasOwnProperty(`committee_${i}_prob`) && result[`committee_${i}_prob`] >= 0) {
			probabilities.push(result[`committee_${i}_prob`]);
		} else {
			probabilities.push(0);
		}
	});
	let sumOfProbabilities = math.sum(probabilities);
	probabilities = probabilities.map(p => p / sumOfProbabilities);

	// console.log(probabilities);

	return probabilities;
}

async function findDistributionSimple(people, categories, nPeopleWanted) {

	// Generate a set of feasible committees in which all agents whom it is
	// possible to represent are represented, using the same algorithm as in
	// the maximin method. Then simply assign a uniform distribution over such
	// committees.
	
	// Returns:
	// 		An object containing an array of feasible committees, where each
	// 		committee is represented by a sub array of inputs.people, and an
	// 		array of probabilities of equal length, describing the probability
	// 		with which each committee should be selected.

	log('Using simple algorithm.');

	let households;
		
	if (checkSameAddress || fairToHouseholds) {
		households = _computeHouseholds(people);
	}

	// Set up an ILP `newCommitteeModel` that can be used for discovering new
	// feasible committees maximising some sum of weights over the people.
	let { newCommitteeModel,
		  agentVars,
		  feasible } = _setupCommitteeGeneration(
							people,
							categories,
							nPeopleWanted,
							checkSameAddress,
							households
						);

	if (!feasible) {
		return {
			committees: [],
			probabilities: []
		};
	}

	// Start by finding some initial committees, guaranteed to cover every person
	// that can be covered by some committee.
	let { committees,
		  coveredAgents } = await _generateInitialCommittees(
		  						newCommitteeModel,
		  						agentVars,
		  						Math.floor(people.length / 2)
		  					);

	let probabilities = Array(committees.length).fill(1/committees.length);

	return {
		committees: committees,
		probabilities: probabilities
	}
}

async function findDistributionMaximin(people, categories, nPeopleWanted) {

	// Find a distribution over feasible committees that maximises the minimum
	// probability of an agent being selected (`fairToHouseholds = false`) or
	// the minimum expected number of household members selected
	// (`fairToHouseholds = true`).

	// Returns:
	// 		An object containing an array of feasible committees, where each
	// 		committee is represented by a sub array of inputs.people, and an
	// 		array of probabilities of equal length, describing th eprobability
	// 		with which each committee should be selected.

	log('Using maximin algorithm.');

	let households;
		
	if (checkSameAddress || fairToHouseholds) {
		households = _computeHouseholds(people);
	}

	// Set up an ILP `newCommitteeModel` that can be used for discovering new
	// feasible committees maximising some sum of weights over the people.
	let { newCommitteeModel,
		  agentVars,
		  feasible } = _setupCommitteeGeneration(
							people,
							categories,
							nPeopleWanted,
							checkSameAddress,
							households
						);

	if (!feasible) {
		return {
			committees: [],
			probabilities: []
		};
	}

	// Start by finding some initial committees, guaranteed to cover every person
	// that can be covered by some committee.
	let { committees,
		  coveredAgents } = await _generateInitialCommittees(
		  						newCommitteeModel,
		  						agentVars,
		  						Math.floor(people.length / 2)
		  					);

	// Entitlements are the entities deserving fair representation; either the
	// feasible agents (`fairToHouseholds` = false) or the households with some
	// feasible agent (`fairToHouseholds` = true).
	// let entitlements = [],
	// 	contributesToEntitlement = {};
			// For ID of a covered agent, the corresponding index in `entitlements`.

	let { entitlements,
		  contributesToEntitlement } = _defineEntitlements(
		  							       fairToHouseholds,
		  							       coveredAgents,
		  							       households
		  							   );

	// The incremental model is an LP with a variable y_e for each entitlement e
	// and one more variable z. For an agent i, let e(i) denote her entitlement.
	// Then, the LP is:

	// 		minimize  z
	// 		s.t.      Σ_{i ∈ B} y_{e(i)} ≤ z   ∀ feasible committees B (*)
    //      	      Σ_e y_e = 1
    //          	  y_e ≥ 0                  ∀ e
    //

    // At any point in time, constraint (*) is only enforced for the committees
    // in `committees`. By linear-programming duality, if the optimal solution
    // with these reduced constraints satisfies all possible constraints, the
    // committees in `committees` are enough to find the maximin distribution
    // among them.

    let model = {
		optimize: 'target',
		opType: 'min',
		constraints: {},
		variables: {}
	};

	// Variable z
	model.variables.upper_bound = { target: 1 };
	// Variables y_e (incr_entitlement_vars)
	entitlements.forEach(e => {
		model.variables[`entitlement_${e}`] = {};
		model.variables[`entitlement_${e}`][`sumToOne`] = 1;
		model.variables[`entitlement_${e}`][`max_entitlement_${e}`] = 1;
		model.constraints[`max_entitlement_${e}`] = { max: 1 };
		model.variables[`entitlement_${e}`][`min_entitlement_${e}`] = 1;
		model.constraints[`min_entitlement_${e}`] = { min: 0 };
	}) 
	// Shortcuts for y_{e(i)} (incr_agent_vars)
	let incrAgentVars = {};
	coveredAgents.forEach(v => {
		incrAgentVars[v] = `entitlement_${contributesToEntitlement[v]}`;
	})

	// Σ_e y_e = 1
	model.constraints.sumToOne = { equal: 1 };
	// Σ_{i ∈ B} y_{e(i)} ≤ z   ∀ B ∈ `committees`
	committees.forEach((c,i) => {
		model.constraints[`committee_${i}`] = { min: 0 };
		model.variables.upper_bound[`committee_${i}`] = 1;
		c.forEach(v => {
			model.variables[incrAgentVars[v]][`committee_${i}`] = -1;
		})
		// TODO - check this.
	})

	console.log('ENTERING WHILE LOOP');
	// model.options = {
	// 	timeout: 10000
	// }
	// console.log(model);
	// return;
	
	let n = 0,
		newCommitteeResult,
		newSet,
		value,
		committeeList,
		probabilities;
	while (true) {
		console.log(n);

		// console.log('Yes, I\'m here!');
		console.log('#0');

		let result = solver.Solve(model);
		if (!result.feasible) {
			error('No maximin distribution found.')
		}
		
		console.log('#1');
		// console.log(result);

		// Currently optimal values for the y_e.
		let entitlementWeights = {};
		Object.values(incrAgentVars)
			.filter(unique)
			.forEach(entitlementVar => {
				if (Object.keys(result).includes(entitlementVar)) {
					entitlementWeights[entitlementVar] = result[entitlementVar];
				} else {
					entitlementWeights[entitlementVar] = 0;
				}
			})
		// Currently optimal value for z.
		let upper = result.result;

		console.log('#2')

		// For these fixed y_e, find the feasible committee B with
		// maximal Σ_{i ∈ B} y_{e(i)}.

		agentVars.forEach(v => {
			if (coveredAgents.includes(v)) {
				newCommitteeModel
					.variables[v]
					.target = entitlementWeights[
								`entitlement_${contributesToEntitlement[v]}`
							  ];
			} else {
				newCommitteeModel.variables[v].target = 0;
			}
		})

		console.log('#3')

		newCommitteeResult = solver.Solve(newCommitteeModel);
		newSet = _ilpResultsToCommittee(newCommitteeResult, agentVars);
		value = newSet.map(v => {
				return entitlementWeights[`entitlement_${contributesToEntitlement[v]}`];
			}).reduce((a, b) => a + b, 0);

		console.log('#4')

		if (value <= upper + EPS) { // TODO - define EPS

			// No feasible committee B violates Σ_{i ∈ B} y_{e(i)} ≤ z (at least up
			// to EPS, to prevent rounding errors). Thus we have enough committees.
			committeeList = committees; // TODO - make this a deepCopy.
			probabilities = _findCommitteeProbabilities(
					committeeList,
					entitlements.length,
					contributesToEntitlement
				);
			return {
				committees: committeeList,
				probabilities: probabilities
			};

		} else {

			log(`Maximin is at most ${value}, can do ${upper} with ${committees.length} committees. Gap ${value - upper} > ${EPS}.`)

			// Some committee B violates Σ_{i ∈ B} y_{e(i)} ≤ z. We add B to
			// `committees` and recurse.

			if (arrayInArray(newSet, committees)) {
				error( 'New committee already exists.' );
			}
			committees.push(newSet);
			let committeeVar = `committee_${committees.length - 1}`
			model.constraints[committeeVar] = { min: 0 };
			model.variables.upper_bound[committeeVar] = 1;
			newSet.forEach(v => {
				model.variables[incrAgentVars[v]][committeeVar] = -1;
			})

			// Heuristic for better speed in practice: because optimising 
			// `incrementalModel` takes a long time, we would like to get multiple
			// committees out of a single run of `incrementalModel`. Rather than
			// reoptimising for optimal y_e and z, we find some feasible values
			// y_e and z by modifying the old solution. This heuristic only adds more
			// committees, and does not influence correctness.

			let counter = 0;
			for (let _ = 0; _ < 10; _++) {

				// console.log(`Counter = ${counter}`)

				// Scale down the y_{e(i)} for i i ∈ `newSet` to make
				// Σ_{i ∈ `newSet`} y_{e(i)} ≤ z true.
				newSet
					.map(v => `entitlement_${contributesToEntitlement[v]}`)
					.filter(unique)
					.forEach(function(e) {
						entitlementWeights[e] = entitlementWeights[e] * (upper / value);
					})

				// This will change Σ_e y_e to be less than 1. We rescale the y_e and z.
				let sumOfWeights = math.sum(Object.values(entitlementWeights));
				if (sumOfWeights < EPS) {
					break;
				}
				for (let e of Object.keys(entitlementWeights)) {
					entitlementWeights[e] = entitlementWeights[e] / sumOfWeights;
				}
				upper = upper / sumOfWeights;

				agentVars.forEach(v => {
					if (coveredAgents.includes(v)) {
						newCommitteeModel
							.variables[v]
							.target = entitlementWeights[
										`entitlement_${contributesToEntitlement[v]}`
									  ];
					} else {
						newCommitteeModel.variables[v].target = 0;
					}
				})

				newCommitteeResult = solver.Solve(newCommitteeModel);
				newSet = _ilpResultsToCommittee(newCommitteeResult, agentVars);
				value = newSet.map(v => {
						return entitlementWeights[`entitlement_${contributesToEntitlement[v]}`];
					}).reduce((a, b) => a + b, 0);

				if ((value <= upper + EPS) || arrayInArray(newSet, committees)) {
				
					break;
				
				} else {

					committees.push(newSet);
					let committeeVar = `committee_${committees.length - 1}`
					model.constraints[committeeVar] = { min: 0 };
					model.variables.upper_bound[committeeVar] = 1;
					newSet.forEach(v => {
						model.variables[incrAgentVars[v]][committeeVar] = -1;
					})

				}

				counter++;

			}

			if (counter > 0) {
				log(`Heuristic successfully generated ${counter} additional committees.`);
			}

		}


		n++;

	} 

	return {
		committees: [],
		probabilities: []
	}
}


async function findRandomSample(people, categories, nPeopleWanted) {

	// Main algorithm to try to find a random sample.

	// Returns:
	//		A sub-array of `people` with `nPeopleWanted` entries,
	// 		guaranteed to satisfy the constraints on a feasible
	// 		committee.

	let result = {
		haltEarly: false,
		peopleSelected: []
	};
	
	let committees,
		probabilities;

	if (selectedAlgorithm == 'simple') {
	
		let d = await findDistributionSimple(
			people,
			categories,
			nPeopleWanted);
		committees = d.committees;
		probabilities = d.probabilities;
	
	} else if (selectedAlgorithm == 'maximin') {
	
		let d = await findDistributionMaximin(
			people,
			categories,
			nPeopleWanted);
		committees = d.committees;
		probabilities = d.probabilities;
	
	} else if (selectedAlgorithm == 'nash') {
	
		log('Nash selection algorithm is yet to be implemented.')
		result.haltEarly = true;
		return result;
	
	}

	// Check there are no duplicate committees.
	if (duplicateElements(committees)) {
		result.haltEarly = true;
		return result;
	}

	// Choose a random committee from committees.
	result.peopleSelected = randomElement(committees, probabilities);
	
	// Update categories.
	for (const p of result.peopleSelected) {
		let person = input.people.filter(d => d.id == p.slice(6))[0];
		categories.forEach(function(c) {
			if (person[c.category] == c.name) {
				c.selected++;
				c.remaining--;
			}
		})
	}

	return result;
}

async function runStratification() {

	// Put the rest in a time-out so the page can render.
	async function run() {

		// Refactor inputted data.
		processCategories();

		// First check if numbers specified in the population variables file
		// make sense with the specified number to select.
		let compatibleCategories = true;
		for (const c of categories) {

			if (nPeopleWanted < c.min || nPeopleWanted > c.max) {
				error(`The number of people to select (${nPeopleWanted}) is out of the range of the numbers of people in one of the categories (${c.name}). It should be within [${c.min}, ${c.max}].`);

				compatibleCategories = false;
			}
		}

		let html = "",
			outputSelected = [],
			outputNotSelected = [];

		if (compatibleCategories) {
			
			// Perform sampling.

			let sampleCreated = false,
				nIters = 0,
				maxIters = 10;

			log(`Initial: (selected = 0, remaining = ${input.people.length})`);

			let peopleSelected = [];

			while (!sampleCreated && nIters < maxIters) {

				await setTimeout(function() {}, 1000);

				let tempPeople = deepCopy(input.people),
					tempCategories = deepCopy(input.variables);

				log(`Iteration: ${nIters}`);

				let result = await findRandomSample(
					tempPeople,
					tempCategories,
					nPeopleWanted
				)

				if ( result.haltEarly ) {
					log('Encountered error, halting early.')
					break;
				} else {
					peopleSelected = result.peopleSelected;
				}

				if (categoryMinimumsReached(tempCategories)) {
					log('SUCCESS!', ['good'])
					sampleCreated = true;
				}

				nIters++;
			}


			if (sampleCreated) {
				log(`We tried ${nIters} time(s).`);
				log(`Selected ${peopleSelected.length} people.`);
			} else {
				log(`Failed after ${nIters} iterations. Gave up.`);
			}


			peopleSelected = peopleSelected.map(d => d.slice(6));
			// console.log(peopleSelected);
			// console.log(input.people);
			outputSelected = deepCopy(input.people).filter(p => peopleSelected.includes(String(p.id)));
			outputNotSelected = deepCopy(input.people).filter(p => !peopleSelected.includes(String(p.id)));

			// Populate summary table.
			let vars = input.variables.map(d => d.category).filter(unique);

			for (let v of vars) {
				let vals = input.variables.filter(d => d.category == v),
					nVals = vals.length;
				for (let i = 0; i < nVals; i++) {
					let requests = "";
					if (vals[i].min == vals[i].max) {
						requests = vals[i].min;
					} else {
						let { min, max } = vals[i];
						requests = `${min} &ndash; ${max}`;
					}
					let selects = outputSelected.filter(d => d[v] == vals[i].name).length;

					if (i == 0) {
						html += `<tr class="new-value">
							<td class="left" rowspan="${nVals}">
								${v}
							</td>
							<td class="left">${vals[i].name}</td>
							<td>${requests}</td>
							<td>${selects}</td>
						</tr>`;
					} else {
						html += `<tr>
							<td class="left">${vals[i].name}</td>
							<td>${requests}</td>
							<td>${selects}</td>
						</tr>`;
					}
				}
			}
		}


		// postMessage({
		// 	type: 'progress',
		// 	message: '',
		// 	classes: ['horizontal-rule']
		// })

		postMessage({
			type: 'summary-table',
			html: html
		})

		postMessage({
			type: 'output',
			selected: outputSelected,
			notSelected: outputNotSelected
		})

	}

	setTimeout(run, 10);

}

onmessage = function(e) {
  
	[
		input,
		categories,
		nPeopleWanted,
		selectedAlgorithm,
		checkSameAddress,
		fairToHouseholds,
		checkSameAddressColumns,
		EPS
	] = e.data;

	if (selectedAlgorithm === undefined) {
		error('No algorithm selected. Go back to Step 3 and choose a selection algorithm.')
		postMessage({
			type: 'summary-table',
			html: ''
		})
		postMessage({
			type: 'output',
			selected: [],
			notSelected: []
		})
	} else {
		runStratification();
	}

	// console.log('ALL DONE')
}