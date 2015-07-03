/*
	Prototype implementation of the OC JS library. Stubs where necessary. DO NOT USE IN PRODUCTION.

	Technical todos:
	 - Get source maps working
	 - Proper sandboxing for deserializing and running contract functions
	   (maybe turn into ES6 modules and use Loader?)
 */

var _ = require('lodash'),
	crypto = require('crypto'),
	ecdsa = require('ecdsa'),
	secureRandom = require('secure-random'),
	ECKey = require('eckey'),
	uuid = require('node-uuid');

let localRegistry = new Map();

class Party {
	constructor (params={}) {
		this.name = params.name;
		this.publicKey = new Buffer(params.publicKey);
	}
}

class Registry {
	constructor (name) {  // TODO: STUB
		this.name = name;
		this.keyPair = API.generateKeyPair();
	}

	namespacedID (id) {
		return `${this.name}/${id}`;
	}

	async publish (doc) {
		const id = uuid.v4(),
			namespaced = this.namespacedID(id),
			publishTimestamp = new Date(),
			data = doc.serialize(),
			shaMsg = createHash(`${data}/${namespaced}/${publishTimestamp}`),
			publishSig = ecdsa.sign(shaMsg, this.keyPair.privateKey);

		const obj = {
			id,
			publishTimestamp,
			publishSig,
			data
		};

		localRegistry.set(namespaced, obj);

		return _.merge(obj, {registry: this});
	}

	async fetch (id) {
		const namespaced = this.namespacedID(id);
		if (localRegistry.has(namespaced))
			return localRegistry.get(namespaced);

		throw new Error(`No object ${id} on registry ${this.name}`);
	}
}

const standardContractFunctions = {
	getState: () => {
		return {p: 1, source: null}
	},
	isExpired: () => false,
	isRevoked: () => false
};

class Contract {

	constructor (params={}) {

		const template = params.template || {};

		this.parties = params.parties || template.parties || [];

		this.signatures = params.signatures || {};

		// override defaults
		for (let name of Object.keys(standardContractFunctions)) {
			this[name] = params[name] || template[name] || standardContractFunctions[name];
		}

		this.shaMsg = createHash(this.serialize({signatures: false}));

	}

	async _getState() {
		return await this.runInSandbox(this.getState);
	}

	async _isExpired() {
		return await this.runInSandbox(this.isExpired);
	}

	async _isRevoked() {
		return await this.runInSandbox(this.isRevoked);
	}

	get signed () {
		return this.verifySignature(this.parties);
	}

	serialize (filters={}) {
		return veryComplexSerialize(this, filters);
	}

	sign (pks) {
		this.signatures = _.merge(this.signatures, _.mapValues(pks, function (pk) {
			return ecdsa.sign(this.shaMsg, pk);
		}, this));
		console.log('Signed');
	}

	verifySignature (parties) {  // parties must be a subset of this.parties
		//console.log(`Hash: ${this.shaMsg}`);

		return _.mapValues(parties, function (partyVar, partyName) {

			if (! partyVar.publicKey)
				throw new Error(`No public key for party ${partyName}`);

			if (! this.signatures[partyName])
				return false;

			//console.log(`Verifying ${partyName}`);
			//console.log(this.signatures[partyName]);
			//console.log(partyVar.publicKey);

			try {
				return ecdsa.verify(this.shaMsg, this.signatures[partyName], partyVar.publicKey);
			} catch (e) {
				console.trace(e);
				return false;
			}
		}, this);
	}

	async update () {
		this.valid = await this._getState();

		this.expired = await this._isExpired();
		this.revoked = await this._isRevoked();

		return this;
	};

	async runInSandbox (fn) {  // TODO: obviously not a real sandbox
		let r = await fn.apply(this);
		return r;
	}

	async publish (registry) {
		return await registry.publish(this);
	}

	static async load (publishedObj) {
		let	registry = new Registry(publishedObj.registry.name),
			obj = await registry.fetch(publishedObj.id),
			params = safelyDeserialize(obj.data);
		return new Contract(params);
	}
}

var API = {
	getPartyByName: async function (name, publicKey) {  // TODO: STUB
		return new Party({name, publicKey});
	},
	state: (p, source) => {
		source = source || null;
		return {p, source};
	},
	Contract: Contract,
	Registry: Registry,
	generateKeyPair: () => {
		var bytes = secureRandom(32);
		return new ECKey(bytes);
	}
};

module.exports = API;

function createHash(string, encoding='utf8', hashFunction='sha256') {
	const buffer = new Buffer(string, encoding);
	return crypto.createHash(hashFunction).update(buffer).digest();

}

function veryComplexSerialize(obj, filters) {

	let signatures = _.mapValues(obj.signatures, (sig) => {
			console.log(sig.constructor);
			var ser = ecdsa.serializeSigCompact(sig, 0);
			console.log(ser.constructor);
			return ser;
		}),
		copy = _.merge(obj, {signatures});

	//if (obj.signatures.alice) console.log(ecdsa.serializeSig(obj.signatures.alice));

	let str = JSON.stringify(copy, function (key, value) {
		if (filters[key] === false)
			return undefined;

		if (typeof value === 'function')
			return value.toString();

		return value;
	});

	return str;
}

function safelyDeserialize(data) {
	let obj = JSON.parse(data);

	for (let name of Object.keys(standardContractFunctions)) {
		if (obj[name])
			obj[name] = safelyDeserializeFunction(obj[name]);
	}

	obj.parties = _.mapValues(obj.parties, (party) => new Party(party));
	obj.signatures = _.mapValues(obj.signatures, (sig) => ecdsa.parseSigCompact(new Buffer(sig)));

	//console.log(obj.signatures);

	return new Contract(obj);

	function safelyDeserializeFunction (fnString) { // TODO: Make this safe
		let fn;
		eval(`fn = ${fnString}`);
		return fn;
	}
}