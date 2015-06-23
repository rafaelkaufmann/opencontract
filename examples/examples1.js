require('source-map-support').install();

var OC = require('../lib/oc');

var should = require('chai').should();

var ECKey = require('eckey'),
	secureRandom = require('secure-random'); 

async function example1() {
	var alicesSigKeyPair = generateKeyPair(),
		bobsSigKeyPair = generateKeyPair();

	var alice = await OC.getPartyByName('alice', alicesSigKeyPair.publicKey),  // We will use ES7 async/await throughout
		bob = await OC.getPartyByName('bob', bobsSigKeyPair.publicKey);  // Passing the publicKeys is only necessary for stub/testing

	console.log(alice.name);

	/*
	 Example: a trivial contract
	 */
	var ct1 = new OC.ContractTemplate({
		getState: async () => OC.state({alice: 1, bob: 1})  // ES7 arrow functions
	});

	console.log(ct1);

	var c1 = ct1.instantiate({
		parties: {alice, bob}  // parties can be a dictionary or an array. here we're using ES7 shorthand for {alice: alice, bob: bob}.
								// For writing actual contracts, you may want to use descriptive names such as 'seller' and 'buyer'
								// or stick with 0, 1, 2...
								// Just keep in mind that you have to be coherent (use the same names)
	});

	//console.log(c1.serialize());

	await c1.update();  // update() syncs the internal contract state

	console.log(c1.serialize());

	c1.expired.should.equal(false);
	c1.revoked.should.equal(false);
	c1.valid.should.deep.equal({p: {alice: 1, bob: 1}, source: null});
	var x = c1.signed;
	c1.signed.should.deep.equal({alice: false, bob: false});

	c1.sign({alice: alicesSigKeyPair.privateKey, bob: bobsSigKeyPair.privateKey});  // using ecdsa.sign for each privateKey independently

	c1.signed.should.deep.equal({alice: true, bob: true});  // signed is actually a getter which is running ecdsa.verify
															// against alice and bob's publicKeys
}

example1().catch(console.trace.bind(console));

function generateKeyPair() {
	var bytes = secureRandom(32);
	return new ECKey(bytes);
}