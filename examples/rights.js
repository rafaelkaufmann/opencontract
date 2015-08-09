import {Contract, Party, UnitState, JointState, Registry, Util, Right} from '../lib/oc';

const should = require('chai').should();

async function example() {
    console.log('Example: clauses');

    var alicesSigKeyPair = Util.generateKeyPair(),
        bobsSigKeyPair = Util.generateKeyPair();

    var alice = await Party.getPartyByName('alice', alicesSigKeyPair.publicKey),
        bob = await Party.getPartyByName('bob', bobsSigKeyPair.publicKey),
        alicesPorsche = await Right.getRightByName('alicesPorsche');

    /*
     Bob must transfer 8000 units of currency to Alice before October 21 2015. If he has done this, he gets the right to Alice's Porsche.
     */
    var c1 = new Contract({
        body: async function () {
            let transfer = await this.Oracle.fetchAndQuery('transferLedger', { type: 'transfer', seller: 'alice', buyer: 'bob', amount: 8000, date: {before: 'Oct 21 2015'}, tag: 'payment-on-porsche' });

            let clause = this.parties.bob.declare(transfer);

            this.rights.alicesPorsche.assign(this.parties.bob, transfer);

            return clause;
        },
        registry: 'local',
        rights: {alicesPorsche},
        parties: {alice, bob}
    });

    await c1.update();  // update() syncs the internal contract state

    console.log('Updated contract');

    console.log(c1.rights.alicesPorsche);

    c1.rights.alicesPorsche.valid.toJSON().should.deep.equal({
        bob: {
            p: 1,
            source: 'local/transferLedger'
        }
    });

}

example().catch(console.trace.bind(console));