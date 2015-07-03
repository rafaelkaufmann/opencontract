var OC = require('../lib/oc');

var should = require('chai').should();

async function example1() {
	var alicesSigKeyPair = OC.generateKeyPair(),
		bobsSigKeyPair = OC.generateKeyPair();

	var alice = await OC.getPartyByName('alice', alicesSigKeyPair.publicKey),  // We will use ES7 async/await throughout
		bob = await OC.getPartyByName('bob', bobsSigKeyPair.publicKey);  // Passing the publicKeys is only necessary for stub/testing

	/*
	 Example: a trivial contract
	 */
	var c1 = new OC.Contract({
		getState: async () => OC.state({alice: 1, bob: 1}),  // ES7 arrow functions
		parties: {alice, bob}  // parties can be a dictionary or an array. here we're using ES7 shorthand for {alice: alice, bob: bob}.
		// For writing actual contracts, you may want to use descriptive names such as 'seller' and 'buyer'
		// or stick with 0, 1, 2...
		// Just keep in mind that you have to be coherent (use the same names)
	});

	await c1.update();  // update() syncs the internal contract state

	c1.expired.should.equal(false);
	c1.revoked.should.equal(false);
	c1.valid.should.deep.equal({p: {alice: 1, bob: 1}, source: null});
	var x = c1.signed;
	c1.signed.should.deep.equal({alice: false, bob: false});

	c1.sign({alice: alicesSigKeyPair.privateKey, bob: bobsSigKeyPair.privateKey});  // using ecdsa.sign for each privateKey independently

	c1.signed.should.deep.equal({alice: true, bob: true});  // signed is actually a getter which is running ecdsa.verify
															// against alice and bob's publicKeys

	const published = await c1.publish(new OC.Registry('local'));

	const c2 = await OC.Contract.load(published);

	c2.update();
	c2.signed.should.deep.equal({alice: true, bob: true});

}

example1().catch(console.trace.bind(console));