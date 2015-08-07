let _ = require('lodash');

export class State {
}

export class UnitState extends State {
    constructor (p, source) {
        super();
        this.p = p;
        if (source !== undefined)
            this.source = source;
    }

    static and(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;

        let p = _.reduce(_.pluck(_children, 'p'),
            (acc, b) =>  (b === null) ? null : acc * b,
            1);
        return new CompoundUnitState(p, 'and', _children);
    }

    static or(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;

        let p = _.reduce(_.pluck(_children, 'p'),
            (acc, b) => (b === null) ? acc : 1 - (1 - acc) * (1 - b),
            0);
        return new CompoundUnitState(p, 'or', _children);
    }

    static not(child) {
        return new CompoundUnitState(1 - child.p, 'not', [child]);
    }

    and(...children) {
        return UnitState.and(_.union([this], children));
    }

    or(...children) {
        return UnitState.or(_.union([this], children));
    }

    not() {
        return UnitState.not(this);
    }
}

export class CompoundUnitState extends UnitState {
    constructor (p, operator, children) {
        super(p);
        this.operator = operator;
        this.children = children;
    }
}

const trueState = new UnitState(1, null),
    falseState = new UnitState(0, null),
    undefinedState = new UnitState(null, null);

UnitState.trueState = trueState;
UnitState.falseState = falseState;
UnitState.undefinedState = undefinedState;

export class JointState extends State {
    constructor (dict, operator = null, children = null) {
        super();

        _.forEach(dict, (unitState, party) => {
            this[party] = unitState;
        });
    }

    static and(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        let allParties = _.union(..._children.map(_.keys)),
            s = {};

        for (let party of allParties) {
            s[party] = UnitState.and(_children.map(child => child[party] || trueState));
        }
        return new JointState(s);
    }

    static or(...children) {
        const _children = _.isArray(children[0]) ? children[0] : children;
        let allParties = _.union(..._children.map(_.keys)),
            s = {};

        for (let party of allParties) {
            s[party] = UnitState.or(_children.map(child => child[party] || falseState));
        }
        return new JointState(s);
    }

    static not(child) {
        let s = _.mapValues(child, unit => UnitState.not(unit));
        return new JointState(s);
    }

    and(...children) {
        return JointState.and(_.union([this], children));
    }

    or(...children) {
        return JointState.or(_.union([this], children));
    }

    not() {
        return JointState.not(this);
    }
}