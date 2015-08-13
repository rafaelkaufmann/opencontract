import { JointState } from './State';

export class Party {
    constructor ({name, publicKey, registry}) {
        this.name = name;
        this.publicKey = new Buffer(publicKey);
        this.registry = registry;
    }

    declare (unitState) {
        return new JointState({ [this.name] : unitState });
    }
}