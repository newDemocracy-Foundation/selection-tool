// ############################################################################### //

// Stratified Random Selection
// Luke Thorburn, July 2020

// To start local server:
// python -m http.server 8888

// ############################################################################### //
// DEFINE VARIABLES

import exampleInput from './example-data-simple.js';

let input = {},
	outputSelected = [],
	outputNotSelected = [],
	categories = [],
	checkSameAddressColumns = [
		'address',
		'postcode'
	],
	mode = 'prod';

if (mode == 'dev') {
	input = exampleInput;
	console.log(input);
}

let EPS = 0.001; // TODO - find good value.

// ############################################################################### //
// UTILITIES

function deepCopy(arr) {
	let copy = [];
	arr.forEach(function(d) {
		copy.push({...d});
	})
	return copy;
}

// ############################################################################### //
// LOAD DATA

function removeEmptyRows(data) {
	
	console.log(data);
	// Seems to do this automatically?

	return data;
}

function dropHandler(ev, idSuffix) {
	// Prevent default behavior (Prevent file from being opened)
	ev.preventDefault();

	if (ev.dataTransfer.items) {
		const reader = new FileReader();

		// Use DataTransferItemList interface to access the file(s)
		for (var i = 0; i < ev.dataTransfer.items.length; i++) {
			// If dropped items aren't files, reject them
			if (ev.dataTransfer.items[i].kind === 'file') {
				var file = ev.dataTransfer.items[i].getAsFile();
				// console.log('... file[' + i + '].name = ' + file.name);
				reader.onload = function(e) {
					var data = new Uint8Array(e.target.result);
					var workbook = XLSX.read(data, {type: 'array'});

					var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
					input[idSuffix] = XLSX.utils.sheet_to_json(firstSheet);
					input[idSuffix] = removeEmptyRows(input[idSuffix]);

					// Update styling.
					var id = 'dragdrop-' + idSuffix;
					document.getElementById(id).classList.add('selected');
					document.getElementById('filename-' + idSuffix).innerHTML = file.name;
				}

				reader.readAsArrayBuffer(file)
			}
		}
	} else {
		// Use DataTransfer interface to access the file(s)
		for (var i = 0; i < ev.dataTransfer.files.length; i++) {
			console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
		}
	}

	// Change styling:
	var id = 'dragdrop-' + idSuffix;
	document.getElementById(id).classList.remove('active');
}

function dragOverHandler(ev, idSuffix) {
	// Prevent default behavior.
	ev.preventDefault();
	
	// Change styling:
	var id = 'dragdrop-' + idSuffix;
	document.getElementById(id).classList.add('active');

}

function dragLeaveHandler(ev, idSuffix) {
	// Prevent default behavior.
	ev.preventDefault();
	
	// Change styling:
	var id = 'dragdrop-' + idSuffix;
	document.getElementById(id).classList.remove('active');

}

function handleFileSelect(ev) {
	var file = ev.target.files[0]; // FileList object

	var reader = new FileReader();

	// Fetch file ID.
	var idSuffix = this.id.split('-')[1];

	// Closure to capture the file information.
	reader.onload = function(e) {
		var data = new Uint8Array(e.target.result);
		var workbook = XLSX.read(data, {type: 'array'});

		var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
		input[idSuffix] = XLSX.utils.sheet_to_json(firstSheet);

		input[idSuffix] = removeEmptyRows(input[idSuffix]);

		// Update styling.
		var id = 'dragdrop-' + idSuffix;
		document.getElementById(id).classList.add('selected');
		document.getElementById('filename-' + idSuffix).innerHTML = file.name;
	}

	// reader.onloadend = (function(file) {
 //      return function(evt) {
 //        createListItem(evt, file)
 //      };
 //    })(entries[i]);

	reader.readAsArrayBuffer(file)
}

function dragOverHandlerVariables(event) {
	dragOverHandler(event, 'variables');
}
function dragOverHandlerPeople(event) {
	dragOverHandler(event, 'people');
}
document.getElementById('dragdrop-variables')
	.addEventListener('dragover', dragOverHandlerVariables, false);
document.getElementById('dragdrop-people')
	.addEventListener('dragover', dragOverHandlerPeople, false);

function dragLeaveHandlerVariables(event) {
	dragLeaveHandler(event, 'variables');
}
function dragLeaveHandlerPeople(event) {
	dragLeaveHandler(event, 'people');
}
document.getElementById('dragdrop-variables')
	.addEventListener('dragleave', dragLeaveHandlerVariables, false);
document.getElementById('dragdrop-people')
	.addEventListener('dragleave', dragLeaveHandlerPeople, false);

function dropHandlerVariables(event) {
	dropHandler(event, 'variables');
}
function dropHandlerPeople(event) {
	dropHandler(event, 'people');
}
document.getElementById('dragdrop-variables')
	.addEventListener('drop', dropHandlerVariables, false);
document.getElementById('dragdrop-people')
	.addEventListener('drop', dropHandlerPeople, false);

document.getElementById('browse-variables').addEventListener('change', handleFileSelect, false);
document.getElementById('browse-people').addEventListener('change', handleFileSelect, false);

function loadExampleData() {
	input.people = deepCopy(exampleInput.people);
	input.variables = deepCopy(exampleInput.variables);
	document.getElementById('dragdrop-people').classList.add('selected');
	document.getElementById('dragdrop-variables').classList.add('selected');
	document.getElementById('filename-people').innerHTML = 'example-people.csv';
	document.getElementById('filename-variables').innerHTML = 'example-profile.csv';
	console.log(input);
}

document.getElementById('loadExampleData')
	.addEventListener('click', loadExampleData, false);

function removeFile(filename) {
	delete input[filename];
	var id = 'dragdrop-' + filename;
	document.getElementById(id).classList.remove('selected');
}
function removeFilePeople()    { removeFile('people'   ) }
function removeFileVariables() { removeFile('variables') }

document.getElementById('remove-people')
	.addEventListener('click', removeFilePeople, false);
document.getElementById('remove-variables')
	.addEventListener('click', removeFileVariables, false);


// ------------------------------------------------------------------------------- //
// RUN

// Populate settings.

function runStratification() {
	
	// Add 'in-progress' class to run button.

	document.getElementById('run').classList.add('in-progress');
	document.getElementById('run').innerHTML = 'Selection in progress...';

	// Clear progress log.
	document.getElementById('log').innerHTML = '';


	let nPeopleWanted = document.getElementById('n-to-select').value;

	var stratifier = new Worker('/js/runStratification.js');

	stratifier.postMessage([
		input,
		categories,
		nPeopleWanted,
		selectedAlgorithm,
		document.getElementById('checkSameAddress').checked,
		document.getElementById('fairToHouseholds').checked,
		checkSameAddressColumns,
		EPS
	])

	stratifier.onmessage = function(e) {
		
		if (['progress', 'error'].includes(e.data.type)) {
			
			let logArea = document.getElementById('log');
			let { message, classes } = e.data;

			const p = document.createElement('p');
			if (classes.length > 0) {
				for (let c of classes) {
					p.classList.add(c);
				}
			}
			p.innerHTML = message;

			logArea.append(p);
			logArea.scrollTop = logArea.scrollHeight;

		} else if (e.data.type == 'summary-table') {

			let table = document.getElementById('summary-table-body');
			table.innerHTML = e.data.html;
		
			document.getElementById('summary-table').classList.remove('hide');

			// Remove 'in-progress' class from run button.
			document.getElementById('run').classList.remove('in-progress');
			document.getElementById('run').innerHTML = 'Run selection';
			
		} else if (e.data.type == 'output') {

			outputSelected = e.data.selected;
			outputNotSelected = e.data.notSelected;

		}

	}
}

if (mode == 'dev') {
	// runStratification();
}

$('#run').click(function() {
	runStratification();
})

// document.getElementById("run").addEventListener("click", runStratification, false);

// ------------------------------------------------------------------------------- //
// EXPORT

function exportSelected(ev) {

	var fileExtension = this.id.split('-')[2];

	// Construct workbook.
	var wb = {};
	wb['SheetNames'] = ['Selection'];
	wb['Sheets'] = {
		Selection: XLSX.utils.json_to_sheet(outputSelected)
	}

	XLSX.writeFile(wb, 'selection.' + fileExtension)

}

function exportNotSelected(ev) {

	var fileExtension = this.id.split('-')[2];

	// Construct workbook.
	var wb = {};
	wb['SheetNames'] = ['Selection'];
	wb['Sheets'] = {
		Selection: XLSX.utils.json_to_sheet(outputNotSelected)
	}

	XLSX.writeFile(wb, 'selection.' + fileExtension)

}

document.getElementById("export-in-csv").addEventListener("click", exportSelected, false);
document.getElementById("export-in-xlsx").addEventListener("click", exportSelected, false);

document.getElementById("export-out-csv").addEventListener("click", exportNotSelected, false);
document.getElementById("export-out-xlsx").addEventListener("click", exportNotSelected, false);


// ------------------------------------------------------------------------------- //