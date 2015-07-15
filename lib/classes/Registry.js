import { Util } from './Util';

let uuid = require('node-uuid'),
    _ = require('lodash');

let localRegistry = new Map();

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
            shaMsg = Util.createHash(`${data}/${namespaced}/${publishTimestamp}`),
            publishSig = await Util.sign(this.keyPair.privateKey, shaMsg);

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