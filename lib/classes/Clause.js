import { Party } from './Party';
import { State } from './State';
import { Query } from './Query';

let _ = require('lodash');

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
            this.parties = _.union(this.parties, _child.parties);
            _children.push(_child);
        }
        this.children = _children;
    }

    clearMemo() {
        console.log('Clearing memo for CompoundClause');
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
        let parties = [],
            childrenStates = [],
            pBar = {};

        for (let child of this.children) {
            let s = await child.eval();
            parties = _.union(parties, _.keys(s.p));

            childrenStates.push(s);

            if (_.every(_.values(s.p), (x) => x === 0)) {
                pBar = zipWithValue(parties, 0);
                break;
            }

            for (let party of parties) {
                let p0 = (pBar[party] === undefined) ? 0 : (1 - pBar[party]),
                    p1 = (s.p[party] === undefined) ? 0 : s.p[party];

                pBar[party] = (1 - p0) * (1 - p1);
            }
        }

        let ans = {
            p: _.mapValues(pBar, pB => 1 - pB),
            operator: 'or',
            children: childrenStates
        };
        return ans;
    }
}

class AndClause extends CompoundClause {
    constructor (children) {
        super('and', children);
    }

    async eval () {
        let parties = [],
            childrenStates = [],
            p = {};

        for (let child of this.children) {
            let s = await child.eval();
            parties = _.union(parties, _.keys(s.p));

            childrenStates.push(s);

            if (_.every(_.values(s.p), (x) => x === 0)) {
                p = zipWithValue(parties, 0);
                break;
            }

            for (let party of parties) {
                let p0 = (p[party] === undefined) ? 1 : p[party],
                    p1 = (s.p[party] === undefined) ? 1 : s.p[party];

                p[party] = p0 * p1;
            }
        }

        let ans = {
            p: p,
            operator: 'and',
            children: childrenStates
        };
        return ans;
    }
}

class NotClause extends CompoundClause {
    constructor (child) {
        super('not', [child]);
    }

    async eval () {
        let s = await this.children[0].eval();
        let ans = {
            p: _.mapValues(s.p, p => 1 - p),
            operator: 'not',
            children: [s]
        };
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
        let p = zipWithValue(this.parties, null),
            source = zipWithValue(this.parties, null);
        for (let party of this.parties) {
            let sOrQ = this.statesOrQueries[party],
                ans = await evalStateOrQuery(sOrQ);
            p[party] = ans.p;
            source[party] = ans.source;
        }
        return {p, source};

        async function evalStateOrQuery(sOrQ) {
            if (sOrQ instanceof State) {
                return sOrQ;
            } else {
                let ans = await sOrQ.run();
                return ans;
            }
        }
    }

    clearMemo() {
        console.log('Clearing memo for BaseClause');
        for (let party of this.parties) {
            let sOrQ = this.statesOrQueries[party];
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
        let def = this.searchForDefinition(this.name);
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

function zipWithValue (arr, val) {
    return _.zipObject(arr, arr.map(() => val));
}