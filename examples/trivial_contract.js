import {Contract, Party, UnitState, JointState, Registry, Util} from '../lib/oc';

const should = require('chai').should();

async function example() {
	console.log('Example: a trivial contract');

    let registry = new Registry('local');

	var alicesSigKeyPair = Util.generateKeyPair(),
		bobsSigKeyPair = Util.generateKeyPair();

	var alice = await registry.getPartyByName('alice', alicesSigKeyPair.publicKey),  // We will use ES7 async/await throughout
		bob = await registry.getPartyByName('bob', bobsSigKeyPair.publicKey);  // Passing the publicKeys is only necessary for stub/testing

	var c1 = new Contract({
		body: async () => new JointState({alice: UnitState.trueState, bob: UnitState.trueState}),  // ES7 arrow functions
		parties: {alice, bob}  // parties can be a dictionary or an array. here we're using ES7 shorthand for {alice: alice, bob: bob}.
		// For writing actual contracts, you may want to use descriptive names such as 'seller' and 'buyer'
		// or stick with 0, 1, 2...
		// Just keep in mind that you have to be consistent (use the same names)
	});

	console.log('Created original');

	await c1.update();  // update() syncs the internal contract state

	console.log('Updated original');

	c1.expired.should.equal(false);
	c1.revoked.should.equal(false);
	c1.valid.toJSON().should.deep.equal({ alice: { p: 1, source: null }, bob: { p: 1, source: null } });
	c1.signed.should.deep.equal({alice: false, bob: false});

	await c1.sign({alice: alicesSigKeyPair.privateKey, bob: bobsSigKeyPair.privateKey});  // signing for each privateKey independently

	console.log('Signed original');

	c1.signed.should.deep.equal({alice: true, bob: true});

	console.log('Verified original');

	const published = await c1.publish(registry);

	console.log('Published original');

	let c2 = await Contract.load(published);

	console.log('Loaded copy');

	await c2.update();

	console.log('Updated copy');

	c2.signed.should.deep.equal({alice: true, bob: true});

	console.log('Verified copy');

}

example().catch(console.trace.bind(console));