importScripts(
	'/js/importGLPK.js',
	)

onmessage = async function(e) {
  
	[
		model
	] = e.data;

	// Initialise GLPK solver.
	const glpk = await GLPK();

	let results;
	let r = await glpk.solve(model, {})
		.then(res => {
			results = res.result;
		})
		.catch(err => console.log(err));

	postMessage({
		type: 'output',
		output: results
	});

}