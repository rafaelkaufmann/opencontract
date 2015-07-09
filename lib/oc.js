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
	body: function () {
		return {p: _.mapValues(this.parties, 1), source: null}
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
        if (this.body instanceof Clause) {
            let ans = await this.body.eval();
            this.body.clearMemo();
            return ans;
        }
        else
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
        return new NotClause(child);
    }

    static or(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        return new OrClause(_children);
    }

    static and(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        return new AndClause(_children);
    }

    where(defs) {
        this.defs = defs;
        return this;
    }

    searchForDefinition(name) {
        if (this.defs && this.defs[name]) {
            return this.defs[name];
        } else if (this.parent) {
            return this.parent.searchForDefinition(name);
        } else {
            throw new Error(`Undefined name ${name}`);
        }
    }

    toJSON() {
        return {
            defs: this.defs
        };
    }
}

class CompoundClause extends Clause {
    constructor(operator, children) {
        super();
        this.operator = operator;
        let _children = [];
        for (let child of children) {
            let _child;
            if (child instanceof Clause) {
                _child = child;
            } else if (_.isString(child)) {
                _child = new NamedClause(child);
            } else {
                _child = new BaseClause(child);
            }
            _child.parent = this;
            console.log(_child);
            this.parties = _.union(this.parties, _child.parties);
            console.log(this.parties);
            _children.push(_child);
        }
        this.children = _children;
    }

    clearMemo() {
        for (let child of this.children) {
            child.clearMemo();
        }
    }

    toJSON() {
        return _.merge(super.toJSON(), {
            operator: this.operator,
            children: this.children.map(child => child.toJSON())
        });
    }
}

class OrClause extends CompoundClause {
    constructor (children) {
        super('or', children);
    }

    async eval () {
        console.log('Eval or clause');
        let childrenStates = [],
            pBar = zipWithValue(this.parties, 1);

        for (let child of this.children) {
            let s = await child.eval();
            childrenStates.push(s);

            if (_.every(_.values(s.p), (x) => x === 1)) {
                pBar = zipWithValue(this.parties, 0);
                break;
            }

            _.forEach(pBar, (v, k) => {
                let p = (s.p[k] === undefined) ? 1 : s.p[k];
                pBar[k] *= (1 - p);
            });
        }

        let ans = {
            p: _.mapValues(pBar, pB => 1 - pB),
            operator: 'or',
            children: childrenStates
        };
        console.log(ans);
        return ans;
    }
}

class AndClause extends CompoundClause {
    constructor (children) {
        super('and', children);
    }

    async eval () {
        console.log('Eval and clause');
        let childrenStates = [],
            p = zipWithValue(this.parties, 1);
        console.log('Initial assignment:');
        console.log(p);

        for (let child of this.children) {
            let s = await child.eval();
            childrenStates.push(s);

            if (_.every(_.values(s.p), (x) => x === 0)) {
                p = zipWithValue(this.parties, 0);
                break;
            }

            _.forEach(p, (v, k) => {
                let p = (s.p[k] === undefined) ? 1 : s.p[k];
                p[k] *= (1 - p);
            });
            console.log(p);
        }

        let ans = {
            p: p,
            operator: 'and',
            children: childrenStates
        };
        console.log(ans);
        return ans;
    }
}

class NotClause extends CompoundClause {
    constructor (child) {
        super('not', [child]);
    }

    async eval () {
        console.log('Eval not clause');
        let s = await this.children[0].eval();
        let ans = {
            p: _.mapValues(s.p, p => 1 - p),
            operator: 'not',
            children: s
        };
        console.log(ans);
        return ans;
    }
}

class BaseClause extends Clause {
    constructor (statesOrQueries) {
        super();

        this.statesOrQueries = statesOrQueries;
        this.parties = _.keys(statesOrQueries);
    }

    query (q) {
        return this.setStateOrQuery(q, 'query');
    }

    state (s) {
        return this.setStateOrQuery(s, 'state');
    }

    setStateOrQuery (stateOrQuery, method) {
        if (this.parties.length < 1)
            throw new Error(`Unclear usage of .${method} on a clause without defined party`);

        if (this.parties.state > 1)
            throw new Error(`Unclear usage of .${method} on a multiparty clause`);

        let theKey = this.parties[0];

        this.statesOrQueries[theKey] = stateOrQuery;

        return this;
    }

    async eval () {
        console.log('Eval base clause');
        let p = zipWithValue(this.parties, null),
            source = zipWithValue(this.parties, null);
        for (let party of this.parties) {
            let sOrQ = this.statesOrQueries[party],
                ans = await evalStateOrQuery(sOrQ);
            p[party] = ans.p;
            source[party] = ans.source;
        }
        console.log(p);
        return {p, source};

        async function evalStateOrQuery(sOrQ) {
            if (sOrQ instanceof State) {
                console.log('Eval state');
                console.log(sOrQ);
                return sOrQ;
            } else {
                console.log('Running query');
                let ans = await sOrQ.run();
                console.log(ans);
                return ans;
            }
        }
    }

    clearMemo() {
        for (let sOrQ of this.statesOrQueries) {
            if (sOrQ instanceof Query)
                sOrQ.memo = null;
        }
    }

    toJSON() {
        return _.merge(super.toJSON(), {
            statesOrQueries: this.statesOrQueries
        });
    }
}

class NamedClause extends Clause {
    constructor (name) {
        super();

        this.name = name;
    }

    async eval() {
        console.log('Eval named clause');
        let def = this.searchForDefinition(this.name);
        console.log(def);
        return await def.eval();
    }

    clearMemo() {
        let def = this.searchForDefinition(this.name);
        return def.clearMemo();
    }

    toJSON() {
        return this.name;
    }
}

export class Query {
    constructor (oracleURI, query) {
        this.oracleURI = oracleURI;
        this.query = query;
        this.memo = null;
    }

    async run() {
        let ans;
        if (this.memo) {
            ans = this.memo;
        } else {
            ans = await Oracle.fetchAndQuery(this.oracleURI, this.query);
            this.memo = ans;
        }

        return ans;
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

        if (value instanceof Clause)
            return JSON.stringify(value.toJSON());

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

	function safelyDeserializeFunction (fnString) { // TODO: Make this safer. Investigate using `dslify`
		let _this = this,
			_libOc = {Contract, State, Clause}  // Obviously this is evil, makes use of Babel transpilation convention
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

function zipWithValue (arr, val) {
    return _.zipObject(arr, arr.map(() => val));
}