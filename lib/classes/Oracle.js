import { UnitState } from './State';

export class Oracle {
    constructor (name, registry) {
        this.name = `${registry.name}/${name}`;
    }

    async query (query) {   // TODO: STUB
        return new UnitState(1, this.name);
    }
}

export class OracleFactory {
    constructor (registry) {
        this.registry = registry;
    }

    async fetchAndQuery (name, query) {
        let oracle = await this.fetch(name);
        return await oracle.query(query);
    }

    async fetch (name) {   // TODO: STUB
        return new Oracle(name, this.registry);
    }
}