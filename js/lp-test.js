import LinearProgram from './simplex.js';

var testPrograms = [
	{
		objective: {
			x: 7,
			y: 5,
		},
		constraints: [
			{
				coefficients: { x: 2, y: 3 },
				relation: '<=',
				constant: 90,
			},
			{
				coefficients: { x: 3, y: 2 },
				relation: '<=',
				constant: 120,
			}
		],
		direction: 'max',
	},
	{
		objective: {
			x: -1,
			y: 3,
			z: -3
		},
		constraints: [
			{
				coefficients: {x: 3, y: -1, z: -2},
				relation: '<=',
				constant: 7
			},
			{
				coefficients: {x: -2, y: -4, z: 4},
				relation: '<=',
				constant: 3
			},
			{
				coefficients: {x: 1, z: -2},
				relation: '<=',
				constant: 4
			},
			{
				coefficients: {x: -1, y: 2, z: 1},
				relation: '<=',
				constant: 8
			},
			{
				coefficients: {x: 3},
				relation: '<=',
				constant: 5
			}
		],
		direction: 'max'
	},
	{
		objective: {
			a: 70,
			b: 210,
			c: 140,
		},
		constraints: [
			{
				coefficients: { a: 1, b: 1, c: 1 },
				relation: '<=',
				constant: 100,
			},
			{
				coefficients: { a: 5, b: 4, c: 4 },
				relation: '<=',
				constant: 480,
			},
			{
				coefficients: { a: 40, b: 20, c: 30 },
				relation: '<=',
				constant: 3200,
			},
		],
		direction: 'max',
	},
	{
		objective: {
			x: 3,
			y: 2,
		},
		constraints: [
			{
				coefficients: { x: 1, y: 2 },
				relation: '<=',
				constant: 10,
			},
			{
				coefficients: { x: 3, y: 1 },
				relation: '<=',
				constant: 15,
			},
		],
		direction: 'max',
	},
	{
		objective: {
			x: 5,
			y: 10,
		},
		constraints: [
			{
				coefficients: { x: 1, y: 2 },
				relation: '<=',
				constant: 120,
			},
			{
				coefficients: { x: 1, y: 1 },
				relation: '>=',
				constant: 60,
			},
			{
				coefficients: { x: 1, y: -2 },
				relation: '>=',
				constant: 0,
			},
		],
		direction: 'max',
	},
	{
		objective: {
			x: 20,
			y: 10,
			z: 15
		},
		constraints: [
			{
				coefficients: { x: 3, y: 2, z: 5 },
				relation: '<=',
				constant: 55,
			},
			{
				coefficients: { x: 2, y: 1, z: 1 },
				relation: '<=',
				constant: 26,
			},
			{
				coefficients: { x: 1, y: 1, z: 3 },
				relation: '<=',
				constant: 30,
			},
			{
				coefficients: { x: 5, y: 2, z: 4 },
				relation: '<=',
				constant: 57,
			},
		],
		direction: 'max',
	},
	{
		objective: {
			c: 20,
			m: 15,
			b: 25
		},
		constraints: [
			{
				coefficients: { c: 2, m: 1, b: 2 },
				relation: '<=',
				constant: 8,
			},
			{
				coefficients: { c: 2, m: 2, b: 3 },
				relation: '<=',
				constant: 12,
			},
			{
				coefficients: { c: 2, m: 1, b: 3 },
				relation: '<=',
				constant: 10,
			},
		],
		direction: 'max',
	},
	{
		objective: {
			c: 20,
			m: 15,
			b: 25,
			x: 10,
			y: 20,
			z: 5
		},
		constraints: [
			{
				coefficients: { c: 2, m: 1, b: 2, x: 2, y: 2, z: 2 },
				relation: '<=',
				constant: 200,
			},
			{
				coefficients: { c: 2, m: 2, b: 3, x: 3, y: 2, z: 1 },
				relation: '<=',
				constant: 122,
			},
			{
				coefficients: { c: 2, m: 1, b: 3, x: 1, y: 2, z: 3 },
				relation: '<=',
				constant: 400,
			},
		],
		direction: 'max',
	}
];



var LP = new LinearProgram(testPrograms[6]);

LP.solve()
console.log(LP.result.status);
console.log(LP.result.objective);
console.log(LP.result.solutions);