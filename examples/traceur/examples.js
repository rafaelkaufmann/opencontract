/*
 Original reference examples, written in ES67 style.
 */

var OC = require('opencontract');

var alice = await OC.getPartyByName('alice'),  // We will use ES7 async/await throughout
	bob = await OC.getPartyByName('bob');

/*
 Example: a trivial contract
 */
var ct1 = new OC.ContractTemplate({
	getState: async () => OC.state({alice: 1, bob: 1})  // ES7 arrow functions
});

var c1 = ct1.instantiate({
	parties: {alice, bob}  // parties can be a dictionary or an array. here we're using ES7 shorthand for {alice: alice, bob: bob}.
							// For writing actual contracts, you may want to use descriptive names such as 'seller' and 'buyer'
							// or stick with 0, 1, 2...
							// Just keep in mind that you have to be coherent (use the same names)
});

var s1 = await c1.update();  // update() syncs the internal contract state
							// and returns a static, timestamped, signed copy of the current state at that moment.

s1.expired.should.equal(false);
s1.severed.should.equal(false);
s1.valid.should.deep.equal({p: {alice: 1, bob: 1});
s1.signed.should.deep.equal({alice: false, bob: false});

c1.sign({alice: alicesSigPrivateKey, bob: bobsSigPrivateKey});  // using ecdsa.sign for each privateKey independently

s1.signed.should.deep.equal({alice: false, bob: false});  // as advertised, s1 is static
c1.signed.should.deep.equal({alice: true, bob: true});  // signed is actually a getter which is running ecdsa.verify
														// against alice and bob's publicKeys

/*
 Example: detailed examination of a compound state
 */

var ct2 = new OC.ContractTemplate({
	getState: async () => {
		var self = this;

		var AdidX = OC.state([await this.X(), 1]),  // These are "pure states", in the form
			BdidY = OC.state([1, await this.Y()]),	// {p: Map[PartyID => PartyState], source: DataSource}
			AdidZ = OC.state([await this.Z(), 1]);	// PartyState = Float[0,1] is a subjective degree of confidence
													// (Bayesian probability) assigned by source at a given time

		return OC.not((AdidX.and(BdidY)).or(AdidZ));	// and, or and not are operators that produce compound states:
														// p values for each party are computed recursively down the tree.
														// The whole computation tree is maintained so the engine
														// can pinpoint to the user and API how externally-sourced information
														// determines the final inferred p.
	},
	X: async () => await this.query('X'),		// Contract templates can declare any number of instance methods, which can be
	Y: async () => await this.query('Y'),		// sync or async functions. The caller is expected to know the difference.
	Z: async () => await this.query('Z'),		// When in doubt, assume async.
	query: async (queryString) => {
		var oracle = await OC.getOracleByName('anOracle'),
			response = await oracle.query(queryString);  // oracles define their own query APIs. Any JSON object is allowed
    	return response;
	},
});

var c2 = ct2.instantiate({
	parties: [alice, bob]  // using just a regular array
});

await c2.update();
var x = await X(),
	y = await Y(),
	z = await Z();

// This is the internal representation of an inference/computation tree for a compound state.
// Probably should not be accessed directly, but can be exported to JSON for auditing
c2.valid.should.deep.equal({
	p: [(1 - x.p)*(1 - z.p), (1 - x.p)*(1 - z.p)],
	$not: {
		p: [1 - (1 - x.p)*(1 - z.p), 1 - (1 - x.p)*(1 - z.p)],
		$or: [
			{
				p: [x.p, y.p],
				$and: [
					{
						p: [x.p, 1],
						$source: [x.source, null]
					},
					{
						p: [1, y.p],
						$source: [null, x.source]
					}
				]
			},
			{
				p: [z.p, 1],
				$source: [z.source, null]
			}
		]
	}
});

/*
 Example: a Proof of Identity contract

 PoIs are exactly like any other contract, but they receive special attention from the interpreter engine:
 - At least two parties are required, named subject and certifier, and subject must have a var called idToken (see the parties field below).
 - A publicConst field called id is required, which should contain a standard representation of an identity
   (to start with, provider/name pairs, where provider is any oracle in the registry).
 - getState is exactly as below
 - provider implements a compatible identification API (OpenID Connect; Facebook Login)
 */
var ct3 = new OC.ContractTemplate({
	publicConst: {  // variables in publicConst are meant to be publicly visible and not to be changed
					// (peers can reject a published update if it changes publicConst).
		id: {
			provider: await OC.getOracleByName('facebookLogin'),
			name: 'alice'
		}
	},
	parties: {  // this explicitly defines the contract template's parties.
				// It is necessary if you want to set private vars, like idToken
		subject: {
			vars: ['idToken']
		},
		certifier: {}
	}
	// This is a fully general implementation of the clause "Bob claims that Alice is able to log in as alice on Facebook".
	// Although Alice does not participate in this step (after all, this is Bob certifying), Alice is assumed to set
	// the private var idToken before execution of getState. (That is, Alice's node must propagate a signed update to the
	// contract where idToken is set. Since the var is private to subject, updates setting idToken need to be signed only by Alice.)
	// If idToken is valid and corresponds to the given name, the provider will respond favorably with the query.
	// Else Bob is considered to be in breach.
	getState: async () => {
		var providedCertification = await this.publicConst.id.provider.query({
				idToken: this.parties.subject.vars.idToken,
				name: this.publicConst.id.name
			});

		return OC.state({
			subject: 1,
			certifier: providedCertification
		});
	}
});

var c3 = ct3.instantiate({
	parties: {
		subject: alice,
		certifier: bob
	}
});

/*
 Example: a contract granting rights

 The below contract implements a freemium model. If the buyer has paid, he gets premium access, otherwise only free access.
 Similar to the PoI example, proof of payment is provided through a paymentToken private var which the buyer is assumed to provide,
 either upon instantiation or asynchronously in a later update.

 A contract instance can contain at most a finite number of associated rights. Each right must be uniquely named. Rights are
 a scarce resource in a given contract registry, and are only allowed to signing parties of their corresponding contracts.
 It is thus always possible to link an instance of a right being granted to the signature of a specific contract and the parties
 can (via the inference tree) audit the chain of deductions that has resulted in a grant.

 Rights thus declared can be queried using the contract instance's API. The heart of the OC model is that any nodes can
 programmatically agree on the contract declaration (from the signed hash of contract template), on the contract state
 (from the inference tree and explicitly-sourced data), and therefore should always agree on rights. A later example will treat
 disagreements.

 Although payment can also be understood as a right to a scarce token, money is not a good fit for OpenContract rights...

 As in this example, rights may be linked to subclauses. The grant statement will add a $grant field in the corresponding node
 of the inference tree.
 */
var ct4 = new OC.ContractTemplate({
	parties: {
		buyer: {
			vars: ['paymentToken']
		},
		seller: {}
	},
	publicConst: {
		price: 49.99
	},
	rights: ['premiumAccess', 'freeAccess'],
	getState: async () => {
		var paymentGateway = await OC.getOracleByName('paymentGateway'),
			buyerHasPaid = await paymentGateway.query({
				paymentToken: this.parties.buyer.vars.paymentToken,
				value: this.publicConst.price,
				account: 'sellersAccountID'
			});

		return OC.or(	buyerHasPaid.grant(this.parties.buyer, this.rights.premiumAccess, 0.999),		// the numeric values are p thresholds
						buyerHasPaid.not().grant(this.parties.buyer, this.rights.freeAccess, 0.999));	// for granting the associated rights
	}
});

var c4 = ct4.instantiate({
	parties: {
		buyer: alice,
		seller: bob
	}
}).sign({buyer: alicesSigPrivateKey, seller: bobsSigPrivateKey});

await c4.update();

c4.testRight('premiumAccess', 'buyer').should.equal(false);		// Specialized method
(await c4.query({ right: 'premiumAccess', party: 'buyer' })).should.equal(false);	// Oracle API-conformant method

await c4.update({'parties.buyer.vars.paymentToken': 'aValidPaymentToken'}).sign({buyer: alicesSigPrivateKey});

(await c4.query({ right: 'premiumAccess', party: 'buyer' })).should.equal(true);

/*
 Example: publishing a contract to a registry (in this case the local registry)
 */

/*
 Example: fetching a contract from a registry

 Private vars encrypted with the party's encryption public key...
 */

/*
 Example: publishing a contract update

 Updates to most contract fields must be jointly signed by all parties in order to propagate.
 Exceptions are:
 - publicMutable variables (may be signed by any single party);
 - private variables (need be signed only by the party that owns the variable)
 */

/*
 Example: compounding evidence from multiple oracles

 An inference is only as good as the data on which it is based. A basic way of improving your level of confidence
 is querying from multiple data sources.
 */

/*
 Example: settling disagreements
 */

 /*
 Example: punishing misbehaving parties

 Sometimes an arbiter's decision will not be heeded. The arbiter will then publish a negative statement contract, signed by
 itself and the injured party, and having the offender a nonsigning third party. The getState of this negative statement can
 take at least two forms:
 - Open version: If the original contract is (or can be made) public, getState queries the original contract and contrasts with
   the offending node's behavior. For example, show that the original contract granted a right, but the offending node
   provably denied the right (at such a time where the right was indeed granted per the contract).
 - Closed version: getState queries another node as reference oracle (maybe the arbiter itself).

 The idea is that, while the infringed contract is private and observable only to the original parties, the negative statement
 is public, so it can be run locally by any node. This will propagate as a breached contract by the seller and detract from
 the seller's trust rating on all nodes.

 This method requires using the stored, signed responses from nodes as evidence. Thus highlighting the importance of storing
 responses locally, and of interacting using the signed API as much as possible. For instance, if Alice's client were
 incorrectly denied premium access but her node did not subsequently query the seller's node to match responses, Alice's case
 will rest on screenshots or other less-reliable pieces of evidence, requiring human evaluation (and possibly a less substantive
 p-value for the negative statement).

 Another case requiring human intervention is if the business rules as implemented by the seller do not match the response from
 his OC node - that is, on a query, the node correctly says Alice should be granted access, but Alice does not obtain the
 requisite access. This can happen due to a buggy integration between OC and , network issues, etc.

 This can be ameliorated if the contract includes a requirement for signed receipts. 

 It is important to note that this is part of the arbiter node's business rules, and not a built-in property of the network's
 operational semantics. There is no a priori guarantee that the arbiter will perform the punishment.
 */

var query = {
		right: 'premiumAccess',
		party: alice.id
	},
	offendingResponse = {
		p: 0,
		source: {
			nodeID: 'registryID/offendingNodeID',
			timestamp: 'appropriateTimestamp',
			query: query
		}
	};

var ct5 = new OC.ContractTemplate({
	parties: ['arbiter', 'buyer', 'seller'],
	getState: async () => {
		var originalContract = await OC.getContractByID('originalContract'),
			correctResponse = await originalContract.query(query);

		return OC.state({
			arbiter: OC.verify(offendingResponse,		// this proves that the seller indeed gave the offending response 
								this.parties.seller.signaturePublicKey,
								'signature'),
			seller: OC.eq(correctResponse, offendingResponse)	// this will give p = 0 to the seller
		});
	}
});

/*
 Example: contract builder

 This is a shorthand for writing getState functions.
 */

var cb = ct1.ContractBuilder;
var stateFun1 = cb.state({alice: 1, bob: 1});

var cb = ct2.ContractBuilder;
var stateFun2 = cb.not(cb.or(cb.and('AdidX', 'BdidY'), 'AdidZ')).where({
					AdidX: cb('A').query('anOracle', 'X'),
					BdidY: cb('B').query('anOracle', 'Y'),
					AdidZ: cb('A').query('anOracle', 'Z')
				});



