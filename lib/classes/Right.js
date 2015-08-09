import { JointState } from './State';

export class Right {
    constructor ({name, publicKey}) {
        this.name = name;
        this.publicKey = new Buffer(publicKey || '00000');  // todo: stub
        this.valid = new JointState({});
    }

    static async getRightByName (name, publicKey) {  // TODO: STUB
        return new Right({name, publicKey});
    }

    assign (party, unitState) {
        this.valid = new JointState({ [party.name] : unitState });
    }
}