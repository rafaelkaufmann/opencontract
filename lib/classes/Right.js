import { JointState } from './State';

export class Right {
    constructor ({name, publicKey, registry}) {
        this.name = name;
        this.publicKey = new Buffer(publicKey || '00000');  // todo: stub
        this.registry = registry;
        this.valid = new JointState({});
    }

    assign (party, unitState) {
        this.valid = new JointState({ [party.name] : unitState });
        return this.valid;
    }
}