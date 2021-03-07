importScripts(
	'https://unpkg.com/javascript-lp-solver/prod/solver.js'
	)

onmessage = function(e) {
  
	[
		model
	] = e.data;

	let results = solver.Solve(model);

	postMessage({
		type: 'output',
		output: results
	});

}