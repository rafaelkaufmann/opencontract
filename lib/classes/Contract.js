import { Util } from './Util';
import { Serializer } from './Serializer';
import { ContractBody } from './ContractBody';
import { Registry } from './Registry';
import { Party } from './Party';
import { State, UnitState } from './State';

var _ = require('lodash');

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

        if (! (this.body instanceof ContractBody))
            this.body = new ContractBody(this.body);

        this.shaMsg = Util.createHash(this.serialize({signatures: false}));

    }

    async _body() {
        return await this.body.eval(this);
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
        return Serializer.serialize(this, filters);
    }

    async sign (privateKeys) {
        let hash = this.shaMsg;
        let newSignatures = await asyncMapValues(privateKeys, async function (pk) {
            return await Util.sign(pk, hash);
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
                await Util.verify(partyVar.publicKey, _this.shaMsg, _this.signatures[partyName]);
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
            params = Serializer.deserialize(obj.data);
        return new Contract(params);
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