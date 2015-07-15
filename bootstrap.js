require("babel/register")({
	stage: 1
});

require('source-map-support').install();

//require('./examples/trivial_contract');
require('./examples/body_as_string');
//require('./examples/basic_clauses');