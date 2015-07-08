/*
	Prototype implementation of the OC JS library. Stubs where necessary. DO NOT USE IN PRODUCTION.

	Technical todos:
	 - Get source maps working
	 - Proper sandboxing for deserializing and running contract functions
	   (maybe turn into ES6 modules and use Loader?)
 */

var _ = require('lodash'),
	crypto = require('crypto'),
	eccrypto = require('eccrypto'),
	secureRandom = require('secure-random'),
	uuid = require('node-uuid');

let ML = require('es6-module-loader'),
    System = ML.System,
    Loader = ML.Loader;

System.transpiler = 'babel';

let localRegistry = new Map();

export class Party {
	constructor (params={}) {
		this.name = params.name;
		this.publicKey = new Buffer(params.publicKey);
	}
    static async getPartyByName (name, publicKey) {  // TODO: STUB
        return new Party({name, publicKey});
    }
}

export class Registry {
	constructor (name) {  // TODO: STUB
		this.name = name;
		this.keyPair = Util.generateKeyPair();
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
			publishSig = await eccrypto.sign(this.keyPair.privateKey, shaMsg);

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
	body: () => {
		return {p: 1, source: null}
	},
	isExpired: () => false,
	isRevoked: () => false
};

export class Contract {

	constructor (params={}) {

		const template = params.template || {};

		this.parties = params.parties || template.parties || [];

		this.signatures = params.signatures || {};

		// override defaults
		for (let name of _.keys(standardContractFunctions)) {
			this[name] = params[name] || template[name] || standardContractFunctions[name];
		}

		this.shaMsg = createHash(this.serialize({signatures: false}));

	}

	async _body() {
		return await this.runInSandbox(this.body);
	}

	async _isExpired() {
		return await this.runInSandbox(this.isExpired);
	}

	async _isRevoked() {
		return await this.runInSandbox(this.isRevoked);
	}

	async _isSigned () {
		return await this.verifySignature(this.parties);
	}

	async updateIsSigned () {
		this.signed = await this._isSigned();
	}

	serialize (filters={}) {
		return veryComplexSerialize(this, filters);
	}

	async sign (privateKeys) {
		let hash = this.shaMsg;
		let newSignatures = await asyncMapValues(privateKeys, async function (pk) {
			return await eccrypto.sign(pk, hash);
		});

		this.signatures = _.merge(this.signatures, newSignatures);
		await this.updateIsSigned();
		return this;
	}

	async verifySignature (parties) {  // parties must be a subset of this.parties

		let _this = this;

		return await asyncMapValues(parties, async function (partyVar, partyName) {

			if (! partyVar.publicKey)
				throw new Error(`No public key for party ${partyName}`);

			if (! _this.signatures[partyName])
				return false;

			try {
				await eccrypto.verify(partyVar.publicKey, _this.shaMsg, _this.signatures[partyName]);
				return true;
			} catch (e) {
				console.trace(e);
				return false;
			}
		});
	}

	async update () {
		this.valid = await this._body();

		this.expired = await this._isExpired();
		this.revoked = await this._isRevoked();

		await this.updateIsSigned();

		return this;
	};

	async runInSandbox (fn) {  // TODO: obviously not a real sandbox
		try {
			let r = await fn.apply(this);
			return r;
		} catch (e) {
			console.log(`Sandbox execution failed for ${fn}`);
			throw e;
		}
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

export class State {
    constructor (p, source=null) {  // TODO: STUB
        this.p = p;
        this.source = source;
    }

    compile() {
        return JSON.stringify(this);
    }
}

export class UnitState extends State {
}

export class Clause {
    constructor () {
    }

    static single(partyOrName, stateOrQuery = null) {
        const name = (partyOrName instanceof Party) ? partyOrName.name : partyOrName;

        return new BaseClause({[name]: stateOrQuery});
    }

    static base(statesOrQueries) {
        return new BaseClause(statesOrQueries);
    }

    static not(child) {
        return new CompoundClause('not', [child]);
    }

    static or(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        return new CompoundClause('or', _children);
    }

    static and(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        return new CompoundClause('and', _children);
    }

    compile() {
        let body = this.compileBody();
        let fn;
        let loader = new Loader();
        let p = loader.eval(`fn = async () => { ${body} }`);
        console.log(p);
        return fn;
    }
}

class CompoundClause extends Clause {
    constructor(operator, children) {
        super();
        this.operator = operator;
        this.children = children;
    }

    replace(defs) {
        if (!defs) return this;

        let newChildren = this.children.map(child => {
            if (child instanceof Clause) {
                return child.replace(defs);
            } else if (defs[child]) {
                return defs[child];
            } else {
                throw new Error(`No clause definition ${defs[child]} in ${defs}`);
            }
        });

        return new CompoundClause(this.operator, newChildren);
    }

    where(defs) {
        let newClause = this.replace(defs);

        return newClause.compile();
    }

    compileBody() {
        let compiledChildren = this.children.map(child => child.compileBody());
        return `new CompoundJointState('${this.operator}', ${compiledChildren})`;
    }
}

class BaseClause extends Clause {
    constructor (statesOrQueries) {
        super();

        this._statesOrQueries = statesOrQueries;
    }

    query (q) {
        return this.setStateOrQuery(q, 'query');
    }

    state (s) {
        return this.setStateOrQuery(s, 'state');
    }

    setStateOrQuery (stateOrQuery, method) {
        if (_.keys(this._statesOrQueries).length < 1)
            throw new Error(`Unclear usage of .${method} on a clause without defined party`);

        if (_.keys(this._statesOrQueries).state > 1)
            throw new Error(`Unclear usage of .${method} on a multiparty clause`);

        let theKey = _.keys(this._statesOrQueries)[0];

        this._statesOrQueries[theKey] = stateOrQuery;

        return this;
    }

    replace(defs) {
        return this;
    }

    where(defs) {
        return this;
    }

    compileBody() {
        let dict = _.mapValues(this._statesOrQueries, sOrQ => sOrQ.compile()),
            str = _.keys(dict).map(key => `${key} : ${dict[key]}`).join(', ');
        return `new BaseJointState({${str}})`;
    }
}

export class Query {
    constructor (oracleURI, query) {
        this.oracleURI = oracleURI;
        this.query = query;
    }

    compile() {
        return `await Oracle.fetchAndQuery(${this.oracleURI}, ${this.query})`;
    }
}

export class Util {
    static generateKeyPair () {
        let privateKey = crypto.randomBytes(32),
            publicKey = eccrypto.getPublic(privateKey);

        return {privateKey, publicKey};
    }
}

function createHash(string, encoding='utf8', hashFunction='sha256') {
	const buffer = new Buffer(string, encoding);
	return crypto.createHash(hashFunction).update(buffer).digest();

}

function veryComplexSerialize(obj, filters) {

	return JSON.stringify(obj, function (key, value) {
		if (filters[key] === false)
			return undefined;

		if (typeof value === 'function')
			return value.toString();

		return value;
	});
}

function safelyDeserialize(data) {
	let obj = JSON.parse(data);

	for (let name of _.keys(standardContractFunctions)) {
		if (obj[name])
			obj[name] = safelyDeserializeFunction(obj[name]);
	}

	obj.parties = _.mapValues(obj.parties, (party) => new Party(party));
	obj.signatures = _.mapValues(obj.signatures, (sig) => new Buffer(sig));

	return new Contract(obj);

	function safelyDeserializeFunction (fnString) { // TODO: Make this safer
		let _this = this,
			_libOc = {Contract, State, Clause};  // Obviously this is evil, makes use of Babel transpilation convention
		let fn;
		eval(`fn = ${fnString}`);
		return fn;
	}
}

async function asyncMap(array, fn) {
	return await Promise.all(array.map(fn));
}

async function asyncMapValues(obj, fn) {
	let promises = _.values(_.mapValues(obj, fn)),
		results = await Promise.all(promises),
		mappedObj = _.zipObject(_.keys(obj), results);
	return mappedObj;
}