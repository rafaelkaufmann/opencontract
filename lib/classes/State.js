let _ = require('lodash');

export class State {
}

export class UnitState extends State {
    constructor (p) {
        super();
        this.p = p;
    }

    static and(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;

        let p = _.reduce(_children,
            (acc, b) => (b.p === null) ? null : acc.p * b.p,
            new RootUnitState(1, null));
        return new CompoundUnitState(p, 'and', _children);
    }

    static or(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;

        let p = _.reduce(_children,
            (acc, b) => (b.p === null) ? acc.p : 1 - (1 - acc.p) * (1 - b.p),
            new RootUnitState(0, null));
        return new CompoundUnitState(p, 'or', _children);
    }

    static not(child) {
        return new CompoundUnitState(1 - child.p, 'not', [child]);
    }

    and(...children) {
        return UnitState.and(_.union(this, children));
    }

    or(...children) {
        return UnitState.or(_.union(this, children));
    }

    not() {
        return UnitState.not(this);
    }
}

export class RootUnitState extends UnitState {
    constructor (p, source) {
        super(p);
        this.source = source;
    }
}

export class CompoundUnitState extends UnitState {
    constructor (p, operator, children) {
        super(p);
        this.operator = operator;
        this.children = children;
    }
}

const trueState = new RootUnitState(1, null),
    falseState = new RootUnitState(0, null),
    undefinedState = new RootUnitState(null, null);

UnitState.trueState = trueState;
UnitState.falseState = falseState;
UnitState.undefinedState = undefinedState;

export class JointState extends State {
    constructor (dict, operator = null, children = null) {
        super();

        _.forEach(dict, (unit, party) => {
            this[party] = unit;
        });
    }

    static and(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        let allParties = _.union(_children.map(_.keys)),
            s = {};

        for (let party of allParties) {
            s[party] = UnitState.and(_children.map(child => child[party] || trueState));
        }
    }

    static or(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        let allParties = _.union(_children.map(_.keys)),
            s = {};

        for (let party of allParties) {
            s[party] = UnitState.or(_children.map(child => child[party] || falseState));
        }
    }

    static not(child) {
        let s = _.mapValues(child, unit => UnitState.not(unit));
        return new JointState(s);
    }

    not() {
        return JointState.not(this);
    }
}