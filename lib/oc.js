/*
	Prototype implementation of the OC JS library. Stubs where necessary. DO NOT USE IN PRODUCTION.

	Technical todos:
	 - Use ES6 classes
	 - Get source maps working
	 - Proper sandboxing for deserializing and running contract template functions
	   (maybe turn templates into ES6 modules and use Loader?)
 */

var _ = require('lodash'),
	crypto = require('crypto'),
	ecdsa = require('ecdsa'),
	serialize = require('serialize-javascript'),
	uuid = require('node-uuid');

var localRegistry = new Map();

class Registry {
	constructor (name) {  // STUB
		this.name = name;
		this.keyPair = API.generateKeyPair();
	}

	namespacedID (id) {
		return `${this.name}/${id}`;
	}

	async publish (doc) {
		const id = uuid.v4(),
			namespacedID = this.namespacedID(id),
			timestamp = new Date(),
			copy = _.clone(doc),
			buffer = new Buffer(doc.serialize() + `/${namespacedID}/${timestamp}`, 'utf8'),
			shaMsg = crypto.createHash('sha256').update(buffer).digest(),
			sig = ecdsa.sign(shaMsg, this.keyPair.privateKey);

		const obj = {
			_id: id,
			publishTimestamp: timestamp,
			publishSig: sig,
			data: copy
		};

		localRegistry.set(namespacedID, obj);

		return obj;
	}

	async fetch (id) {
		const namespacedID = this.namespacedID(id);
		if (localRegistry.has(namespacedID))
			return localRegistry.get(namespacedID);

		throw new Error(`No object ${id} on registry ${this.name}`);
	}
}

function ContractTemplate (params) {
	params = params || {};
	this.getState = params.getState || this.getState;
	this.isExpired = params.isExpired || this.isExpired;
	this.isRevoked = params.isRevoked || this.isRevoked;
	return this;
}

ContractTemplate.prototype.instantiate = function (params) {
	return new Contract(this, params);
};

ContractTemplate.prototype.getState = function () {
	return {p: 1, source: null};
};

ContractTemplate.prototype.isExpired = function () {
	return false;
};

ContractTemplate.prototype.isRevoked = function () {
	return false;
};

ContractTemplate.prototype.load = async function (publishedTemplate) {
	let	registry = new Registry(publishedTemplate.registry),
		obj = await registry.fetch(publishedTemplate.id),
		template = obj.data;

	['getState', 'isExpired', 'isRevoked'].forEach(name => {
		if (template[name])
			template[name] = safelyDeserializeFunction(template[name]);
	});

	return template;

	function safelyDeserializeFunction (fnString) { // Make this safe
		return eval(fnString);
	}
};

function Contract (template, params) {
	if (! template)
		throw new Error('A contract template is required.');

	this.template = template;

	params = params || {};

	this.parties = params.parties || [];

	this.signatures = {};

	var buffer = new Buffer(this.serialize(), 'utf8');
	this.shaMsg = crypto.createHash('sha256').update(buffer).digest();

	Object.defineProperty(this, 'signed', {
		get: function () {
			return this.verifySignature(this.parties);
		}
	});

	this.update();

	return this;
};

Contract.prototype.serialize = function () {
	return serialize(this);
};

Contract.prototype.verifySignature = function (parties) {  // parties must be a subset of this.parties
	return _.mapValues(parties, function (partyVar, partyName) {
		if (! partyVar.publicKey)
			throw new Error(`No public key for party ${partyName}`);
		if (! this.signatures[partyName])
			return false;
		return ecdsa.verify(this.shaMsg, this.signatures[partyName], partyVar.publicKey);
	}, this);
};

Contract.prototype.sign = function (pks) {
	this.signatures = _.merge(this.signatures, _.mapValues(pks, function (pk) {
		return ecdsa.sign(this.shaMsg, pk);
	}, this));
};

Contract.prototype.update = async function () {
	var state = await this.runInSandbox(this.template.getState);
	this.valid = state;

	this.expired = this.template.isExpired.apply(this);
	this.revoked = this.template.isRevoked.apply(this);

	return this;
};

Contract.prototype.runInSandbox = async function (fn) {  // obviously not a real sandbox
	return await fn.apply(this);
};

Contract.prototype.load = async function (publishedObj) {
	const template = await ContractTemplate.load(publishedObj.template);
	return new Contract(template, publishedObj);
};

var API = {
	getPartyByName: async function (name, publicKey) {  // STUB
		return {name, publicKey};
	},
	state: (p, source) => {
		source = source || null;
		return {p, source};
	},
	ContractTemplate: ContractTemplate,
	Contract: Contract,
	generateKeyPair: () => {
		var bytes = secureRandom(32);
		return new ECKey(bytes);
	}
};

module.exports = API;