/*
	Prototype implementation of the OC JS library. Stubs where necessary. DO NOT USE IN PRODUCTION.

	Technical todos:
	 - Use ES6 classes
	 - Get source maps working
 */

var _ = require('lodash'),
	crypto = require('crypto'),
	ecdsa = require('ecdsa'),
	serialize = require('serialize-javascript');

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
}

ContractTemplate.prototype.isExpired = function () {
	return false;
}

ContractTemplate.prototype.isRevoked = function () {
	return false;
}

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

Contract.prototype.verifySignature = function (parties) {  // parties should be a subset of this.parties
	return _.mapValues(parties, function (partyVar, partyName) {
		if (! partyVar.publicKey)
			throw new Error(`No public key for party ${partyName}`);
		if (! this.signatures[partyName])
			return false;
		return ecdsa.verify(this.shaMsg, this.signatures[partyName], partyVar.publicKey);
	}, this);
}

Contract.prototype.sign = function (pks) {
	this.signatures = _.merge(this.signatures, _.mapValues(pks, function (pk) {
		return ecdsa.sign(this.shaMsg, pk);
	}, this));
}

Contract.prototype.update = async function () {
	var state = await this.template.getState.apply(this);
	this.valid = state;

	this.expired = this.template.isExpired.apply(this);
	this.revoked = this.template.isRevoked.apply(this);

	return this;
}

var API = {
	getPartyByName: async function (name, publicKey) {  /* STUB */
		return {name, publicKey};
	},
	state: function (p, source) {
		source = source || null;
		return {p, source};
	},
	ContractTemplate: ContractTemplate,
	Contract: Contract
};

module.exports = API;