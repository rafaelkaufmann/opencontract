import { JointState } from './State';

export class Party {
    constructor (params={}) {
        this.name = params.name;
        this.publicKey = new Buffer(params.publicKey);
    }

    static async getPartyByName (name, publicKey) {  // TODO: STUB
        return new Party({name, publicKey});
    }

    declare (unitState) {
        return new JointState({ [this.name] : unitState });
    }
}